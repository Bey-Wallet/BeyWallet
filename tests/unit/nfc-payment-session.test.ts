jest.mock('react-native-nfc-manager', () => ({
  __esModule: true,
  default: {
    requestTechnology: jest.fn(async () => {}),
    registerTagEvent: jest.fn(async () => {}),
    getTag: jest.fn(async () => ({ ndefMessage: [] })),
    cancelTechnologyRequest: jest.fn(async () => {}),
    setEventListener: jest.fn(),
    unregisterTagEvent: jest.fn(async () => {}),
    ndefHandler: { writeNdefMessage: jest.fn(async () => {}) },
  },
  NfcTech: { Ndef: 'Ndef' },
  NfcEvents: {},
  Ndef: {
    TNF_WELL_KNOWN: 1,
    textRecord: (value: string) => value,
    encodeMessage: (records: unknown[]) => records,
    text: { decodePayload: jest.fn(() => 'cashu:cashuBtoken') },
    uri: { decodePayload: jest.fn(() => 'bitcoin:?creq=request') },
  },
}));
jest.mock('react-native-hce', () => ({
  HCESession: { getInstance: async () => mockHceSession },
  NFCTagType4: jest.fn((options) => options),
  NFCTagType4NDEFContentType: { Text: 'text', URL: 'url' },
}));
jest.mock('~/services/wallet', () => ({}));

import NfcManager, { Ndef, type TagEvent } from 'react-native-nfc-manager';
import { Platform } from 'react-native';
import {
  nfcService,
  decodePaymentNdef,
  assertSameNfcPaymentRequest,
} from '~/services/platform/nfcService';
import { PaymentRequest } from '@cashu/cashu-ts';
import { useAuthStore } from '~/state/authStore';
import { NFCTagType4 } from 'react-native-hce';

const mockHceSession = {
  setApplication: jest.fn(async (_tag: unknown) => {}),
  setEnabled: jest.fn(async (_enabled: boolean) => {}),
};

beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.getState().setLockDisabled(false);
});

it('advertises the complete request read-only without disabling or restoring the wallet lock', async () => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
  const session = await nfcService.startHceSimulation('creq-complete-request', {
    preventAutoLock: false,
  });
  expect(NFCTagType4).toHaveBeenCalledWith({
    type: 'text',
    content: 'cashu:creq-complete-request',
    writable: false,
  });
  expect(useAuthStore.getState().isLockDisabled).toBe(false);
  useAuthStore.getState().setLockDisabled(true);
  await nfcService.stopHceSimulation(session);
  expect(useAuthStore.getState().isLockDisabled).toBe(true);
  expect(mockHceSession.setEnabled.mock.calls).toEqual([[true], [false]]);
});

it('preserves the existing auto-lock protection for ordinary NFC sends', async () => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
  const session = await nfcService.startHceSimulation('cashuB-token');
  expect(useAuthStore.getState().isLockDisabled).toBe(true);
  await nfcService.stopHceSimulation(session);
  expect(useAuthStore.getState().isLockDisabled).toBe(false);
});

it('disables a partially started request broadcast when native startup fails', async () => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
  mockHceSession.setEnabled.mockRejectedValueOnce(new Error('Native startup failed'));
  await expect(
    nfcService.startHceSimulation('creq-request', { preventAutoLock: false }),
  ).rejects.toThrow('Native startup failed');
  expect(mockHceSession.setEnabled.mock.calls).toEqual([[true], [false]]);
  expect(useAuthStore.getState().isLockDisabled).toBe(false);
});

it('keeps the same native session open for confirmation and write-back', async () => {
  const session = nfcService.openPaymentSession();
  await session.read();
  expect(useAuthStore.getState().isLockDisabled).toBe(true);
  expect(NfcManager.cancelTechnologyRequest).not.toHaveBeenCalled();
  await session.write('cashuBtoken');
  expect(NfcManager.requestTechnology).toHaveBeenCalledTimes(1);
  expect(NfcManager.requestTechnology).toHaveBeenCalledWith(
    'Ndef',
    Platform.OS === 'android' ? { isReaderModeEnabled: true, readerModeFlags: 0x103 } : undefined,
  );
  expect(NfcManager.ndefHandler.writeNdefMessage).toHaveBeenCalledTimes(1);
  expect(NfcManager.cancelTechnologyRequest).not.toHaveBeenCalled();
  await session.close();
  await session.close();
  expect(NfcManager.cancelTechnologyRequest).toHaveBeenCalledTimes(1);
  expect(useAuthStore.getState().isLockDisabled).toBe(false);
});

