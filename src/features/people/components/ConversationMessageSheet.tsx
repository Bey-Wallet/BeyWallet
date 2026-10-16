import React, { forwardRef, useEffect, useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { Text, YStack } from 'tamagui';
import AppBottomSheet, { type AppBottomSheetRef } from '~/shared/ui/AppBottomSheet';
import { ListTable, ListTableRow } from '~/shared/ui/ListTable';
import type { ConversationActivity } from '../conversationActivity';
import { ConversationItemCard } from './ConversationItemCard';

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
      await Clipboard.setStringAsync(
        item.kind === 'text'
          ? item.text
          : `${item.type}\n${primaryAmount ?? 'Amount unavailable'}\n${item.status}`,
      );
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
            <Text fontSize="$6" fontWeight="800">
              {item.kind === 'text' ? 'Message details' : 'Payment details'}
            </Text>
            <ConversationItemCard
              item={item}
              primaryAmount={primaryAmount}
              secondaryAmount={secondaryAmount}
            />
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
            <ListTable>
              <ListTableRow
                label={
                  copied ? 'Copied' : item.kind === 'text' ? 'Copy message' : 'Copy payment details'
                }
                labelColor="$color"
                isCopyable
                onCopy={() => void copy()}
                onPress={() => void copy()}
              />
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
              {item.message && <Detail label="Message ID" value={item.message.id} />}
              {actionLabel && onAction && (
                <ListTableRow
                  label={actionLabel}
                  labelColor={item.requiresAction ? '$buttonWarningSecondaryText' : '$color'}
                  onPress={onAction}
                  multiline
                />
              )}
            </ListTable>
            {item.direction === 'outgoing' && item.message && (
              <Text color="$gray10" fontSize="$2">
                Sent to relay confirms relay publication. It does not confirm delivery or reading.
              </Text>
            )}
          </YStack>
        )}
      </BottomSheetScrollView>
    </AppBottomSheet>
  );
});

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <ListTableRow
      label={label}
      multiline
      value={
        <Text selectable maxWidth={200} textAlign="right" fontSize="$3" color="$color">
          {value}
        </Text>
      }
    />
  );
}
