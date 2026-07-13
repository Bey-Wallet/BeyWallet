import * as Network from 'expo-network';
import { Alert } from 'react-native';

export const networkService = {
    /**
     * Check if the device is currently offline.
     */
    isOffline: async (): Promise<boolean> => {
        try {
            const state = await Network.getNetworkStateAsync();
            return !state.isConnected || state.isInternetReachable === false;
        } catch {
            return false;
        }
    },

    /**
     * Check if the device is offline, and if so, show a warning alert and return true.
     * Otherwise returns false.
     */
    checkOfflineAndAlert: async (actionDescription?: string): Promise<boolean> => {
        const offline = await networkService.isOffline();
        if (offline) {
            const message = actionDescription 
                ? `You are offline. Cannot ${actionDescription} right now.`
                : 'You are offline. Please check your internet connection and try again.';
            
            Alert.alert('You are offline', message);
            return true;
        }
        return false;
    }
};
