import React from 'react';
import { useRouter } from 'expo-router';
import { useSupporterStore } from '~/state/supporterStore';
import { SupporterContent } from './SupporterContent';

/** Permanent destination; dismissing the Home prompt never removes this screen. */
export function SupporterSettingsScreen() {
  const router = useRouter();
  const dismissed = useSupporterStore((state) => state.homeCardDismissed);
  const dismiss = useSupporterStore((state) => state.dismissHomeCard);
  return (
    <SupporterContent
      onClose={() => router.navigate('/(tabs)')}
      onDoNotShowAgain={dismissed ? undefined : dismiss}
    />
  );
}
