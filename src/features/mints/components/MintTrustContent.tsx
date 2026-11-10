import React from 'react';
import { Separator, XStack, YStack } from 'tamagui';
import { AppButton } from '~/shared/ui/AppButton';
import { AppText } from '~/shared/ui/AppText';
import { BUISelectionRow } from '~/shared/ui/BUI/BUISelectionControl';
import { appSpacing } from '~/shared/theme/appearance';

/** Shared risk review for onboarding selection and an individual mint connection. */
export function MintTrustContent({
  mints,
  acknowledgment,
  onConfirm,
  busy = false,
  error,
  children,
  identity,
}: {
  mints: { url: string; name?: string }[];
  acknowledgment?: { checked: boolean; onCheckedChange: (checked: boolean) => void };
  onConfirm: () => void | Promise<void>;
  busy?: boolean;
  error?: string | null;
  children?: React.ReactNode;
  identity?: React.ReactNode;
}) {
  const canConfirm = !busy && mints.length > 0 && (!acknowledgment || acknowledgment.checked);
  return (
    <YStack gap={appSpacing.group}>
      {identity ?? (
        <XStack flexWrap="wrap" gap="$2">
          {mints.map((mint) => (
            <XStack key={mint.url} bg="$gray2" rounded="$10" px="$3" py="$2" maxWidth="100%">
              <AppText variant="label2">{mint.name || mint.url}</AppText>
            </XStack>
          ))}
        </XStack>
      )}
      <YStack bg="$gray2" rounded="$6" overflow="hidden">
        {[
          'These mints hold the bitcoin backing your ecash.',
          'You rely on each operator to redeem your ecash. If a mint shuts down or refuses redemption, you could lose your funds.',
          'Only connect to mints you trust. Discovery is not an endorsement.',
          'Bey Wallet does not operate these mints and is not responsible for losses they cause.',
        ].map((risk, index) => (
          <React.Fragment key={risk}>
            {index > 0 && <Separator borderWidth={0} height={2} bg="$background" />}
            <AppText p="$3">{risk}</AppText>
          </React.Fragment>
        ))}
      </YStack>
      {acknowledgment && (
        <BUISelectionRow
          kind="checkbox"
          label={
            mints.length === 1
              ? 'I understand the risks and trust this mint.'
              : 'I understand the risks and trust all selected mints.'
          }
          checked={acknowledgment.checked}
          disabled={busy}
          onCheckedChange={acknowledgment.onCheckedChange}
        />
      )}
      {children}
      {error && (
        <AppText tone="error" accessibilityRole="alert">
          {error}
        </AppText>
      )}
      <AppButton
        size="large"
        emphasis="primary"
        disabled={!canConfirm}
        loading={busy}
        loadingText="Connecting to mint…"
        onPress={() => {
          if (canConfirm) return onConfirm();
        }}
      >
        Confirm add
      </AppButton>
    </YStack>
  );
}
