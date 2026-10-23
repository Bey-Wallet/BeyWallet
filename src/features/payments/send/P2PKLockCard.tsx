import React, { useCallback, useId, useRef, useState } from 'react';
import { Keyboard } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { Text, XStack, YStack, useTheme } from 'tamagui';
import { ClipboardPaste, ScanLine } from '@tamagui/lucide-icons';
import * as Clipboard from 'expo-clipboard';
import AppBottomSheet, { type AppBottomSheetRef } from '~/shared/ui/AppBottomSheet';
import { AppButton } from '~/shared/ui/AppButton';
import { AppSwitch } from '~/shared/ui/AppSwitch';
import { ListTable, ListTableRow } from '~/shared/ui/ListTable';
import { normalizeP2PKRecipient } from '~/services/wallet/p2pkRecipient';
import { useP2PKScanStore } from '~/state/p2pkScanStore';

export function P2PKLockCard({
  enabled,
  onEnabledChange,
  publicKey,
  onKeyChange,
  disabled,
  offline,
}: {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  publicKey: string;
  onKeyChange: (key: string) => void;
  disabled?: boolean;
  offline?: boolean;
}) {
  const sheet = useRef<AppBottomSheetRef>(null);
  const scanning = useRef(false);
  const scanId = useId();
  const [draft, setDraft] = useState('');
  const [inputError, setInputError] = useState('');
  const theme = useTheme();
  const router = useRouter();
  let normalized: string | undefined;
  try {
    normalized = normalizeP2PKRecipient(draft);
  } catch {
    /* Keep incomplete input editable. */
  }

  useFocusEffect(
    useCallback(() => {
      if (!scanning.current) return;
      scanning.current = false;
      const store = useP2PKScanStore.getState();
      if (store.result?.id === scanId) {
        setDraft(store.result.value);
        store.setResult(null);
      }
      setInputError('');
      const frame = requestAnimationFrame(() => sheet.current?.present());
      return () => cancelAnimationFrame(frame);
    }, [scanId]),
  );

  const open = () => {
    if (disabled) return;
    setDraft(publicKey);
    setInputError('');
    sheet.current?.present();
  };
  const save = () => {
    if (!normalized || disabled || offline) return;
    onKeyChange(normalized);
    Keyboard.dismiss();
    sheet.current?.dismiss();
  };
  return (
    <>
      <ListTable compact>
        <ListTableRow
          label="P2PK lock"
          rightContent={
            <AppSwitch
              variant="branded"
              accessibilityLabel="Lock ecash to a public key"
              checked={enabled}
              disabled={disabled || (offline && !enabled)}
              onCheckedChange={(value) => {
                if (disabled || (offline && !enabled)) return;
                onEnabledChange(value);
                if (value && !publicKey) open();
              }}
            />
          }
        />
        {enabled && (
          <ListTableRow
            label="Public key"
            value={
              publicKey ? `${publicKey.slice(0, 12)}…${publicKey.slice(-8)}` : 'Set public key'
            }
            onPress={open}
            disabled={disabled}
          />
        )}
      </ListTable>
      {enabled && (
        <Text fontSize={13} fontWeight="400" color="$gray10">
          {offline
            ? 'Go online to create locked ecash.'
            : 'Locks this ecash to the recipient public key. Check the key before creating it.'}
        </Text>
      )}
      <AppBottomSheet ref={sheet} onClose={Keyboard.dismiss}>
        <YStack p="$4" gap="$3">
          <Text fontFamily="$body" fontSize={20} fontWeight="500" textAlign="center">
            Recipient public key
          </Text>
          <Text fontSize={13} fontWeight="400" color="$gray10">
            Hex public key (compressed, uncompressed, or x-only), npub, or nprofile.
          </Text>
          <BottomSheetTextInput
            accessibilityLabel="Recipient public key"
            value={draft}
            onChangeText={(value) => {
              setDraft(value);
              setInputError('');
            }}
            placeholder="Paste, scan, or type a public key"
            placeholderTextColor={theme.gray10.val}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={4096}
            multiline
            style={{
              color: theme.color.val,
              backgroundColor: theme.gray3.val,
              borderRadius: 12,
              padding: 16,
              fontSize: 14,
              fontFamily: 'BeyFunnelDisplayRegular',
              minHeight: 88,
              maxHeight: 160,
            }}
          />
          <XStack gap="$2">
            <AppButton
              variant="default"
              emphasis="secondary"
              flex={1}
              icon={ClipboardPaste}
              disabled={disabled}
              onPress={async () => {
                try {
                  setDraft((await Clipboard.getStringAsync()).trim());
                  setInputError('');
                } catch {
                  setInputError('Clipboard is unavailable. Type or scan the key.');
                }
              }}
            >
              Paste
            </AppButton>
            <AppButton
              variant="default"
              emphasis="secondary"
              flex={1}
              icon={ScanLine}
              disabled={disabled}
              onPress={() => {
                Keyboard.dismiss();
                sheet.current?.dismiss();
                useP2PKScanStore.getState().setResult(null);
                scanning.current = true;
                router.push({
                  pathname: '/(modals)/scanner',
                  params: { p2pkScanId: scanId },
                });
              }}
            >
              Scan
            </AppButton>
          </XStack>
          {(inputError || (draft.trim() && !normalized)) && (
            <Text accessibilityRole="alert" fontSize={13} color="$red10">
              {inputError || 'Enter a valid public key: hex, npub, or nprofile.'}
            </Text>
          )}
          <AppButton
            size="large"
            fullWidth
            disabled={!normalized || disabled || offline}
            onPress={save}
          >
            Use public key
          </AppButton>
        </YStack>
      </AppBottomSheet>
    </>
  );
}
