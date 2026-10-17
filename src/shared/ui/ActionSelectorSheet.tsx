import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { type Href, useRouter } from 'expo-router';
import { YStack, XStack, Text, View } from 'tamagui';
import {
  Banknote,
  Bitcoin,
  Zap,
  Clipboard as ClipboardIcon,
  HandCoins,
  ChevronLeft,
  ChevronRight,
  X,
} from '@tamagui/lucide-icons';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { useToastController } from '@tamagui/toast';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import AppBottomSheet, { type AppBottomSheetRef } from '~/shared/ui/AppBottomSheet';
import { AppIconButton } from '~/shared/ui/AppIconButton';
import { AppPressable } from '~/shared/ui/AppPressable';
import { ListTable } from '~/shared/ui/ListTable';
import { UniversalInputCard, type UniversalInputCardRef } from '~/shared/ui/UniversalInputCard';

export type ActionSheetType = 'mint' | 'send' | 'receive';
export type ActionSheetStage = 'main' | 'ecash' | 'bitcoin';

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
  paste?: boolean;
}

const ActionSelectorSheet = forwardRef<ActionSelectorSheetRef>(
  function ActionSelectorSheet(_, ref) {
    const router = useRouter();
    const toast = useToastController();
    const sheetRef = useRef<AppBottomSheetRef>(null);
    const inputRef = useRef<UniversalInputCardRef>(null);
    const generation = useRef(0);
    const actionPending = useRef(false);
    const [type, setType] = useState<ActionSheetType>('send');
    const [stage, setStage] = useState<ActionSheetStage>('main');
    const [pasting, setPasting] = useState(false);

    const dismiss = useCallback(() => {
      ++generation.current;
      actionPending.current = false;
      setPasting(false);
      inputRef.current?.clear();
      sheetRef.current?.dismiss();
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        present: (sheetType) => {
          ++generation.current;
          actionPending.current = false;
          setPasting(false);
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
              type === 'send'
                ? {
                    label: 'Ecash',
                    icon: Banknote,
                    description: 'Create a token to share',
                    path: '/(modals)/send?mode=standard',
                  }
                : {
                    label: 'Ecash',
                    icon: Banknote,
                    description: 'Paste a token or request ecash',
                    stage: 'ecash',
                  },
              {
                label: 'Bitcoin',
                icon: Bitcoin,
                description: 'Lightning or on-chain',
                stage: 'bitcoin',
              },
            ]
          : stage === 'bitcoin'
            ? [
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
              ]
            : [
                {
                  label: 'Paste ecash',
                  icon: ClipboardIcon,
                  description: 'Claim a token from your clipboard',
                  paste: true,
                },
                {
                  label: 'Request ecash',
                  icon: HandCoins,
                  description: 'Create a request to share',
                  path: '/(modals)/receive?mode=request',
                },
              ];

    const title =
      type === 'mint'
        ? 'Fund & withdraw'
        : `${type === 'send' ? 'Send' : 'Receive'}${stage === 'main' ? '' : stage === 'bitcoin' ? ' Bitcoin' : ' ecash'}`;

    const handleOption = async (option: OptionConfig) => {
      if (actionPending.current) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (option.stage) {
        setStage(option.stage);
        return;
      }
      actionPending.current = true;
      if (option.path) {
        inputRef.current?.clear();
        sheetRef.current?.dismiss();
        router.push(option.path);
        return;
      }
      if (option.paste) {
        const ticket = generation.current;
        setPasting(true);
        let token = '';
        try {
          token = (await Clipboard.getStringAsync()).trim();
        } catch {
          /* Open manual input below. */
        }
        if (ticket !== generation.current) return;
        setPasting(false);
        inputRef.current?.clear();
        sheetRef.current?.dismiss();
        router.push({
          pathname: '/(modals)/receive',
          params: { mode: 'receive', ...(token ? { scannedToken: token } : {}) },
        });
        if (!token) toast.show('Paste or type your ecash token', { kind: 'info' });
      }
    };

    return (
      <AppBottomSheet
        ref={sheetRef}
        snapPoints={type === 'mint' ? ['60%'] : ['50%']}
        backgroundColor="$background"
        onClose={() => {
          ++generation.current;
          actionPending.current = false;
          setPasting(false);
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
                disabled={pasting}
                icon={<ChevronLeft size={20} color="$color" />}
                onPress={() => {
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
            <YStack gap="$3" pb="$4">
              <UniversalInputCard
                ref={inputRef}
                compact
                label="Payment details"
                placeholder="Paste payment details"
                onBeforeRedirect={dismiss}
              />
              <ListTable>
                {options.map((option) => (
                  <AppPressable
                    key={option.label}
                    minHeight={64}
                    px="$4"
                    py="$3"
                    flexDirection="row"
                    items="center"
                    gap="$3"
                    accessibilityLabel={option.label}
                    accessibilityHint={option.description}
                    accessibilityState={{ busy: pasting && !!option.paste }}
                    disabled={pasting}
                    pressStyle={{ bg: '$gray3' }}
                    onPress={() => void handleOption(option)}
                  >
                    <option.icon size={20} color="$color" />
                    <YStack flex={1} gap="$1">
                      <Text fontSize="$5" fontWeight="500" color="$color">
                        {pasting && option.paste ? 'Reading clipboard…' : option.label}
                      </Text>
                      <Text fontSize="$3" color="$gray10">
                        {option.description}
                      </Text>
                    </YStack>
                    <ChevronRight size={18} color="$gray10" />
                  </AppPressable>
                ))}
              </ListTable>
            </YStack>
          </BottomSheetScrollView>
        </YStack>
      </AppBottomSheet>
    );
  },
);

export default ActionSelectorSheet;
