import React from 'react';
import { Expand } from '@tamagui/lucide-icons';
import { useSettingsStore } from '~/state/settingsStore';
import { SettingsDescription, SettingsGroup, SettingsPage } from './components/SettingsLayout';
import { SettingsToggleRow } from './components/SettingsToggleRow';

export function BalanceAreaSettingsScreen() {
  const enabled = useSettingsStore((state) => state.homeExpanded);
  const save = useSettingsStore((state) => state.setHomeExpanded);
  return (
    <SettingsPage>
      <SettingsDescription>
        Show your balance and actions in a full-height Home layout. Scroll to see your mints.
      </SettingsDescription>
      <SettingsGroup>
        <SettingsToggleRow title="Expanded Home" icon={Expand} checked={enabled} save={save} />
      </SettingsGroup>
    </SettingsPage>
  );
}
