import React, { forwardRef, useEffect, useRef, useState } from 'react';
import { usePreventRemove } from '@react-navigation/native';
import { Text, YStack } from 'tamagui';
import { BUISheet, BUISheetInput, type BUISheetRef } from '~/shared/ui/BUI/BUISheet';
import { AppButton } from '~/shared/ui/AppButton';
import { appSpacing, appTypography } from '~/shared/theme/appearance';
import type { BUIAppearance } from '~/state/buiStore';
import type { ChatMessage } from '~/storage/sqlite/repositories/MessageRepository';
import { nostrService } from '~/services/wallet/nostrService';
import { cleanToken } from '~/services/wallet/tokenUtils';

export const TokenNostrSheet = forwardRef<
  BUISheetRef,
  {
    token: string;
    disabled: boolean;
    appearance: BUIAppearance;
    onBusyChange: (busy: boolean) => void;
  }
>(function TokenNostrSheet({ token, disabled, appearance, onBusyChange }, ref) {
  const [recipient, setRecipient] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const queued = useRef<ChatMessage | null>(null);
  const lock = useRef(false);
  usePreventRemove(sending, () => {});
  useEffect(() => {
    setRecipient('');
    setSent(false);
    setError('');
    queued.current = null;
  }, [token]);
  const send = async () => {
    if (disabled || sent || lock.current || !recipient.trim() || !token) return;
    lock.current = true;
    setSending(true);
    onBusyChange(true);
    setError('');
    try {
      if (queued.current) await nostrService.retryChat(queued.current);
      else
        await nostrService.sendChat(recipient.trim(), `cashu:${cleanToken(token)}`, (message) => {
          queued.current = message;
        });
      setSent(true);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not deliver this payment. Try again.',
      );
    } finally {
      lock.current = false;
      setSending(false);
      onBusyChange(false);
    }
  };
  return (
    <BUISheet ref={ref} title="Send via Nostr" appearance={appearance} canDismiss={!sending}>
      <YStack px={appSpacing.page} gap={appSpacing.gap}>
        <Text {...appTypography.body2} color="$gray10">
          Deliver this existing ecash to a Nostr recipient. The payment stays pending until claimed.
        </Text>
        <BUISheetInput
          label="Recipient"
          value={recipient}
          onChangeText={setRecipient}
          placeholder="npub, nprofile or public key"
          accessibilityLabel="Nostr recipient"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!sending && !sent && !queued.current}
        />
        {!!error && (
          <Text {...appTypography.body2} color="$red10" accessibilityRole="alert">
            {error}
          </Text>
        )}
        {sent && (
          <Text {...appTypography.body2} color="$gray10" accessibilityLiveRegion="polite">
            Delivered to relays. This does not confirm the recipient has claimed it.
          </Text>
        )}
        <AppButton
          variant="accent"
          emphasis="primary"
          fullWidth
          loading={sending}
          loadingText="Delivering ecash…"
          disabled={disabled || sent || !recipient.trim()}
          onPress={send}
        >
          {sent ? 'Delivered' : queued.current ? 'Retry delivery' : 'Send ecash'}
        </AppButton>
      </YStack>
    </BUISheet>
  );
});
