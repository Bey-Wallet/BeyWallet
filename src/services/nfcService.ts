import { Platform } from 'react-native';
import NfcManager, { NfcTech, Ndef, NfcEvents } from 'react-native-nfc-manager';

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
    startListening,
    stopListening,
    isStringSafeForNFC,
};
