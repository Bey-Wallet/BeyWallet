import React, { forwardRef, useEffect, useRef, useState } from 'react';
import { useWindowDimensions, type TextInput as NativeTextInput } from 'react-native';
import { TextInput } from 'react-native-gesture-handler';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { ArrowLeft, Copy, Info, RefreshCw, TextSelect, X } from '@tamagui/lucide-icons';
import { Text, XStack, YStack, useTheme } from 'tamagui';
import { AppButton } from '~/shared/ui/AppButton';
import AppBottomSheet, { type AppBottomSheetRef } from '~/shared/ui/AppBottomSheet';
import { HeaderIconButton } from '~/shared/ui/HeaderIconButton';
import { ListTable, ListTableRow } from '~/shared/ui/ListTable';
import { useAppToast } from '~/shared/hooks/useAppToast';
import type { ConversationActivity } from '../conversationActivity';

export const ConversationMessageActions = forwardRef<
  AppBottomSheetRef,
  {
    item: ConversationActivity | null;
    primaryAmount?: string;
    bottomInset: number;
    onClose: () => void;
    onDetails: () => void;
    retryLabel?: string;
    onRetry?: () => void;
  }
>(function ConversationMessageActions(
  { item, primaryAmount, bottomInset, onClose, onDetails, retryLabel, onRetry },
  ref,
) {
  const [selecting, setSelecting] = useState(false);
  const selectionInput = useRef<NativeTextInput>(null);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const theme = useTheme();
  useEffect(() => setSelecting(false), [item?.id]);
  const toast = useAppToast();
  const { height } = useWindowDimensions();
  const copy = async () => {
    if (!item) return;
    await toast.copy(
      item.kind === 'text'
        ? item.text
        : `${item.type || 'Payment'}\n${primaryAmount ?? 'Amount unavailable'}\n${item.status}`,
    );
    onClose();
  };
  return (
    <AppBottomSheet
      ref={ref}
      backgroundColor="$background"
      bottomInset={bottomInset}
      scrollable
      maxDynamicContentSize={height * 0.8}
      onClose={() => setSelecting(false)}
    >
      <BottomSheetScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, paddingBottom: Math.max(bottomInset, 16) }}
      >
        {item && (
          <YStack gap="$3">
            <XStack items="center" gap="$2">
              <HeaderIconButton
                icon={selecting ? ArrowLeft : X}
                accessibilityLabel={selecting ? 'Back to message actions' : 'Close message actions'}
                onPress={() => (selecting ? setSelecting(false) : onClose())}
              />
              <Text fontSize={14} fontWeight="600">
                {selecting
                  ? 'Select text'
                  : item.kind === 'text'
                    ? 'Message actions'
                    : 'Payment actions'}
              </Text>
            </XStack>
            {selecting && item.kind === 'text' ? (
              <YStack gap="$3" px="$2">
                <Text color="$gray10" fontSize={11}>
                  Drag the selection handles to choose text, then copy it.
                </Text>
                <TextInput
                  ref={selectionInput as React.Ref<React.ComponentType<any>>}
                  disallowInterruption
                  autoFocus
                  multiline
                  selectTextOnFocus
                  showSoftInputOnFocus={false}
                  inputMode="none"
                  caretHidden
                  contextMenuHidden={false}
                  value={item.text}
                  onChangeText={() => selectionInput.current?.setNativeProps({ text: item.text })}
                  onSelectionChange={(event) => setSelection(event.nativeEvent.selection)}
                  style={{
                    color: String(theme.color.val),
                    fontFamily: 'InterTextRegular',
                    fontSize: 14,
                    lineHeight: 21,
                    minHeight: 48,
                    maxHeight: height * 0.4,
                    padding: 0,
                  }}
                  accessibilityLabel="Selectable message text"
                />
                <AppButton
                  variant="default"
                  emphasis="secondary"
                  disabled={selection.end <= selection.start}
                  onPress={() => void toast.copy(item.text.slice(selection.start, selection.end))}
                >
                  Copy selected text
                </AppButton>
              </YStack>
            ) : (
              <ListTable>
                <ListTableRow
                  label={item.kind === 'text' ? 'Copy message' : 'Copy payment details'}
                  icon={Copy}
                  onPress={() => void copy()}
                />
                {item.kind === 'text' && (
                  <ListTableRow
                    label="Select text"
                    icon={TextSelect}
                    onPress={() => {
                      setSelection({ start: 0, end: item.text.length });
                      setSelecting(true);
                    }}
                  />
                )}
                <ListTableRow
                  label={item.kind === 'text' ? 'Message details' : 'Payment details'}
                  icon={Info}
                  onPress={onDetails}
                />
                {retryLabel && onRetry && (
                  <ListTableRow
                    label={retryLabel}
                    icon={RefreshCw}
                    onPress={() => {
                      onClose();
                      onRetry();
                    }}
                  />
                )}
              </ListTable>
            )}
          </YStack>
        )}
      </BottomSheetScrollView>
    </AppBottomSheet>
  );
});
