import React from 'react';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SupporterContent } from './SupporterContent';
import { SUPPORT_PAYMENT_ROUTE } from './supporterPayment';

/** Support remains available as a dedicated Settings destination. */
export function SupporterSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <SupporterContent
      bottomInset={insets.bottom}
      onPay={() => router.push(SUPPORT_PAYMENT_ROUTE)}
    />
  );
}
