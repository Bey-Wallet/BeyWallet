import React, { useEffect, useRef } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { useWindowDimensions } from 'react-native';
import { ClipboardCheck, Code2, Copy, HeartHandshake } from '@tamagui/lucide-icons';
import { ScrollView, Text, View, XStack, YStack } from 'tamagui';
import { appSpacing, appTypography } from '~/shared/theme/appearance';
import { AppButton } from '~/shared/ui/AppButton';
import { CustomQRCode } from '~/shared/ui/CustomQRCode';
import { isLightningAddress } from '~/services/api/lnurlService';
import { SUPPORT_LIGHTNING_ADDRESS } from './supporterPayment';
import { useAppToast } from '~/shared/hooks/useAppToast';

const supportAreas = [
  {
    icon: Code2,
    title: 'Time to build and maintain',
    description: 'Help developers improve Bey, fix bugs, and keep the wallet working well.',
  },
  {
    icon: ClipboardCheck,
    title: 'Care in the details',
    description: 'Make room for code reviews, device testing, accessibility, and clearer guides.',
  },
  {
    icon: HeartHandshake,
    title: 'A stronger open-source ecosystem',
    description:
      'Support the people building software everyone can inspect, learn from, and improve.',
  },
] as const;

export function SupporterContent({
  onPay,
  onDoNotShowAgain,
  bottomInset = 0,
}: {
  onPay: () => void;
  onDoNotShowAgain?: () => void;
  bottomInset?: number;
}) {
  const { width } = useWindowDimensions();
  const toast = useAppToast();
  const opening = useRef(false);
  const focused = useIsFocused();
  useEffect(() => {
    if (focused) opening.current = false;
  }, [focused]);
  const address = SUPPORT_LIGHTNING_ADDRESS;
  const available = isLightningAddress(address);
  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <YStack px="$4" pt="$4" pb={appSpacing.large + bottomInset} gap="$5">
        <YStack gap="$3">
          <View
            width={56}
            height={56}
            rounded="$6"
            bg="$gray3"
            items="center"
            justify="center"
            aria-hidden
          >
            <HeartHandshake size={28} color="$color" strokeWidth={1.6} />
          </View>
          <Text
            {...appTypography.title2}
            fontFamily="$heading"
            color="$color"
            accessibilityRole="header"
          >
            Built in the open.{'\n'}Supported by people.
          </Text>
          <Text {...appTypography.body2} color="$gray10">
            Free software takes real work. Behind every release are people writing code,
            investigating bugs, and making everyday experiences better.
          </Text>
          <Text {...appTypography.body2} color="$gray10">
            Your support helps fund that ongoing work, giving developers more time to care for the
            wallet and contribute to the open-source tools it relies on.
          </Text>
        </YStack>
        <YStack bg="$buttonDefaultSecondary" rounded="$6" p="$4" gap="$4">
          {available ? (
            <YStack items="center" gap="$3">
              <YStack
                accessibilityRole="image"
                accessibilityLabel={`Lightning address QR: ${address}`}
              >
                <CustomQRCode
                  value={`lightning:${address}`}
                  size={Math.min(320, Math.max(120, width - 64))}
                  dotShape="square"
                  finderStyle="square"
                />
              </YStack>
              <Text {...appTypography.label2} color="$color" textAlign="center" selectable>
                {address}
              </Text>
              <AppButton
                variant="default"
                emphasis="text"
                icon={Copy}
                onPress={async () => {
                  await toast.copy(address);
                }}
              >
                Copy
              </AppButton>
            </YStack>
          ) : (
            <Text {...appTypography.body3} color="$gray10" textAlign="center">
              Support payments are not available yet.
            </Text>
          )}
          <YStack gap="$2" items="center">
            <AppButton
              variant="default"
              emphasis="primary"
              size="medium"
              fullWidth={false}
              disabled={!available}
              onPress={() => {
                if (!available || opening.current) return;
                opening.current = true;
                onPay();
              }}
            >
              Pay now
            </AppButton>
            <Text {...appTypography.body3} color="$gray10" textAlign="center">
              One-time support. No subscription.
            </Text>
          </YStack>
        </YStack>
        <YStack gap="$3">
          <Text {...appTypography.label2} color="$color" accessibilityRole="header">
            What your support could help with
          </Text>
          <YStack bg="$buttonDefaultSecondary" rounded="$6" overflow="hidden">
            {supportAreas.map(({ icon: Icon, title, description }, index) => (
              <React.Fragment key={title}>
                {index > 0 && <View height={2} width="100%" bg="$background" />}
                <XStack px="$4" py="$3" gap="$3" items="flex-start">
                  <View width={22} pt={2} items="center" aria-hidden>
                    <Icon size={20} color="$iconSecondary" strokeWidth={1.8} />
                  </View>
                  <YStack flex={1} gap="$1">
                    <Text {...appTypography.label2} color="$color">
                      {title}
                    </Text>
                    <Text {...appTypography.body3} color="$gray10">
                      {description}
                    </Text>
                  </YStack>
                </XStack>
              </React.Fragment>
            ))}
          </YStack>
        </YStack>
        <YStack gap="$2">
          <Text {...appTypography.label2} color="$color" accessibilityRole="header">
            Always optional. Still your wallet.
          </Text>
          <Text {...appTypography.body2} color="$gray10">
            Sending, receiving, recovery, and security stay available to everyone. Supporting Bey is
            a choice, with no change to how you use your money.
          </Text>
        </YStack>
        {onDoNotShowAgain && (
          <AppButton variant="default" emphasis="text" onPress={onDoNotShowAgain}>
            Do not show again
          </AppButton>
        )}
      </YStack>
    </ScrollView>
  );
}
