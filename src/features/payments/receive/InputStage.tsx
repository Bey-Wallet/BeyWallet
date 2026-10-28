import { interactionCopy } from '~/services/feedback/interactionCopy';
import { AppButton } from '~/shared/ui/AppButton';
import { AppPressable } from '~/shared/ui/AppPressable';
import { nfcFlow } from '~/features/nfc/nfcFlow';
import React from 'react';
import { router } from 'expo-router';
import { YStack, XStack, Text, View, TextArea, ScrollView } from 'tamagui';
import { Scan, Nfc, AlertCircle, ClipboardPaste } from '@tamagui/lucide-icons';

import * as Haptics from 'expo-haptics';
import * as ClipboardAPI from 'expo-clipboard';

interface InputStageProps {
  token: string;
  setToken: (val: string) => void;
  isLoading?: boolean;
  automaticProgress?: boolean;
  onAutoContinue?: () => void;
  error?: string | null;
  onContinue: () => void;
  onScanPress?: () => void;
}

export function InputStage({
  token,
  setToken,
  isLoading,
  automaticProgress = false,
  onAutoContinue,
  error,
  onContinue,
  onScanPress,
}: InputStageProps) {
  const [pasteError, setPasteError] = React.useState<string | null>(null);
  const handlePaste = async () => {
    setPasteError(null);
    try {
      const text = await ClipboardAPI.getStringAsync();
      if (text) {
        setToken(text);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch {
      setPasteError(interactionCopy.clipboardReadFailed.title);
    }
  };

  const isPaymentRequest =
    token.trim().toLowerCase().startsWith('creqa') ||
    token.trim().toLowerCase().startsWith('creqb');

  const isValidToken =
    !isPaymentRequest &&
    token.trim().length > 5 &&
    (token.trim().toLowerCase().includes('cashu') ||
      token.trim().toLowerCase().includes('creq') ||
      token.trim().toLowerCase().startsWith('lnbc') ||
      token.trim().toLowerCase().startsWith('lnurl') ||
      token.trim().toLowerCase().includes('/c#') ||
      token.trim().toLowerCase().includes('/c/#') ||
      // Check for variation selectors (Peanut format)
      /[\uFE00-\uFE0F\u{E0100}-\u{E01EF}]/u.test(token));

  const [lastAttemptedToken, setLastAttemptedToken] = React.useState('');

  // Reset last attempted token when token is cleared
  React.useEffect(() => {
    if (!token.trim()) {
      setLastAttemptedToken('');
    }
  }, [token]);

  React.useEffect(() => {
    const trimmed = token.trim();
    if (isValidToken && !isLoading && !error && trimmed !== lastAttemptedToken) {
      setLastAttemptedToken(trimmed);
      (onAutoContinue ?? onContinue)();
    }
  }, [token, isValidToken, isLoading, error, lastAttemptedToken, onContinue, onAutoContinue]);

  const handleScanPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onScanPress?.();
  };

  return (
    <YStack flex={1} bg="$background" p="$4">
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <YStack gap="$4">
          {/* Token Input Card */}
          <YStack bg="$gray2" rounded="$4" p="$4" minH={250}>
            <XStack justify="space-between" items="center" mb="$2">
              <Text color="$gray10" fontSize="$4" fontWeight="600">
                Enter Token
              </Text>
              <AppButton
                disabled={isLoading}
                variant="default"
                emphasis="secondary"
                size="xxsmall"
                icon={<ClipboardPaste size={14} />}
                onPress={handlePaste}
              >
                Paste
              </AppButton>
            </XStack>
            <TextArea
              disabled={isLoading}
              value={token}
              onChangeText={setToken}
              placeholder="Usage: Paste Cashu token, Lightning invoice, or LNURL..."
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

          <Text fontSize="$4" fontWeight="600" text="center" color="$gray10" ml="$1" mt="$2">
            Or scan code
          </Text>

          {/* Scanning Options */}
          <XStack gap="$3">
            <AppPressable
              disabled={isLoading}
              px={12}
              py={4}
              flex={1}
              height={100}
              bg="$gray2"
              rounded="$4"
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
              disabled={isLoading}
              px={12}
              py={4}
              flex={1}
              height={100}
              bg="$gray2"
              rounded="$4"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                nfcFlow.openReader();
              }}
              pressStyle={{ bg: '$gray3' }}
              flexDirection="row"
              items="center"
              justify="center"
              gap={8}
            >
              <YStack items="center" gap="$2">
                <View bg="$gray4" p="$3" rounded="$10">
                  <Nfc size={24} color="$color" />
                </View>
                <Text fontSize="$4" fontWeight="600" color="$color">
                  NFC
                </Text>
              </YStack>
            </AppPressable>
          </XStack>
        </YStack>
      </ScrollView>

      {/* Action Button at the Bottom */}
      <View position="absolute" px="$4" bottom="$4" left="$0" right="$0">
        {isValidToken ? (
          <AppButton
            variant="branded"
            emphasis="primary"
            size="large"
            loading={isLoading && !automaticProgress}
            loadingText="Reading ecash…"
            disabled={isLoading}
            onPress={onContinue}
          >
            {isLoading ? 'Decoding...' : 'Preview Token'}
          </AppButton>
        ) : (
          <AppButton
            variant="default"
            emphasis="secondary"
            size="large"
            icon={<ClipboardPaste size={18} />}
            onPress={handlePaste}
          >
            Paste from Clipboard
          </AppButton>
        )}
      </View>
    </YStack>
  );
}