it('announces Android reader readiness only after native registration and cleans it up', async () => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
  let registered!: () => void;
  jest.mocked(NfcManager.registerTagEvent).mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        registered = resolve;
      }),
  );
  const ready = jest.fn();
  const session = nfcService.openPaymentSession();
  const reading = session.read(ready);
  expect(ready).not.toHaveBeenCalled();
  registered();
  await reading;
  expect(ready).toHaveBeenCalledTimes(1);
  await session.close();
  expect(NfcManager.unregisterTagEvent).toHaveBeenCalledTimes(1);
});

it('does not announce readiness if the reader is closed during registration', async () => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
  let registered!: () => void;
  jest.mocked(NfcManager.registerTagEvent).mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        registered = resolve;
      }),
  );
  const ready = jest.fn();
  const session = nfcService.openPaymentSession();
  const reading = session.read(ready);
  const failed = expect(reading).rejects.toThrow('closed');
  const closing = session.close();
  registered();
  await Promise.all([closing, failed]);
  expect(ready).not.toHaveBeenCalled();
  expect(NfcManager.unregisterTagEvent).toHaveBeenCalledTimes(1);
  expect(useAuthStore.getState().isLockDisabled).toBe(false);
});
it('distinguishes an unwritable tag from contact loss without logging native data', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const session = nfcService.openPaymentSession();
  await session.read();
  jest
    .mocked(NfcManager.ndefHandler.writeNdefMessage)
    .mockRejectedValueOnce(new Error('tag not writable synthetic bearer data'));
  await expect(session.write('token')).rejects.toThrow('read_only');
  expect(warn).toHaveBeenCalledWith('[NfcPaymentSession] Write failed', {
    category: 'read_only',
  });
  expect(JSON.stringify(warn.mock.calls)).not.toContain('synthetic bearer');
  warn.mockRestore();
});
it('closes on contact loss and preserves prior lock behavior', async () => {
  useAuthStore.getState().setLockDisabled(true);
  const session = nfcService.openPaymentSession();
  await session.read();
  jest.mocked(NfcManager.ndefHandler.writeNdefMessage).mockRejectedValueOnce(new Error('tag lost'));
  await expect(session.write('token')).rejects.toThrow('contact lost');
  expect(useAuthStore.getState().isLockDisabled).toBe(true);
  await expect(session.write('token')).rejects.toThrow('contact lost');
});
it('cancels a pending read and restores app locking', async () => {
  const session = nfcService.openPaymentSession();
  await session.close();
  await expect(session.read()).rejects.toThrow('closed');
  expect(useAuthStore.getState().isLockDisabled).toBe(false);
});
it('decodes NDEF Text and URI with the native codecs', () => {
  const tag = (type: number) =>
    ({ ndefMessage: [{ tnf: 1, type: [type], payload: [0, 1], id: [] }] }) as TagEvent;
  expect(decodePaymentNdef(tag(0x54))).toBe('cashu:cashuBtoken');
  expect(decodePaymentNdef(tag(0x55))).toBe('bitcoin:?creq=request');
  expect(Ndef.text.decodePayload).toHaveBeenCalled();
  expect(Ndef.uri.decodePayload).toHaveBeenCalled();
});

it('rejects another merchant request on reconnection before a write', () => {
  const expected = new PaymentRequest([], 'same-request', 1, 'sat').toEncodedCreqA();
  const other = new PaymentRequest([], 'other-request', 1, 'sat').toEncodedCreqA();
  const tag = { ndefMessage: [{ tnf: 1, type: [0x54], payload: [0], id: [] }] } as TagEvent;
  jest.mocked(Ndef.text.decodePayload).mockReturnValueOnce(expected);
  expect(() => assertSameNfcPaymentRequest(tag, expected)).not.toThrow();
  jest.mocked(Ndef.text.decodePayload).mockReturnValueOnce(other);
  expect(() => assertSameNfcPaymentRequest(tag, expected)).toThrow('same payment request');
  expect(NfcManager.ndefHandler.writeNdefMessage).not.toHaveBeenCalled();
});
