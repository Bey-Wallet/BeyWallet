import React, { useEffect, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, ArrowLeft } from '@tamagui/lucide-icons';
import { Text, XStack } from 'tamagui';
import { AppPressable } from '~/shared/ui/AppPressable';
import { AppIconButton } from '~/shared/ui/AppIconButton';
import { appTypography } from '~/shared/theme/appearance';

export type ConversationPaymentMethod = 'ecash' | 'lightning';

export function ConversationPaymentActions({
  disabled,
  hasLightningAddress,
  onSend,
  onRequest,
}: {
  disabled: boolean;
  hasLightningAddress: boolean;
  onSend: (method: ConversationPaymentMethod) => void;
  onRequest: (method: ConversationPaymentMethod) => void;
}) {
  const [action, setAction] = useState<'send' | 'request' | null>(null);
  useEffect(() => {
    if (disabled) setAction(null);
  }, [disabled]);
  const choose = (method: ConversationPaymentMethod) => {
    if (disabled || (action === 'send' && method === 'lightning' && !hasLightningAddress)) return;
    setAction(null);
    (action === 'send' ? onSend : onRequest)(method);
  };
  const pill = (
    label: string,
    accessibilityLabel: string,
    Icon: typeof ArrowDownLeft | undefined,
    onPress: () => void,
  ) => (
    <AppPressable
      key={label}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={disabled}
      minHeight={48}
      minWidth={64}
      flex={1}
      px="$4"
      py="$2"
      rounded={999}
      bg="$buttonDefaultSecondary"
      hoverStyle={{ bg: '$buttonDefaultSecondaryHover' }}
      pressStyle={{ bg: '$buttonDefaultSecondaryPress' }}
      opacity={disabled ? 0.5 : 1}
      flexDirection="row"
      items="center"
      justify="center"
      gap="$2"
      onPress={() => {
        if (!disabled) onPress();
      }}
    >
      {Icon && <Icon size={20} color="$gray10" />}
      <Text {...appTypography.body1} fontWeight="500" color="$gray10" flexShrink={1}>
        {label}
      </Text>
    </AppPressable>
  );
  return (
    <XStack gap="$2" items="center" width="100%">
      {action ? (
        <>
          <AppIconButton
            size="small"
            shape="circular"
            emphasis="secondary"
            accessibilityLabel="Back to Send and Request"
            icon={ArrowLeft}
            onPress={() => setAction(null)}
          />
          {pill('Ecash', `${action === 'send' ? 'Send' : 'Request'} Ecash`, undefined, () =>
            choose('ecash'),
          )}
          {(action === 'request' || hasLightningAddress) &&
            pill(
              'Lightning',
              `${action === 'send' ? 'Send' : 'Request'} Lightning`,
              undefined,
              () => choose('lightning'),
            )}
        </>
      ) : (
        <>
          {pill('Request', 'Request money', ArrowDownLeft, () => setAction('request'))}
          {pill('Send', 'Send money', ArrowUpRight, () => {
            if (hasLightningAddress) setAction('send');
            else onSend('ecash');
          })}
        </>
      )}
    </XStack>
  );
}
