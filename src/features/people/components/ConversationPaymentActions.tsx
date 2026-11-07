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
    <XStack gap={appSpacing.compact} items="center" width="100%">
      <AppButton
        flex={1}
        fullWidth={false}
        variant="default"
        emphasis="secondary"
        size="large"
        accessibilityLabel="Request"
        disabled={disabled}
        onPress={() => {
          if (!disabled) onRequest();
        }}
      >
        Request
      </AppButton>
      <AppButton
        flex={1}
        fullWidth={false}
        variant="accent"
        emphasis="primary"
        size="large"
        accessibilityLabel="Pay"
        disabled={disabled}
        onPress={() => {
          if (!disabled) onPay();
        }}
      >
        Pay
      </AppButton>
    </XStack>
  );
}
