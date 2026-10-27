import React from 'react';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSupporterStore } from '~/state/supporterStore';
import { SupporterContent } from './SupporterContent';
import { SUPPORT_PAYMENT_ROUTE } from './supporterPayment';

/** Permanent destination; dismissing the Home prompt never removes this screen. */
export function SupporterSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dismissed = useSupporterStore((state) => state.homeCardDismissed);
  const dismiss = useSupporterStore((state) => state.dismissHomeCard);
  return (
    <SupporterContent
      bottomInset={insets.bottom}
      onPay={() => router.push(SUPPORT_PAYMENT_ROUTE)}
      onDoNotShowAgain={dismissed ? undefined : dismiss}
    />
  );
}
