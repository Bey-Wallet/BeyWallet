import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type Href, useRouter } from 'expo-router';
import { YStack, XStack, Text, View } from 'tamagui';
import { Banknote, Bitcoin, Zap, ArrowLeft, X, Nfc, AtSign } from '@tamagui/lucide-icons';
import * as Haptics from 'expo-haptics';
import { BottomSheetScrollView, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import AppBottomSheet, { type AppBottomSheetRef } from '~/shared/ui/AppBottomSheet';
import { HeaderIconButton } from '~/shared/ui/HeaderIconButton';
import { AppPressable } from '~/shared/ui/AppPressable';
import { UniversalInputCard, type UniversalInputCardRef } from '~/shared/ui/UniversalInputCard';
import { appDimensions, appSpacing, appTypography } from '~/shared/theme/appearance';
import { nfcFlow } from '~/features/nfc/nfcFlow';

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
  action?: () => void;
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
    const [dismissAfterInput, setDismissAfterInput] = useState(false);
    const { height } = useWindowDimensions();
    const insets = useSafeAreaInsets();

    const dismiss = useCallback(() => {
      actionPending.current = true;
      inputRef.current?.clear();
      setProcessing(false);
      if (processing) setDismissAfterInput(true);
      else sheetRef.current?.dismiss();
    }, [processing]);

    const handleInputRedirect = useCallback(() => {
      actionPending.current = true;
      inputRef.current?.clear();
      setProcessing(false);
      // The lookup retains callbacks from its starting render. Always wait for
      // canDismiss to commit instead of reading that render's processing value.
      setDismissAfterInput(true);
    }, []);

    useEffect(() => {
      if (dismissAfterInput && !processing) {
        sheetRef.current?.dismiss();
        setDismissAfterInput(false);
      }
    }, [dismissAfterInput, processing]);

    useImperativeHandle(
      ref,
      () => ({
        present: (sheetType) => {
          actionPending.current = false;
          setDismissAfterInput(false);
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
                label: type === 'send' ? 'Share ecash' : 'Request ecash',
                icon: Banknote,
                description:
                  type === 'send' ? 'Create a token to share' : 'Create a request to share',
                path:
                  type === 'send'
                    ? '/(modals)/send?mode=standard'
                    : '/(modals)/receive?mode=request',
              },
              type === 'send'
                ? {
                    label: 'Tap to pay',
                    icon: Nfc,
                    description: 'Pay with NFC',
                    action: nfcFlow.openReader,
                  }
                : {
                    label: 'Bitcoin',
                    icon: Bitcoin,
                    description: 'Lightning or on-chain',
                    stage: 'bitcoin',
                  },
              ...(type === 'receive'
                ? [
                    {
                      label: 'My addresses',
                      icon: AtSign,
                      description: 'Share your ecash or Lightning address',
                      path: '/(modals)/nostr-profile' as Href,
                    },
                  ]
                : []),
            ]
          : [
              {
                label: type === 'send' ? 'Lightning' : 'Create invoice',
                icon: Zap,
                description:
                  type === 'send' ? 'Pay an invoice or Lightning address' : 'Create an invoice',
                path: type === 'send' ? '/(modals)/melt' : '/(modals)/mint',
              },
              ...(type === 'receive'
                ? [
                    {
                      label: 'Lightning address',
                      icon: Zap,
                      description: 'Receive with your permanent address',
                      path: '/(modals)/nostr-profile?tab=lightning' as Href,
                    },
                  ]
                : []),
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
    const snapPoints = useMemo(() => {
      if (type === 'mint') return ['75%', '90%'];
      const rowHeight =
        Math.max(44, appTypography.label1.lineHeight + appTypography.body2.lineHeight) +
        2 * appSpacing.page;
      const preferredHeight =
        24 +
        appDimensions.touchTarget +
        appSpacing.gap +
        96 +
        appSpacing.page +
        options.length * rowHeight +
        Math.max(0, options.length - 1) * appSpacing.gap +
        appSpacing.page +
        appDimensions.touchTarget +
        Math.max(insets.bottom, appSpacing.page);
      return [Math.min(height * 0.8, preferredHeight), '90%'];
    }, [type, options.length, height, insets.bottom]);
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
      } else if (option.action) {
        dismiss();
        option.action();
      }
    };

    const optionContent =
      type === 'mint' ? (
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
      ) : (
        <YStack gap={appSpacing.gap}>
          {options.map((option) => (
            <AppPressable
              key={option.label}
              minHeight={appDimensions.touchTarget}
              px={appSpacing.page}
              py={appSpacing.page}
              rounded="$6"
              overflow="hidden"
              flexDirection="row"
              items="center"
              gap={appSpacing.gap}
              bg="$buttonDefaultSecondary"
              hoverStyle={{ bg: '$buttonDefaultSecondaryHover' }}
              pressStyle={{ bg: '$buttonDefaultSecondaryPress' }}
              accessibilityLabel={option.label}
              accessibilityHint={option.description}
              accessibilityState={{ disabled: processing }}
              disabled={processing}
              onPress={() => handleOption(option)}
            >
              <View
                width={44}
                height={44}
                rounded={100}
                bg="$gray3"
                items="center"
                justify="center"
                aria-hidden
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                <option.icon size={22} strokeWidth={2.5} color="$gray10" />
              </View>
              <YStack flex={1} minWidth={0}>
                <Text fontFamily="$body" {...appTypography.label1} color="$color">
                  {option.label}
                </Text>
                <Text fontFamily="$body" {...appTypography.body2} color="$gray10">
                  {option.description}
                </Text>
              </YStack>
            </AppPressable>
          ))}
        </YStack>
      );

    const content = (
      <YStack flex={1} px="$4" gap="$3">
        <XStack items="center" justify="space-between">
          <HeaderIconButton
            accessibilityLabel={stage === 'main' ? 'Close' : 'Back'}
            disabled={processing}
            icon={stage === 'main' ? X : ArrowLeft}
            onPress={() => {
              if (processing || actionPending.current) return;
              if (stage === 'main') dismiss();
              else {
                Haptics.selectionAsync();
                setStage('main');
              }
            }}
          />
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
          <View width={40} />
        </XStack>
        {type === 'mint' ? (
          <BottomSheetScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <YStack gap="$4" pb="$4">
              <UniversalInputCard
                ref={inputRef}
                layout="stacked"
                inputComponent={BottomSheetTextInput}
                label="Payment details"
                placeholder="Paste or type payment details"
                onBeforeRedirect={handleInputRedirect}
                onProcessingChange={setProcessing}
              />
              {optionContent}
            </YStack>
          </BottomSheetScrollView>
        ) : (
          <UniversalInputCard
            ref={inputRef}
            layout="screen"
            compact
            scrollComponent={BottomSheetScrollView}
            inputComponent={BottomSheetTextInput}
            bottomInset={insets.bottom}
            label="Payment details"
            onBeforeRedirect={handleInputRedirect}
            onProcessingChange={setProcessing}
          >
            {optionContent}
          </UniversalInputCard>
        )}
      </YStack>
    );

    return (
      <AppBottomSheet
        ref={sheetRef}
        snapPoints={snapPoints}
        backgroundColor={type === 'mint' ? undefined : '$background'}
        canDismiss={!processing}
        onClose={() => {
          actionPending.current = true;
          inputRef.current?.clear();
        }}
      >
        {content}
      </AppBottomSheet>
    );
  },
);

export default ActionSelectorSheet;
