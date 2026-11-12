import { BUIHeader } from '~/shared/ui/BUI/BUIHeader';
import { AppButton } from '~/shared/ui/AppButton';
import React, { useState } from 'react';
import { YStack, XStack, Text, View, ScrollView, Separator } from 'tamagui';
import {
  Lock,
  Key,
  AlertTriangle,
  FileText,
  ChevronRight,
  Check,
  Landmark,
  Sprout,
} from '@tamagui/lucide-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppToast } from '~/shared/hooks/useAppToast';

interface ConsentStepProps {
  onComplete: () => void;
  onBack: () => void;
  isBusy?: boolean;
}

export function ConsentStep({ onComplete, onBack, isBusy = false }: ConsentStepProps) {
  const toast = useAppToast();
  const insets = useSafeAreaInsets();
  const [checked, setChecked] = useState(false);

  const handleContinue = () => {
    if (!checked || isBusy) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onComplete();
  };

  const handleOpenTerms = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void toast.openExternal('http://bey.cash/privacy-policy');
  };

  return (
    <YStack flex={1} bg="$background" style={{ paddingBottom: insets.bottom }}>
      <BUIHeader
        title="Risk Acknowledgment"
        navigation="back"
        topInset={insets.top}
        navigationDisabled={isBusy}
        onNavigate={() => {
          if (isBusy) return;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onBack();
        }}
      />

      <ScrollView
        flex={1}
        px="$4"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end', paddingBottom: 20 }}
      >
        <YStack gap="$6" flexShrink={0}>
          {/* Single unified list card container */}
          <YStack
            bg="$gray2"
            rounded="$6"
            overflow="hidden"
            borderWidth={0}
            separator={<Separator borderColor="$borderColor" opacity={0.4} />}
          >
            {/* Row 1: Only you control your funds */}
            <XStack gap="$3" p="$3" items="center">
              <View width={42} height={42} rounded="$3" bg="$blue3" items="center" justify="center">
                <Lock size={20} color="$blue10" />
              </View>
              <YStack flex={1} gap="$1">
                <Text fontWeight="800" fontSize="$4" color="$color">
                  Only you control your funds
                </Text>
                <Text fontSize="$2" color="$gray10" lineHeight={14}>
                  Bey Wallet can't hold, freeze, or touch it.
                </Text>
              </YStack>
            </XStack>

            {/* Row 2: Your recovery phrase is the key */}
            <XStack gap="$3" p="$3" items="center">
              <View
                width={42}
                height={42}
                rounded="$3"
                bg="$purple3"
                items="center"
                justify="center"
              >
                <Key size={20} color="$purple10" />
              </View>
              <YStack flex={1} gap="$1">
                <Text fontWeight="800" fontSize="$4" color="$color">
                  Your recovery phrase is the key
                </Text>
                <Text fontSize="$2" color="$gray10" lineHeight={14}>
                  12 words secure your wallet.
                </Text>
              </YStack>
            </XStack>

            {/* Row 3: Lose the phrase, lose access */}
            <XStack gap="$3" p="$3" items="center">
              <View width={42} height={42} rounded="$3" bg="$red3" items="center" justify="center">
                <AlertTriangle size={20} color="$red10" />
              </View>
              <YStack flex={1} gap="$1">
                <Text fontWeight="800" fontSize="$4" color="$color">
                  Lose the phrase, lose access
                </Text>
                <Text fontSize="$2" color="$gray10" lineHeight={14}>
                  No one can recover your wallet for you.
                </Text>
              </YStack>
            </XStack>

            {/* Row 4: Mints hold the backing Bitcoin */}
            <XStack gap="$3" p="$3" items="center">
              <View
                width={42}
                height={42}
                rounded="$3"
                bg="$orange3"
                items="center"
                justify="center"
              >
                <Landmark size={20} color="$orange10" />
              </View>
              <YStack flex={1} gap="$1">
                <Text fontWeight="800" fontSize="$4" color="$color">
                  Mints hold the backing Bitcoin
                </Text>
                <Text fontSize="$2" color="$gray10" lineHeight={14}>
                  If a mint shuts down, its tokens are lost.
                </Text>
              </YStack>
            </XStack>

            {/* Row 5: Experimental protocol */}
            <XStack gap="$3" p="$3" items="center">
              <View
                width={42}
                height={42}
                rounded="$3"
                bg="$green3"
                items="center"
                justify="center"
              >
                <Sprout size={20} color="$green10" />
              </View>
              <YStack flex={1} gap="$1">
                <Text fontWeight="800" fontSize="$4" color="$color">
                  Experimental protocol
                </Text>
                <Text fontSize="$2" color="$gray10" lineHeight={14}>
                  Avoid storing large balances in ecash.
                </Text>
              </YStack>
            </XStack>

            {/* Row 6: Read full Terms & Privacy */}
            <XStack
              gap="$3"
              p="$3"
              items="center"
              pressStyle={{ bg: '$gray3' }}
              onPress={handleOpenTerms}
            >
              <View width={42} height={42} rounded="$3" bg="$gray4" items="center" justify="center">
                <FileText size={20} color="$gray10" />
              </View>
              <Text flex={1} fontWeight="800" fontSize="$4" color="$color">
                Read full Terms & Privacy
              </Text>
              <ChevronRight size={18} color="$gray10" />
            </XStack>
          </YStack>
        </YStack>
      </ScrollView>

      {/* Footer with Checkbox & CTA */}
      <YStack gap="$4" py="$3" px="$4" bg="$background">
        {/* Checkbox row */}
        <XStack
          gap="$3"
          p="$3.5"
          items="flex-start"
          minHeight={48}
          accessibilityRole="checkbox"
          accessibilityLabel="I understand the risks and agree to the Terms"
          accessibilityState={{ checked, disabled: isBusy }}
          disabled={isBusy}
          onPress={() => {
            if (isBusy) return;
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setChecked(!checked);
          }}
        >
          <View
            width={22}
            height={22}
            rounded="$2"
            borderWidth={2}
            borderColor={checked ? '$accent9' : '$gray8'}
            bg={checked ? '$accent9' : 'transparent'}
            items="center"
            justify="center"
            mt="$0.5"
          >
            {checked && <Check size={14} color="$onAccent" strokeWidth={4} />}
          </View>
          <Text fontSize="$3" color={checked ? '$accent5' : '$gray10'} flex={1} lineHeight={16}>
            I understand I'm solely responsible for my recovery phrase, and I agree to the{' '}
            <Text
              color="$accent9"
              fontWeight="700"
              style={{ textDecorationLine: 'underline' }}
              onPress={(e) => {
                e.stopPropagation();
                handleOpenTerms();
              }}
            >
              Terms
            </Text>
            .
          </Text>
        </XStack>

        <AppButton
          variant="default"
          emphasis="primary"
          size="large"
          width="100%"
          onPress={handleContinue}
          disabled={!checked || isBusy}
          loading={isBusy}
          loadingText="Importing wallet…"
        >
          Agree & Continue
        </AppButton>
      </YStack>
    </YStack>
  );
}
