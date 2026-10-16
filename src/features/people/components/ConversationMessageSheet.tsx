import React, { forwardRef, useEffect, useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { Copy } from '@tamagui/lucide-icons';
import { Text, XStack, YStack } from 'tamagui';
import AppBottomSheet, { type AppBottomSheetRef } from '~/shared/ui/AppBottomSheet';
import { AppIconButton } from '~/shared/ui/AppIconButton';
import { AppButton } from '~/shared/ui/AppButton';
import type { ConversationActivity } from '../conversationActivity';

export const ConversationMessageSheet = forwardRef<
  AppBottomSheetRef,
  {
    item: ConversationActivity | null;
    primaryAmount?: string;
    secondaryAmount?: string | null;
    bottomInset: number;
    actionLabel?: string;
    onAction?: () => void;
  }
>(function ConversationMessageSheet(
  { item, primaryAmount, secondaryAmount, bottomInset, actionLabel, onAction },
  ref,
) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  useEffect(() => {
    setCopied(false);
    setCopyError('');
  }, [item?.id]);
  const copy = async () => {
    if (!item) return;
    try {
      await Clipboard.setStringAsync(item.text ?? `${item.type}\n${primaryAmount}\n${item.status}`);
      setCopied(true);
      setCopyError('');
    } catch {
      setCopyError('Could not copy. Try again.');
    }
  };
  return (
    <AppBottomSheet ref={ref} snapPoints={['65%', '90%']} bottomInset={bottomInset}>
      <BottomSheetScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: Math.max(bottomInset, 20) + 12 }}
      >
        {item && (
          <YStack gap="$4">
            <XStack items="center" justify="space-between" gap="$3">
              <Text fontSize="$6" fontWeight="800">
                {item.amount === undefined ? 'Message details' : 'Payment details'}
              </Text>
              <AppIconButton
                variant="default"
                emphasis="secondary"
                accessibilityLabel={
                  copied
                    ? 'Copied'
                    : item.amount === undefined
                      ? 'Copy message'
                      : 'Copy payment details'
                }
                icon={Copy}
                onPress={() => void copy()}
              />
            </XStack>
            <YStack bg="$buttonDefaultSecondary" p="$4" rounded="$5" gap="$2">
              {item.text !== undefined ? (
                <Text selectable fontSize="$5" lineHeight={23}>
                  {item.text}
                </Text>
              ) : (
                <>
                  <Text color="$gray10">{item.type}</Text>
                  <Text fontSize="$8" fontWeight="800">
                    {primaryAmount}
                  </Text>
                  {!!secondaryAmount && <Text color="$gray10">{secondaryAmount}</Text>}
                </>
              )}
            </YStack>
            {copied && (
              <Text accessibilityLiveRegion="polite" color="$gray10">
                Copied
              </Text>
            )}
            {!!copyError && (
              <Text accessibilityLiveRegion="polite" color="$buttonWarningSecondaryText">
                {copyError}
              </Text>
            )}
            <Detail label="Status" value={item.status} />
            <Detail
              label="Direction"
              value={item.direction === 'outgoing' ? 'Outgoing' : 'Incoming'}
            />
            <Detail label="Time" value={new Date(item.time).toLocaleString()} />
            {item.message?.direction === 'incoming' && (
              <Detail
                label="Saved on device"
                value={new Date(item.message.receivedAt).toLocaleString()}
              />
            )}
            {item.message && (
              <Detail
                label="Transport"
                value={
                  item.message.transport === 'nip17'
                    ? 'NIP-17 encrypted chat'
                    : 'Legacy encrypted message'
                }
              />
            )}
            {item.mintUrl && <Detail label="Mint" value={item.mintUrl} />}
            {item.message && (
              <YStack gap="$1">
                <Text color="$gray10" fontSize="$2">
                  Message ID
                </Text>
                <Text selectable fontFamily="$mono" fontSize="$2">
                  {item.message.id}
                </Text>
              </YStack>
            )}
            {item.direction === 'outgoing' && item.message && (
              <Text color="$gray10" fontSize="$2">
                Sent to relay confirms relay publication. It does not confirm delivery or reading.
              </Text>
            )}
            {actionLabel && onAction && (
              <AppButton
                variant={item.requiresAction ? 'warning' : 'default'}
                emphasis="secondary"
                onPress={onAction}
              >
                {actionLabel}
              </AppButton>
            )}
          </YStack>
        )}
      </BottomSheetScrollView>
    </AppBottomSheet>
  );
});

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <YStack gap="$1">
      <Text color="$gray10" fontSize="$2">
        {label}
      </Text>
      <Text selectable>{value}</Text>
    </YStack>
  );
}
