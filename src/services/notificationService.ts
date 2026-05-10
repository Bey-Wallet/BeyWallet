import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { useAuthStore } from '../store/authStore';

// Configure how notifications appear when the app is in the foreground
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

class NotificationService {
    private isInitialized = false;

    async requestPermissions() {
        if (this.isInitialized) return true;

        try {
            // Guard catch for scenarios where native module is missing (e.g. before builder creates dev client)
            if (Platform.OS === 'android') {
                await Notifications.setNotificationChannelAsync('default', {
                    name: 'default',
                    importance: Notifications.AndroidImportance.MAX,
                    vibrationPattern: [0, 250, 250, 250],
                    lightColor: '#FF231F7C',
                }).catch(() => null);
            }

            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;

            if (existingStatus !== 'granted') {
                // Prevent auto-lock from triggering when native permission prompt pushes app to background
                useAuthStore.getState().setLockDisabled(true);
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
                
                // Short delay to allow AppState to settle back to 'active'
                setTimeout(() => {
                    useAuthStore.getState().setLockDisabled(false);
                }, 1000);
            }

            if (finalStatus !== 'granted') {
                console.log('[NotificationService] Failed to get permissions for notifications.');
                return false;
            }

            this.isInitialized = true;
            return true;
        } catch (error) {
            console.warn('[NotificationService] Not initialized: Native module missing or error occurred', error);
            return false;
        }
    }

    async sendLocalNotification(title: string, body: string, data?: Record<string, any>) {
        try {
            // Small safeguard to ensure permissions were requested at least once
            if (!this.isInitialized) {
                const hasPermissions = await this.requestPermissions();
                if (!hasPermissions) return;
            }

            await Notifications.scheduleNotificationAsync({
                content: {
                    title,
                    body,
                    data,
                    sound: true,
                },
                trigger: null, // trigger: null means "fire immediately"
            });
            console.log(`[NotificationService] Sent notification: ${title} - ${body}`);
        } catch (error) {
            console.error('[NotificationService] Error sending notification:', error);
        }
    }
}

export const notificationService = new NotificationService();
