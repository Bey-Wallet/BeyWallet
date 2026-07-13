import * as LocalAuthentication from 'expo-local-authentication';
import { Alert } from 'react-native';

export const biometricService = {
    /**
     * Check if the device has biometric hardware and if any biometrics are enrolled
     */
    async checkHardwareAsync() {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();

        return {
            hasHardware,
            isEnrolled,
            supportedTypes, // 1: Fingerprint, 2: Facial, 3: Iris
        };
    },

    /**
     * Authenticate the user
     */
    async authenticateAsync(reason: string = 'Unlock Bey Wallet') {
        try {
            const results = await LocalAuthentication.authenticateAsync({
                promptMessage: reason,
                fallbackLabel: 'Use Passcode',
                disableDeviceFallback: false,
                cancelLabel: 'Cancel',
            });

            return results.success;
        } catch (error) {
            console.error('Biometric authentication error:', error);
            return false;
        }
    },

    /**
     * Programmatically cancel active biometric authentication prompt
     */
    async cancelAuthenticate() {
        try {
            await LocalAuthentication.cancelAuthenticate();
        } catch (error) {
            console.error('Biometric cancel authentication error:', error);
        }
    },

    /**
     * Get biometrics status description
     */
    async getStatusMessage() {
        const { hasHardware, isEnrolled } = await this.checkHardwareAsync();
        if (!hasHardware) return 'Biometric hardware not available';
        if (!isEnrolled) return 'No biometrics enrolled on this device';
        return 'Biometrics ready';
    }
};
