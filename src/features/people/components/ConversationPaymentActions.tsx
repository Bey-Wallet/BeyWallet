import React from 'react';
import { XStack } from 'tamagui';
import { AppButton } from '~/shared/ui/AppButton';
import { appSpacing } from '~/shared/theme/appearance';

export function ConversationPaymentActions({
  disabled,
  onPay,
  onRequest,
}: {
  disabled: boolean;
  onPay: () => void;
  onRequest: () => void;
}) {
  return (
    <XStack gap={appSpacing.compact} items="center" justify="center" width="100%" flexWrap="wrap">
      <AppButton
        fullWidth={false}
        variant="default"
        emphasis="secondary"
        size="small"
        accessibilityLabel="Request"
        disabled={disabled}
        onPress={() => {
          if (!disabled) onRequest();
        }}
      >
        Request
      </AppButton>
      <AppButton
        fullWidth={false}
        variant="default"
        emphasis="secondary"
        size="small"
        accessibilityLabel="Send"
        disabled={disabled}
        onPress={() => {
          if (!disabled) onPay();
        }}
      >
        Send
      </AppButton>
    </XStack>
  );
}
