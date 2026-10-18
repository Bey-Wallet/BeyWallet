import { NativeModules, Platform } from 'react-native';
import NfcManager, { NfcTech, Ndef, NfcEvents, type TagEvent } from 'react-native-nfc-manager';
import type { HCESession } from 'react-native-hce';
import { useAuthStore } from '~/state/authStore';
import { cleanToken, decodeToken, encodeTokenV4 } from '~/services/wallet';
import { parsePaymentInput } from '~/shared/utils/paymentInputParser';

const init = async function () {
  const supported = await NfcManager.isSupported();
  if (supported) {
    await NfcManager.start();
  }
  return supported;
};

const isEnabled = function () {
  return NfcManager.isEnabled();
};

export interface NfcPaymentSession {
  read: () => Promise<TagEvent>;
  write: (text: string) => Promise<void>;
  close: () => Promise<void>;
}

let paymentSession: NfcPaymentSession | null = null;

/** Own reader mode until settlement or cancellation. */
const openPaymentSession = (): NfcPaymentSession => {
  if (paymentSession) throw new Error('An NFC payment session is already open');
  const previousLock = useAuthStore.getState().isLockDisabled;
  useAuthStore.getState().setLockDisabled(true);
  let closed = false;
  let ready = false;
  let opening: Promise<TagEvent> | undefined;
  const session: NfcPaymentSession = {
    read: () =>
      (opening ??= (async () => {
        try {
          if (closed) throw new Error('NFC session closed');
          await NfcManager.requestTechnology(
            NfcTech.Ndef,
            Platform.OS === 'android'
              ? { isReaderModeEnabled: true, readerModeFlags: 0x1 | 0x2 | 0x100 }
              : undefined,
          );
          if (closed) {
            await NfcManager.cancelTechnologyRequest().catch(() => {});
            throw new Error('NFC session closed');
          }
          const tag = await NfcManager.getTag();
          if (!tag) throw new Error('No NFC tag found');
          ready = true;
          return tag;
        } catch (error) {
          await session.close();
          throw error;
        }
      })()),
    write: async (text) => {
      if (closed || !ready) throw new Error('NFC contact lost. Reconnect to the same request.');
      if (!isStringSafeForNFC(text)) throw new Error('Payment token is too large for NFC');
      const bytes = Ndef.encodeMessage([Ndef.textRecord(text)]);
      if (!bytes) throw new Error('Cannot encode NFC payment');
      try {
        await NfcManager.ndefHandler.writeNdefMessage(bytes, { reconnectAfterWrite: false });
      } catch (error) {
        // Native errors may contain payload data: only log a fixed failure category.
        const message = error instanceof Error ? error.message : String(error);
        const category = /TagLost|tag lost/i.test(message)
          ? 'contact_lost'
          : /read.?only|not writable/i.test(message)
            ? 'read_only'
            : /ERR_NO_TECH_REQ|not connected/i.test(message)
              ? 'session_missing'
              : /too (large|long)|capacity/i.test(message)
                ? 'capacity'
                : 'write_failed';
        console.warn('[NfcPaymentSession] Write failed', { category });
        await session.close();
        throw new Error(
          category === 'contact_lost' || category === 'session_missing'
            ? 'NFC contact lost. Reconnect to the same request to deliver the existing payment.'
            : `NFC write failed (${category}). The existing payment remains in History.`,
        );
      }
    },
    close: async () => {
      if (closed) return;
      closed = true;
      await NfcManager.cancelTechnologyRequest().catch(() => {});
      if (paymentSession === session) {
        paymentSession = null;
        useAuthStore.getState().setLockDisabled(previousLock);
      }
    },
  };
  paymentSession = session;
  return session;
};

export function decodePaymentNdef(tag: TagEvent): string {
  for (const record of tag.ndefMessage ?? []) {
    if (record.tnf !== Ndef.TNF_WELL_KNOWN || record.type.length !== 1) continue;
    const payload = new Uint8Array(record.payload);
    if (record.type[0] === 0x54) return Ndef.text.decodePayload(payload).trim();
    if (record.type[0] === 0x55) return Ndef.uri.decodePayload(payload).trim();
  }
  throw new Error('No supported NDEF Text or URI payment record found');
}

export function assertSameNfcPaymentRequest(tag: TagEvent, expectedRequest: string): void {
  const input = parsePaymentInput(decodePaymentNdef(tag));
  if (
    !input.matched ||
    !input.ok ||
    input.value.primary.type !== 'cashu_request' ||
    input.value.primary.value !== expectedRequest
  ) {
    throw new Error('Reconnect to the same payment request. The existing token was not delivered.');
  }
}

const goToNfcSetting = function () {
  return NfcManager.goToNfcSetting();
};

