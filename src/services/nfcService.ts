import { Platform } from 'react-native';
import NfcManager, { NfcTech, Ndef, NfcEvents } from 'react-native-nfc-manager';
import { HCESession, NFCTagType4NDEFContentType, NFCTagType4 } from 'react-native-hce';
import { useAuthStore } from '~/store/authStore';
import { cleanToken, decodeToken, encodeTokenV4 } from '~/services/core';

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

        // Cancel any active NfcManager reader mode / listeners before enabling HCE session
        await stopListening();
        await NfcManager.cancelTechnologyRequest().catch(() => {});

        let content = text;
        let contentType = NFCTagType4NDEFContentType.URL;

        if (text.startsWith('http')) {
            content = text;
            contentType = NFCTagType4NDEFContentType.URL;
        } else {
            // Auto-compress V3 tokens (cashuA...) to compact V4 (cashuB...) for NFC
            try {
                const clean = cleanToken(text);
                const decoded = decodeToken(clean);
                const v4Token = encodeTokenV4(decoded);
                content = v4Token.startsWith('cashu:') ? v4Token : `cashu:${v4Token}`;
                console.log('[nfcService] Formatted compact V4 token for HCE broadcast:', content.slice(0, 25) + '…');
            } catch (err) {
                console.warn('[nfcService] Could not convert to V4, using raw token:', err);
                content = text.startsWith('cashu:') ? text : `cashu:${text}`;
            }
            // Use Text record type for raw tokens
            contentType = NFCTagType4NDEFContentType.Text;
        }

        const tag = new NFCTagType4({
            type: contentType,
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
