import React from 'react';
import { Separator, XStack, YStack } from 'tamagui';
import { AppButton } from '~/shared/ui/AppButton';
import { AppText } from '~/shared/ui/AppText';
import { BUISelectionRow } from '~/shared/ui/BUI/BUISelectionControl';
import { BUIAppearanceProvider, useBUIOverlayAppearance } from '~/shared/ui/BUI/useBUITheme';
import { appSpacing } from '~/shared/theme/appearance';
import { Check, Info, Landmark, ShieldCheck, TriangleAlert } from '~/shared/icons';

const mintRisks = [
  {
    text: 'The mint holds the bitcoin backing your ecash.',
    plural: 'Mints hold the bitcoin backing the ecash they issue.',
    Icon: Landmark,
    color: '$iconSecondary',
  },
  {
    text: 'You could lose funds if the mint closes or refuses to redeem.',
    plural: 'You could lose funds if a mint closes or refuses to redeem.',
    Icon: TriangleAlert,
    color: '$orange10',
  },
  {
    text: 'Only add mints you trust. Discovery isn’t an endorsement.',
    plural: undefined,
    Icon: ShieldCheck,
    color: '$green10',
  },
  {
    text: 'Bey doesn’t run this mint or cover losses.',
    plural: 'Bey doesn’t run these mints or cover losses.',
    Icon: Info,
    color: '$iconSecondary',
  },
] as const;

/** Shared risk review for onboarding selection and an individual mint connection. */
export function MintTrustContent({
  mints,
  acknowledgment,
  onConfirm,
  busy = false,
  error,
  identity,
}: {
  mints: { url: string; name?: string }[];
  acknowledgment?: { checked: boolean; onCheckedChange: (checked: boolean) => void };
  onConfirm: () => void | Promise<void>;
  busy?: boolean;
  error?: string | null;
  identity?: React.ReactNode;
}) {
  const appearance = useBUIOverlayAppearance();
  const multiple = mints.length > 1;
  const canConfirm = !busy && mints.length > 0 && (!acknowledgment || acknowledgment.checked);
  return (
    <BUIAppearanceProvider value={appearance}>
      <YStack gap={appSpacing.gap}>
        {identity ?? (
          <XStack flexWrap="wrap" gap="$2">
            {mints.map((mint) => (
              <XStack
                key={mint.url}
                bg="$accentColor"
                rounded="$10"
                px="$3"
                py="$2"
                maxWidth="100%"
              >
                <AppText variant="label2" color="$onAccent" numberOfLines={1} flexShrink={1}>
                  {mint.name || mint.url}
                </AppText>
              </XStack>
            ))}
          </XStack>
        )}
        <YStack bg="$gray2" rounded="$6" overflow="hidden">
          {mintRisks.map(({ text, plural, Icon, color }, index) => (
            <React.Fragment key={text}>
              {index > 0 && <Separator borderWidth={0} height={2} bg="$background" />}
              <XStack px="$3" py="$2" gap={appSpacing.compact} items="flex-start">
                <Icon size={18} weight="fill" color={color} flexShrink={0} aria-hidden />
                <AppText variant="body2" flex={1}>
                  {(multiple && plural) || text}
                </AppText>
              </XStack>
            </React.Fragment>
          ))}
          <Separator borderWidth={0} height={2} bg="$background" />
          {acknowledgment ? (
            <YStack px="$3">
              <BUISelectionRow
                compact
                kind="checkbox"
                label={
                  multiple
                    ? 'I acknowledge the risks and trust each mint operator.'
                    : 'I acknowledge the risks and trust this mint’s operator.'
                }
                checked={acknowledgment.checked}
                disabled={busy}
                onCheckedChange={acknowledgment.onCheckedChange}
              />
            </YStack>
          ) : (
            <XStack px="$3" py="$2" gap={appSpacing.compact} items="flex-start">
              <YStack width={18} items="center">
                <Check size={14} weight="bold" color="$gray10" aria-hidden />
              </YStack>
              <AppText variant="body3" color="$gray10" flex={1}>
                By adding this mint, you acknowledge the risks and confirm you trust its operator.
              </AppText>
            </XStack>
          )}
        </YStack>
        {error && (
          <AppText tone="error" accessibilityRole="alert">
            {error}
          </AppText>
        )}
        <AppButton
          haptic
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
    </BUIAppearanceProvider>
  );
}
