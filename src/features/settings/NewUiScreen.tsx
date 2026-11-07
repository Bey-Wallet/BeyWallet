import React from 'react';
import { useRouter } from 'expo-router';
import { YStack } from 'tamagui';
import { BUIPage, BUIText } from '~/shared/ui/BUI/BUIPage';
import { SettingsGroup, SettingsRow } from './components/SettingsLayout';
import { buiCatalog } from './bui/buiCatalog';
import { buiPreviewRoutes } from './bui/buiRoutes';

export function NewUiScreen() {
  const router = useRouter();
  return (
    <BUIPage title="Bey Wallet / BUI" status="Development-client playground · 14 component groups">
      {buiCatalog.map((section) => (
        <YStack key={section.title} gap={12}>
          <BUIText kind="h3" accessibilityRole="header">
            {section.title}
          </BUIText>
          <SettingsGroup>
            {section.items.map((item) => (
              <SettingsRow
                key={item.number}
                title={item.title}
                description={item.description}
                onPress={() => router.push(buiPreviewRoutes[item.number])}
              />
            ))}
          </SettingsGroup>
        </YStack>
      ))}
    </BUIPage>
  );
}
