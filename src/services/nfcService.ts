import { Platform } from 'react-native';
import NfcManager, { NfcTech, Ndef, NfcEvents } from 'react-native-nfc-manager';
import { HCESession, NFCTagType4NDEFContentType, NFCTagType4 } from 'react-native-hce';
import { useAuthStore } from '~/store/authStore';

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

const goToNfcSetting = function () {
    useAuthStore.getState().setLockDisabled(true);
    const result = NfcManager.goToNfcSetting();
    setTimeout(() => useAuthStore.getState().setLockDisabled(false), 3000);
    return result;
};

const readNdefTag = async () => {
    try {
        useAuthStore.getState().setLockDisabled(true);
        await NfcManager.requestTechnology(NfcTech.Ndef);
        const tag = await NfcManager.getTag();
        return tag;
    } catch (e: any) {
        throw e;
    } finally {
        await NfcManager.cancelTechnologyRequest().catch(() => {});
        setTimeout(() => useAuthStore.getState().setLockDisabled(false), 1000);
    }
};

const writeNdefTag = async (text: string) => {
    try {
        useAuthStore.getState().setLockDisabled(true);
        await NfcManager.requestTechnology(NfcTech.Ndef);
        const bytes = Ndef.encodeMessage([Ndef.textRecord(text)]);
        await NfcManager.writeNdefMessage(bytes, { reconnectAfterWrite: false });
    } catch (e: any) {
        throw e;
    } finally {
        await NfcManager.cancelTechnologyRequest().catch(() => {});
        setTimeout(() => useAuthStore.getState().setLockDisabled(false), 1000);
    }
};

const startListening = async (callback: (tag: any) => void) => {
    try {
        await NfcManager.registerTagEvent();
        NfcManager.setEventListener(NfcEvents.DiscoverTag, callback);
    } catch (e) {
        console.warn('Failed to register tag event', e);
    }
};

const stopListening = async () => {
    NfcManager.setEventListener(NfcEvents.DiscoverTag, null);
    await NfcManager.unregisterTagEvent().catch(() => {});
};

const startHceSimulation = async (text: string) => {
    if (Platform.OS !== 'android') {
        throw new Error('HCE is only supported on Android');
    }
    
    try {
        useAuthStore.getState().setLockDisabled(true);

        // Use URL record type — more reliably dispatched by Android's NFC reader
        // mode (used by Minibits and other wallets). Wrap the raw cashu token as
        // a URL with "cashu:" prefix so receivers can parse it as a URI or plain text.
        const content = text.startsWith('http') ? text : `cashu:${text}`;

        const tag = new NFCTagType4({
            type: NFCTagType4NDEFContentType.URL,
            content,
            writable: false,
        });

        const session = await HCESession.getInstance();
        if (!session) {
            throw new Error('Failed to get HCE session instance');
        }

        await session.setApplication(tag);
        await session.setEnabled(true);
        return session;
    } catch (e: any) {
        console.error('Failed to start HCE simulation', e);
        useAuthStore.getState().setLockDisabled(false);
        throw e;
    }
};

const stopHceSimulation = async (session: any) => {
    if (!session) return;
    try {
        await session.setEnabled(false);
    } catch (e: any) {
        console.warn('Failed to stop HCE simulation', e);
    } finally {
        useAuthStore.getState().setLockDisabled(false);
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
    init,
    isEnabled,
    goToNfcSetting,
    readNdefTag,
    writeNdefTag,
    startHceSimulation,
    stopHceSimulation,
    startListening,
    stopListening,
    isStringSafeForNFC,
};