const stopListening = async () => {
  NfcManager.setEventListener(NfcEvents.DiscoverTag, null);
  await NfcManager.unregisterTagEvent().catch(() => {});
};

const hceLocks = new WeakMap<HCESession, boolean>();
const startHceSimulation = async (
  text: string,
  { preventAutoLock = true, requestId = '' } = {},
) => {
  if (Platform.OS !== 'android') {
    throw new Error('HCE is only supported on Android');
  }
  if (!isStringSafeForNFC(text)) throw new Error('NFC message is too large');
  const { HCESession, NFCTagType4NDEFContentType, NFCTagType4 } =
    require('react-native-hce') as typeof import('react-native-hce');

  const previousLock = useAuthStore.getState().isLockDisabled;
  let startedSession: HCESession | undefined;
  try {
    if (requestId) await NativeModules.Hce.setRequestSession(requestId);
    else await NativeModules.Hce?.setRequestSession?.('');
    if (preventAutoLock) useAuthStore.getState().setLockDisabled(true);

    // Cancel any active NfcManager reader mode / listeners before enabling HCE session
    await stopListening();
    await NfcManager.cancelTechnologyRequest().catch(() => {});

    let content = text;
    let contentType = NFCTagType4NDEFContentType.URL;

    if (requestId) {
      content = text;
      contentType = NFCTagType4NDEFContentType.Text;
    } else if (text.startsWith('http')) {
      content = text;
      contentType = NFCTagType4NDEFContentType.URL;
    } else {
      // Auto-compress V3 tokens (cashuA...) to compact V4 (cashuB...) for NFC
      try {
        const clean = cleanToken(text);
        const decoded = decodeToken(clean);
        const v4Token = encodeTokenV4(decoded);
        content = v4Token.startsWith('cashu:') ? v4Token : `cashu:${v4Token}`;
      } catch {
        content = text.startsWith('cashu:') ? text : `cashu:${text}`;
      }
      // Use Text record type for raw tokens
      contentType = NFCTagType4NDEFContentType.Text;
    }

    const tag = new NFCTagType4({
      type: contentType,
      content,
      writable: !!requestId,
    });

    const session = await HCESession.getInstance();
    if (!session) {
      throw new Error('Failed to get HCE session instance');
    }
    startedSession = session;

    if (preventAutoLock) hceLocks.set(session, previousLock);
    await session.setApplication(tag);
    await session.setEnabled(true);
    return session;
  } catch (e: any) {
    if (startedSession) {
      await startedSession.setEnabled(false).catch(() => {});
      hceLocks.delete(startedSession);
    }
    if (preventAutoLock) useAuthStore.getState().setLockDisabled(previousLock);
    throw e;
  }
};

const stopHceSimulation = async (session: any) => {
  if (!session) return;
  try {
    await session.setEnabled(false);
  } catch (e: any) {
    console.warn('[nfcService] Could not stop NFC broadcast');
  } finally {
    if (hceLocks.has(session)) useAuthStore.getState().setLockDisabled(hceLocks.get(session)!);
    hceLocks.delete(session);
  }
};

const isStringSafeForNFC = function (str: string): boolean {
  const SAFE_NFC_BYTE_LIMIT = 32000; // Conservative limit
  try {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str);
    return bytes.length <= SAFE_NFC_BYTE_LIMIT;
  } catch (error) {
    console.warn('Error measuring string byte size:', error);
    return false;
  }
};

export const nfcService = {
  getDiagnostics: async (): Promise<NfcDiagnostics | null> => {
    if (!__DEV__ || Platform.OS !== 'android') return null;
    if (!NativeModules.Hce?.getDiagnostics) return null;
    return NativeModules.Hce.getDiagnostics();
  },
  clearDiagnostics: async (): Promise<void> => {
    if (__DEV__ && Platform.OS === 'android') {
      await NativeModules.Hce?.clearDiagnostics?.();
    }
  },
  pauseRequestSession: async () => {
    if (Platform.OS === 'android') await NativeModules.Hce.setEnabled(false);
  },
  getPendingPayment: async (): Promise<PendingNfcPayment | null> => {
    if (Platform.OS !== 'android') return null;
    if (!NativeModules.Hce?.getPendingPayment) return null;
    return NativeModules.Hce.getPendingPayment();
  },
  acknowledgePayment: async (id: string): Promise<boolean> =>
    NativeModules.Hce.acknowledgePayment(id),
  openPaymentSession,
  init,
  isEnabled,
  goToNfcSetting,
  startHceSimulation,
  stopHceSimulation,
  stopListening,
  isStringSafeForNFC,
};

export interface NfcDiagnostics {
  report: string;
  androidVersion: string;
  deviceModel: string;
}

export interface PendingNfcPayment {
  id: string;
  requestId: string;
  content: string;
  receivedAt: number;
}
