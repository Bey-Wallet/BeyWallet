import { Platform } from 'react-native';
import NfcManager, { NfcTech, Ndef, NfcEvents } from 'react-native-nfc-manager';
import { HCESession, NFCTagType4NDEFContentType, NFCTagType4 } from 'react-native-hce';

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
    return NfcManager.goToNfcSetting();
};

const readNdefTag = async () => {
    try {
        await NfcManager.requestTechnology(NfcTech.Ndef);
        const tag = await NfcManager.getTag();
        return tag;
    } catch (e: any) {
        throw e;
    } finally {
        await NfcManager.cancelTechnologyRequest().catch(() => {});
    }
};

const writeNdefTag = async (text: string) => {
    try {
        await NfcManager.requestTechnology(NfcTech.Ndef);
        const bytes = Ndef.encodeMessage([Ndef.textRecord(text)]);
        await NfcManager.writeNdefMessage(bytes, { reconnectAfterWrite: false });
    } catch (e: any) {
        throw e;
    } finally {
        await NfcManager.cancelTechnologyRequest().catch(() => {});
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
        const tag = new NFCTagType4({
            type: NFCTagType4NDEFContentType.Text,
            content: text,
            writable: false,
        });

        const session = await HCESession.getInstance();
        if (!session) {
            throw new Error('Failed to get HCE session instance');
        }

        session.setApplication(tag);
        await session.setEnabled(true);
        return session;
    } catch (e: any) {
        console.error('Failed to start HCE simulation', e);
        throw e;
    }
};

const stopHceSimulation = async (session: any) => {
    if (!session) return;
    try {
        await session.setEnabled(false);
    } catch (e: any) {
        console.warn('Failed to stop HCE simulation', e);
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
