import React, { useState } from 'react';
import { Keyboard } from 'react-native';
import { Code2, HeartHandshake, ShieldCheck } from '@tamagui/lucide-icons';
import { Input, ScrollView, Text, View, XStack, YStack } from 'tamagui';
import { appTypography } from '~/shared/theme/appearance';
import { AppButton } from '~/shared/ui/AppButton';

const supportAreas = [
  {
    icon: Code2,
    title: 'Time to build and maintain',
    description: 'Help developers improve Bey, fix bugs, and keep the wallet working well.',
  },
  {
    icon: ShieldCheck,
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

const mockPlans = [
  {
    id: 'monthly',
    title: 'Monthly',
    price: '$3',
    period: '/ month',
    note: 'Support a little each month',
    button: 'Preview monthly support',
  },
  {
    id: 'yearly',
    title: 'Yearly',
    price: '$30',
    period: '/ year',
    note: 'Equivalent to $2.50 per month',
    button: 'Preview yearly support',
  },
] as const;

export function SupporterContent({
  onClose,
  onDoNotShowAgain,
}: {
  onClose: () => void;
  onDoNotShowAgain?: () => void;
}) {
  const [selectedPlan, setSelectedPlan] = useState<(typeof mockPlans)[number]['id'] | null>(null);
  const [donationAmount, setDonationAmount] = useState('');
  const [donationPreview, setDonationPreview] = useState<string | null>(null);
  const normalizedDonation = donationAmount.trim().replace(',', '.');
  const donationValue = Number(normalizedDonation);
  const validDonation =
    /^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/.test(normalizedDonation) && donationValue > 0;

  return (
    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <YStack px="$4" pt="$4" pb="$6" gap="$5">
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
            A Bey supporter membership could help fund that ongoing work, giving developers more
            time to care for the wallet and contribute to the open-source tools it relies on.
          </Text>
        </YStack>

        <YStack gap="$3">
          <Text {...appTypography.label2} color="$color" accessibilityRole="header">
            Choose how you’d like to support
          </Text>
          <Text {...appTypography.body3} color="$gray10">
            Mock pricing · USD · Nothing will be charged
          </Text>
          <YStack bg="$buttonDefaultSecondary" rounded="$6" overflow="hidden">
            {mockPlans.map((plan, index) => (
              <React.Fragment key={plan.id}>
                {index > 0 && <View height={2} width="100%" bg="$background" />}
                <YStack p="$4" gap="$3">
                  <XStack items="center" justify="space-between" gap="$3" flexWrap="wrap">
                    <Text {...appTypography.label2} color="$color">
                      {plan.title}
                    </Text>
                    <XStack items="baseline" gap="$1">
                      <Text {...appTypography.title2} fontFamily="$heading" color="$color">
                        {plan.price}
                      </Text>
                      <Text {...appTypography.body3} color="$gray10">
                        {plan.period}
                      </Text>
                    </XStack>
                  </XStack>
                  <Text {...appTypography.body3} color="$gray10">
                    {plan.note}
                  </Text>
                  <AppButton
                    variant={selectedPlan === plan.id ? 'branded' : 'default'}
                    emphasis={selectedPlan === plan.id ? 'primary' : 'secondary'}
                    onPress={() => {
                      Keyboard.dismiss();
                      setSelectedPlan(plan.id);
                      setDonationPreview(null);
                    }}
                    accessibilityState={{ selected: selectedPlan === plan.id }}
                  >
                    {selectedPlan === plan.id ? 'Selected · Preview only' : plan.button}
                  </AppButton>
                </YStack>
              </React.Fragment>
            ))}
          </YStack>
          {selectedPlan && (
            <Text {...appTypography.body3} color="$gray10" accessibilityLiveRegion="polite">
              {selectedPlan === 'monthly' ? 'Monthly' : 'Yearly'} support preview selected. No
              payment was made and no membership was activated.
            </Text>
          )}
          <YStack bg="$buttonDefaultSecondary" rounded="$6" p="$4" gap="$3">
            <Text {...appTypography.label2} color="$color">
              Or give once
            </Text>
            <Text {...appTypography.body3} color="$gray10">
              Choose your own amount. A one-time donation with no renewal or subscription.
            </Text>
            <XStack items="center" gap="$3">
              <Text {...appTypography.label2} color="$color">
                USD $
              </Text>
              <Input
                flex={1}
                minWidth={0}
                minHeight={48}
                value={donationAmount}
                onChangeText={(value) => {
                  setDonationAmount(value);
                  setDonationPreview(null);
                }}
                placeholder="0.00"
                keyboardType="decimal-pad"
                inputMode="decimal"
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
                autoCorrect={false}
                maxLength={12}
                accessibilityLabel="One-time donation amount in US dollars"
              />
            </XStack>
            {normalizedDonation !== '' && !validDonation && (
              <Text {...appTypography.body3} color="$red10" accessibilityLiveRegion="polite">
                Enter an amount greater than zero, with up to two decimal places.
              </Text>
            )}
            <AppButton
              disabled={!validDonation}
              onPress={() => {
                if (!validDonation) return;
                Keyboard.dismiss();
                setSelectedPlan(null);
                setDonationPreview(donationValue.toFixed(2));
              }}
            >
              Preview one-time donation
            </AppButton>
            {donationPreview && (
              <Text {...appTypography.body3} color="$gray10" accessibilityLiveRegion="polite">
                ${donationPreview} one-time donation preview. No payment was made and nothing will
                recur.
              </Text>
            )}
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
            Sending, receiving, recovery, and security stay available to everyone. Supporting Bey
            would be a choice, with no change to how you use your money.
          </Text>
        </YStack>

        <YStack gap="$1">
          <Text {...appTypography.label3} color="$gray10">
            Membership preview
          </Text>
          <Text {...appTypography.body3} color="$gray10">
            We’re exploring this idea. Memberships and payments aren’t available yet.
          </Text>
        </YStack>
        <AppButton onPress={onClose}>Back to wallet</AppButton>
        {onDoNotShowAgain && (
          <YStack gap="$1">
            <AppButton variant="default" emphasis="text-only" onPress={onDoNotShowAgain}>
              Do not show again
            </AppButton>
            <Text {...appTypography.body3} color="$gray10" textAlign="center">
              Hide this card from Home. Support Bey stays available in Settings.
            </Text>
          </YStack>
        )}
      </YStack>
    </ScrollView>
  );
}
