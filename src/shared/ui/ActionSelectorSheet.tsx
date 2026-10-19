import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { type Href, useRouter } from 'expo-router';
import { YStack, XStack, Text, View } from 'tamagui';
import { Banknote, Bitcoin, Zap, ChevronLeft, X } from '@tamagui/lucide-icons';
import * as Haptics from 'expo-haptics';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import AppBottomSheet, { type AppBottomSheetRef } from '~/shared/ui/AppBottomSheet';
import { AppIconButton } from '~/shared/ui/AppIconButton';
import { AppPressable } from '~/shared/ui/AppPressable';
import { UniversalInputCard, type UniversalInputCardRef } from '~/shared/ui/UniversalInputCard';

export type ActionSheetType = 'mint' | 'send' | 'receive';
export type ActionSheetStage = 'main' | 'bitcoin';

export interface ActionSelectorSheetRef {
  present: (type: ActionSheetType) => void;
  dismiss: () => void;
}

interface OptionConfig {
  icon: typeof Banknote;
  label: string;
  description: string;
  path?: Href;
  stage?: ActionSheetStage;
}

const ActionSelectorSheet = forwardRef<ActionSelectorSheetRef>(
  function ActionSelectorSheet(_, ref) {
    const router = useRouter();
    const sheetRef = useRef<AppBottomSheetRef>(null);
    const inputRef = useRef<UniversalInputCardRef>(null);
    const actionPending = useRef(false);
    const [type, setType] = useState<ActionSheetType>('send');
    const [stage, setStage] = useState<ActionSheetStage>('main');
    const [processing, setProcessing] = useState(false);

    const dismiss = useCallback(() => {
      actionPending.current = true;
      inputRef.current?.clear();
      sheetRef.current?.dismiss();
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        present: (sheetType) => {
          actionPending.current = false;
          setType(sheetType);
          setStage('main');
          inputRef.current?.clear();
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          sheetRef.current?.present();
        },
        dismiss,
      }),
      [dismiss],
    );

    const options: OptionConfig[] =
      type === 'mint'
        ? [
            {
              label: 'Top up via Lightning',
              icon: Zap,
              description: 'Create a Lightning invoice',
              path: '/(modals)/mint',
            },
            {
              label: 'Top up on-chain',
              icon: Bitcoin,
              description: 'Create a Bitcoin deposit address',
              path: '/(modals)/mint?mode=onchain',
            },
            {
              label: 'Pay with Lightning',
              icon: Zap,
              description: 'Pay an invoice or Lightning address',
              path: '/(modals)/melt',
            },
            {
              label: 'Pay on-chain',
              icon: Bitcoin,
              description: 'Send to a Bitcoin address',
              path: '/(modals)/melt?mode=onchain',
            },
          ]
        : stage === 'main'
          ? [
              {
                label: 'Ecash',
                icon: Banknote,
                description:
                  type === 'send' ? 'Create a token to share' : 'Create a request to share',
                path:
                  type === 'send'
                    ? '/(modals)/send?mode=standard'
                    : '/(modals)/receive?mode=request',
              },
              {
                label: 'Bitcoin',
                icon: Bitcoin,
                description: 'Lightning or on-chain',
                stage: 'bitcoin',
              },
            ]
          : [
              {
                label: 'Lightning',
                icon: Zap,
                description:
                  type === 'send' ? 'Pay an invoice or Lightning address' : 'Create an invoice',
                path: type === 'send' ? '/(modals)/melt' : '/(modals)/mint',
              },
              {
                label: 'On-chain',
                icon: Bitcoin,
                description:
                  type === 'send' ? 'Send to a Bitcoin address' : 'Create a deposit address',
                path:
                  type === 'send' ? '/(modals)/melt?mode=onchain' : '/(modals)/mint?mode=onchain',
              },
            ];
    const rows = Array.from({ length: Math.ceil(options.length / 2) }, (_, index) =>
      options.slice(index * 2, index * 2 + 2),
    );
    const title =
      type === 'mint'
        ? 'Fund & withdraw'
        : `${type === 'send' ? 'Send' : 'Receive'}${stage === 'bitcoin' ? ' Bitcoin' : ''}`;

    const handleOption = (option: OptionConfig) => {
      if (actionPending.current || processing) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (option.stage) {
        setStage(option.stage);
        return;
      }
      if (option.path) {
        dismiss();
        router.push(option.path);
      }
    };

    return (
      <AppBottomSheet
        ref={sheetRef}
        snapPoints={type === 'mint' ? ['75%', '90%'] : ['60%', '90%']}
        onClose={() => {
          actionPending.current = true;
          inputRef.current?.clear();
        }}
      >
        <YStack flex={1} px="$4" gap="$3">
          <XStack items="center" justify="space-between">
            {stage !== 'main' ? (
              <AppIconButton
                variant="default"
                emphasis="tertiary"
                size="xsmall"
                shape="circular"
                accessibilityLabel="Back"
                disabled={processing}
                icon={<ChevronLeft size={20} color="$color" />}
                onPress={() => {
                  if (processing || actionPending.current) return;
                  Haptics.selectionAsync();
                  setStage('main');
                }}
              />
            ) : (
              <View width={40} />
            )}
            <Text
              accessibilityRole="header"
              flex={1}
              textAlign="center"
              fontFamily="$heading"
              fontSize="$6"
              fontWeight="500"
              color="$color"
            >
              {title}
            </Text>
            <AppIconButton
              variant="default"
              emphasis="tertiary"
              size="xsmall"
              shape="circular"
              accessibilityLabel="Close"
              icon={<X size={20} color="$color" />}
              onPress={dismiss}
            />
          </XStack>
          <BottomSheetScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <YStack gap="$4" pb="$4">
              <UniversalInputCard
                ref={inputRef}
                layout="stacked"
                label="Payment details"
                placeholder="Paste or type payment details"
                onBeforeRedirect={dismiss}
                onProcessingChange={setProcessing}
              />
              <YStack gap={12}>
                {rows.map((row, index) => (
                  <XStack key={index} gap={12} items="stretch">
                    {row.map((option) => (
                      <AppPressable
                        key={option.label}
                        flex={1}
                        minWidth={0}
                        minHeight={112}
                        p={16}
                        rounded="$6"
                        gap={12}
                        items="flex-start"
                        justify="space-between"
                        bg="$buttonDefaultSecondary"
                        hoverStyle={{ bg: '$buttonDefaultSecondaryHover' }}
                        pressStyle={{ bg: '$buttonDefaultSecondaryPress', scale: 0.98 }}
                        accessibilityLabel={option.label}
                        accessibilityHint={option.description}
                        accessibilityState={{ disabled: processing }}
                        disabled={processing}
                        onPress={() => handleOption(option)}
                      >
                        <View
                          aria-hidden
                          accessibilityElementsHidden
                          importantForAccessibility="no-hide-descendants"
                        >
                          <option.icon size={28} color="$buttonDefaultSecondaryText" />
                        </View>
                        <Text
                          fontFamily="$body"
                          fontSize={16}
                          lineHeight={22}
                          fontWeight="500"
                          color="$buttonDefaultSecondaryText"
                          flexShrink={1}
                        >
                          {option.label}
                        </Text>
                      </AppPressable>
                    ))}
                  </XStack>
                ))}
              </YStack>
            </YStack>
          </BottomSheetScrollView>
        </YStack>
      </AppBottomSheet>
    );
  },
);

export default ActionSelectorSheet;
