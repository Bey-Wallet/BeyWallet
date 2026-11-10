import React from 'react';
import { useNostrHistoryStore } from '~/state/nostrHistoryStore';
import { SettingsPage, SettingsGroup, SettingsDescription } from './components/SettingsLayout';
import { SettingsToggleRow } from './components/SettingsToggleRow';
import { History } from '@tamagui/lucide-icons';

export function NostrHistorySettingsScreen() {
  const includeOlder = useNostrHistoryStore((state) => state.includeOlder);
  const setIncludeOlder = useNostrHistoryStore((state) => state.setIncludeOlder);
  return (
    <SettingsPage>
      <SettingsDescription>
        After restoring from seed, Bey listens for new activity without loading messages and payment
        activity from before the restore. Older activity stays off until you turn it on here, even
        after restarting the app.
      </SettingsDescription>
      <SettingsGroup>
        <SettingsToggleRow
          title="Load older activity"
          icon={History}
          checked={includeOlder}
          save={async (enabled) => setIncludeOlder(enabled)}
        />
      </SettingsGroup>
      <SettingsDescription>
        Turning this on fetches available Nostr messages and payment activity from the last seven
        days when the wallet is online, unlocked, and not recovering funds. A large history may take
        time to load. Relays may not retain every message.
      </SettingsDescription>
      <SettingsDescription>
        Older ecash payment offers follow your existing contact, receiving, and mint-approval rules.
        Restoring funds from mints and discovering your mint-list backup are separate. Turning this
        off does not delete items already loaded.
      </SettingsDescription>
    </SettingsPage>
  );
}
