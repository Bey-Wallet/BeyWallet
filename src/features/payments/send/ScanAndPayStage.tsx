import { interactionCopy } from '~/services/feedback/interactionCopy';
import { AppButton } from '~/shared/ui/AppButton';
import { AppPressable } from '~/shared/ui/AppPressable';
import { nfcFlow } from '~/features/nfc/nfcFlow';
import React from 'react';
import { YStack, XStack, Text, View, TextArea, ScrollView } from 'tamagui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Scan, Nfc, AlertCircle, ClipboardPaste } from '@tamagui/lucide-icons';

import * as Haptics from 'expo-haptics';
import * as ClipboardAPI from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useWalletStore } from '~/state/walletStore';
import { useEffect } from 'react';

interface ScanAndPayStageProps {
  input: string;
  setInput: (val: string) => void;
  isLoading?: boolean;
  error?: string | null;
  onContinue: (forcedInput?: string) => void;
}

export function ScanAndPayStage({
  input,
  setInput,
  isLoading,
  error,
  onContinue,
}: ScanAndPayStageProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const scannerResult = useWalletStore((state) => state.scannerResult);
  const setScannerResult = useWalletStore((state) => state.setScannerResult);

  useEffect(() => {
    if (scannerResult) {
      setInput(scannerResult);
      setScannerResult(null);
      // Pass scannerResult directly to avoid stale closure
      onContinue(scannerResult);
    }
  }, [scannerResult, setInput, setScannerResult, onContinue]);

  const [pasteError, setPasteError] = React.useState<string | null>(null);
  const handlePaste = async () => {
    setPasteError(null);
    try {
      const text = await ClipboardAPI.getStringAsync();
      if (text) {
        setInput(text);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch {
      setPasteError(interactionCopy.clipboardReadFailed.title);
    }
  };

  const isLikelyValid = input.trim().length > 5;

  const handleScanPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: '/(modals)/scanner',
      params: { returnTo: '/send' },
    });
  };

  return (
    <YStack flex={1} bg="$background" p="$0" pt="$4">
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <YStack gap="$4">
          {/* Input Card */}
          <YStack bg="$gray2" rounded="$6" p="$4" minHeight={180}>
            <XStack justify="space-between" items="center" mb="$2">
              <Text color="$gray10" fontSize="$4" fontWeight="600">
                Enter Payment Request
              </Text>
              <AppButton
                variant="default"
                emphasis="secondary"
                size="xxsmall"
                icon={<ClipboardPaste size={14} color="$gray10" />}
                onPress={handlePaste}
              >
                Paste
              </AppButton>
            </XStack>
            <TextArea
              value={input}
              onChangeText={setInput}
              placeholder="Usage: Paste payment request (creq...) or Cashu token..."
              bg="transparent"
              borderWidth={0}
              fontSize="$5"
              color="$color"
              p={0}
              flex={1}
              textAlignVertical="top"
              placeholderTextColor="$gray8"
              selectionColor="$green9"
            />
          </YStack>

          {/* Error Display */}
          {(error || pasteError) && (
            <XStack bg="$red3" p="$3" rounded="$3" gap="$2" items="center">
              <AlertCircle size={18} color="$red10" />
              <Text
                color="$red10"
                fontSize="$3"
                flex={1}
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
              >
                {error || pasteError}
              </Text>
            </XStack>
          )}

          <Text fontSize="$4" fontWeight="600" color="$gray10" ml="$1" mt="$2">
            Or scan code
          </Text>

          {/* Scanning Options */}
          <XStack gap="$3">
            <AppPressable
              px={12}
              py={4}
              flex={1}
              height={100}
              bg="$gray2"
              rounded="$6"
              onPress={handleScanPress}
              pressStyle={{ bg: '$gray3' }}
              flexDirection="row"
              items="center"
              justify="center"
              gap={8}
            >
              <YStack items="center" gap="$2">
                <View bg="$gray4" p="$3" rounded="$10">
                  <Scan size={24} color="$color" />
                </View>
                <Text fontSize="$4" fontWeight="600" color="$color">
                  QR Code
                </Text>
              </YStack>
            </AppPressable>

            <AppPressable
              px={12}
              py={4}
              flex={1}
              height={100}
              bg="$gray2"
              rounded="$6"
              onPress={nfcFlow.openReader}
              flexDirection="row"
              items="center"
              justify="center"
              gap={8}
            >
              <YStack items="center" gap="$2">
                <View bg="$gray4" p="$3" rounded="$10">
                  <Nfc size={24} color="$gray10" />
                </View>
                <Text fontSize="$4" fontWeight="600" color="$gray10">
                  NFC
                </Text>
              </YStack>
            </AppPressable>
          </XStack>
        </YStack>
      </ScrollView>

      {/* Continue Button */}
      {isLikelyValid && (
        <View position="absolute" px="$0" bottom="$4" left="$0" right="$0">
          <AppButton
            variant="branded"
            emphasis="primary"
            size="large"
            loading={isLoading}
            disabled={isLoading}
            onPress={() => onContinue()}
          >
            {isLoading ? 'Processing...' : 'Preview Payment'}
          </AppButton>
        </View>
      )}
    </YStack>
  );
}
