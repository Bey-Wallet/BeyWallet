import React, { useState } from 'react';
import { ScrollView, XStack, YStack } from 'tamagui';
import { ExternalLink, FileText, Key, Landmark, Lock, Sprout } from '@tamagui/lucide-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BUIHeader } from '~/shared/ui/BUI/BUIHeader';
import { BUISelectionRow } from '~/shared/ui/BUI/BUISelectionControl';
import { AppButton } from '~/shared/ui/AppButton';
import { AppPressable } from '~/shared/ui/AppPressable';
import { AppText } from '~/shared/ui/AppText';
import { useAppToast } from '~/shared/hooks/useAppToast';
import { appBorders, appSpacing } from '~/shared/theme/appearance';

interface ConsentStepProps {
  onComplete: () => void;
  onBack: () => void;
  isBusy?: boolean;
}

const risks = [
  {
    icon: Lock,
    title: 'You hold the ecash',
    description:
      'Your wallet stores ecash tokens and keys on this device. Bey does not hold the backing Bitcoin.',
  },
  {
    icon: Landmark,
    title: 'Your mint holds the Bitcoin',
    description:
      'You rely on your mint to redeem ecash. If it shuts down or refuses redemption, you could lose your funds.',
  },
  {
    icon: Key,
    title: 'Backups have limits',
    description:
      'Keep your 12 words and a current backup file private. Seed recovery depends on mint support and availability and may not restore every token. Backups cannot recover funds from a failed mint.',
  },
  {
    icon: Sprout,
    title: 'Keep small balances',
    description: 'Cashu is experimental. Avoid storing large balances in ecash.',
  },
];

export function ConsentStep({ onComplete, onBack, isBusy = false }: ConsentStepProps) {
  const toast = useAppToast();
  const insets = useSafeAreaInsets();
  const [checked, setChecked] = useState(false);

  const handleOpenTerms = () => {
    void toast.openExternal('http://bey.cash/privacy-policy');
  };

  return (
    <YStack flex={1} bg="$background" pb={insets.bottom}>
      <BUIHeader
        title="Risk acknowledgment"
        navigation="back"
        topInset={insets.top}
        navigationDisabled={isBusy}
        onNavigate={() => {
          if (!isBusy) onBack();
        }}
      />
      <ScrollView
        flex={1}
        minHeight={0}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'flex-end',
          padding: appSpacing.page,
          paddingBottom: appSpacing.small,
        }}
      >
        <YStack bg="$gray2" rounded="$6" overflow="hidden" flexShrink={0}>
          {risks.map(({ icon: Icon, title, description }, index) => (
            <React.Fragment key={title}>
              {index > 0 && <YStack height={appBorders.separator} bg="$background" />}
              <XStack p={appSpacing.page} gap={appSpacing.gap} minHeight={48} items="flex-start">
                <XStack width={22} flexShrink={0} items="center" justify="center">
                  <Icon size={22} color="$iconSecondary" />
                </XStack>
                <YStack flex={1} minWidth={0} gap="$1">
                  <AppText variant="label1">{title}</AppText>
                  <AppText variant="body2" tone="secondary">
                    {description}
                  </AppText>
                </YStack>
              </XStack>
            </React.Fragment>
          ))}
          <YStack height={appBorders.separator} bg="$background" />
          <AppPressable
            accessibilityRole="link"
            accessibilityLabel="Read Terms and Privacy"
            disabled={isBusy}
            minHeight={48}
            p={appSpacing.page}
            flexDirection="row"
            items="center"
            gap={appSpacing.gap}
            pressStyle={{ bg: '$gray3' }}
            onPress={handleOpenTerms}
          >
            <FileText size={22} color="$iconSecondary" />
            <AppText variant="label1" flex={1}>
              Terms & Privacy
            </AppText>
            <ExternalLink size={18} color="$gray10" />
          </AppPressable>
        </YStack>
      </ScrollView>
      <YStack
        flexShrink={0}
        gap={appSpacing.small}
        px={appSpacing.page}
        py={appSpacing.gap}
        bg="$background"
      >
        <BUISelectionRow
          compact
          kind="checkbox"
          label="I accept the risks and Terms."
          checked={checked}
          disabled={isBusy}
          onCheckedChange={setChecked}
        />
        <AppButton
          haptic
          size="large"
          fullWidth
          disabled={!checked || isBusy}
          loading={isBusy}
          loadingText="Continuing…"
          onPress={() => {
            if (checked && !isBusy) onComplete();
          }}
        >
          Agree & Continue
        </AppButton>
      </YStack>
    </YStack>
  );
}
