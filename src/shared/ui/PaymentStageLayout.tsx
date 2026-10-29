import React from 'react';
import { ScrollView, YStack } from 'tamagui';
import { useSettingsStore } from '~/state/settingsStore';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useReceiptSheet } from '~/shared/ui/ReceiptSheetContext';

/** Confirmations center their amount above bottom details; QR screens follow mint payment. */
export function PaymentStageLayout({
  variant = 'confirm',
  hero,
  children,
  footer,
  disabled,
  inset = true,
}: {
  variant?: 'confirm' | 'qr' | 'receipt';
  hero: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  disabled?: boolean;
  inset?: boolean;
}) {
  const centered = variant !== 'qr';
  const satsOnly = useSettingsStore((state) => state.secondaryCurrency === 'NONE');
  const sheet = useReceiptSheet();
  const ContentScrollView =
    sheet && sheet.presentation !== 'screen' ? BottomSheetScrollView : ScrollView;
  return (
    <YStack testID="payment-stage-layout" flex={1} bg="$background" px={inset ? '$4' : 0}>
      <ContentScrollView
        flex={1}
        showsVerticalScrollIndicator={false}
        pointerEvents={disabled ? 'none' : 'auto'}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
      >
        <YStack flex={1} gap={centered ? '$6' : '$4'} py={centered ? 0 : '$4'}>
          <YStack
            testID="payment-stage-hero"
            flex={centered ? 1 : undefined}
            minHeight={
              centered ? (variant === 'receipt' ? 280 : 240) - (satsOnly ? 32 : 0) : undefined
            }
            gap={centered ? '$3' : '$4'}
            items="center"
            justify="center"
            width="100%"
          >
            {hero}
          </YStack>
          <YStack testID="payment-stage-details" width="100%" gap="$2">
            {children}
          </YStack>
        </YStack>
      </ContentScrollView>
      {footer && (
        <YStack testID="payment-stage-footer" pt="$3" pb="$4" bg="$background" gap="$2">
          {footer}
        </YStack>
      )}
    </YStack>
  );
}
