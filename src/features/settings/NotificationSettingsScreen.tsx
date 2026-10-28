import React, { useEffect, useState } from 'react';
import { AppState, Linking } from 'react-native';
import { Bell, Eye, CreditCard, MessageCircle, AlertCircle } from '@tamagui/lucide-icons';
import { notificationService } from '~/services/platform/notificationService';
import { useSettingsStore, type NotificationPreferences } from '~/state/settingsStore';
import {
  SettingsDescription,
  SettingsGroup,
  SettingsPage,
  SettingsRow,
} from './components/SettingsLayout';
import { SettingsToggleRow } from './components/SettingsToggleRow';

export function NotificationSettingsScreen() {
  const settings = useSettingsStore();
  const [permission, setPermission] = useState('checking');
  const [settingsError, setSettingsError] = useState(false);
  useEffect(() => {
    let mounted = true;
    const refresh = () =>
      void notificationService.permissionStatus().then((value) => {
        if (mounted) setPermission(value);
      });
    refresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);
  const preferences: { key: keyof NotificationPreferences; title: string; icon: typeof Bell }[] = [
    { key: 'details', title: 'Show notification details', icon: Eye },
    { key: 'payments', title: 'Payments', icon: CreditCard },
    { key: 'messages', title: 'Messages', icon: MessageCircle },
    { key: 'review', title: 'Review needed', icon: AlertCircle },
  ];
  return (
    <SettingsPage>
      <SettingsDescription>
        Bey can notify you about activity it detects while running. Receiving alerts while the app
        is fully closed is unavailable in this version.
      </SettingsDescription>
      <SettingsGroup>
        <SettingsToggleRow
          title="Enable notifications"
          icon={Bell}
          checked={settings.notificationsEnabled}
          save={async (enabled) => {
            await settings.setNotificationsEnabled(enabled);
            if (enabled) {
              await notificationService.requestPermissions();
              setPermission(await notificationService.permissionStatus());
            }
          }}
        />
        {preferences.map(({ key, title, icon }) => (
          <SettingsToggleRow
            key={key}
            title={title}
            icon={icon}
            checked={settings.notificationPreferences[key]}
            description={
              key === 'details'
                ? 'Private by default. Details stay hidden when locked or balances are hidden.'
                : undefined
            }
            save={(enabled) => settings.setNotificationPreference(key, enabled)}
          />
        ))}
      </SettingsGroup>
      <SettingsGroup>
        <SettingsRow title="System permission" value={permission} />
        {permission !== 'granted' && (
          <SettingsRow
            title="Allow notifications"
            onPress={async () => {
              await notificationService.requestPermissions();
              setPermission(await notificationService.permissionStatus());
            }}
          />
        )}
        <SettingsRow
          title="Open system settings"
          onPress={() => {
            setSettingsError(false);
            void Linking.openSettings().catch(() => setSettingsError(true));
          }}
        />
      </SettingsGroup>
      {settingsError && (
        <SettingsDescription>
          Could not open system settings. Open your device settings and choose Bey.
        </SettingsDescription>
      )}
    </SettingsPage>
  );
}
