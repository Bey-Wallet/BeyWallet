import { usePendingOperationToast } from '~/shared/ui/OperationFeedback';
import { AppIconButton } from '~/shared/ui/AppIconButton';
import { AppButton } from '~/shared/ui/AppButton';
import React, { useState, useRef, useImperativeHandle, forwardRef } from 'react';
import { YStack, XStack, Text, Input, Spinner } from 'tamagui';
import {
  X,
  Clipboard,
  ArrowRight,
  Zap,
  Send,
  Bitcoin,
  Users,
  CheckCircle2,
} from '@tamagui/lucide-icons';
import * as Haptics from 'expo-haptics';
import * as ClipboardAPI from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useToastController } from '@tamagui/toast';
import {
  resolveUniversalInput,
  UniversalInputResult,
  UniversalInputType,
} from '~/shared/utils/universalInputResolver';
import { handleUniversalRedirect } from '~/shared/utils/universalRedirect';

export interface UniversalInputCardRef {
  clear: () => void;
  focus: () => void;
  process: (text?: string) => Promise<boolean>;
}

export interface UniversalInputCardProps {
  placeholder?: string;
  onBeforeRedirect?: () => void;
  onResolved?: (result: UniversalInputResult) => void;
  autoFocus?: boolean;
  height?: number;
  showBadge?: boolean;
}

export const UniversalInputCard = forwardRef<UniversalInputCardRef, UniversalInputCardProps>(
  (
    {
      placeholder = 'Paste or type Cashu token, LN invoice/address, Bitcoin address, Npub, or username...',
      onBeforeRedirect,
      onResolved,
      autoFocus = false,
      height = 70,
      showBadge = true,
    },
    ref,
  ) => {
    const router = useRouter();
    const toast = useToastController();
    const inputRef = useRef<any>(null);
    const inputTextRef = useRef('');

    const [hasText, setHasText] = useState(false);
    const [validationError, setValidationError] = useState<string | null>(null);
    const [isValidating, setIsValidating] = useState(false);
    const [automaticProcessing, setAutomaticProcessing] = useState(false);
    usePendingOperationToast({
      active: isValidating && automaticProcessing,
      title: 'Reading payment…',
      description: 'Finding the payment or recipient.',
    });
    const [detectedType, setDetectedType] = useState<UniversalInputType | null>(null);

    const clearInput = () => {
      inputTextRef.current = '';
      inputRef.current?.clear();
      setHasText(false);
      setValidationError(null);
      setDetectedType(null);
    };

    const processInput = async (textToProcess?: string, automatic = false): Promise<boolean> => {
      const text = (textToProcess ?? inputTextRef.current).trim();
      if (!text) {
        setValidationError(null);
        setDetectedType(null);
        return false;
      }

      setAutomaticProcessing(automatic);
      setIsValidating(true);
      setValidationError(null);

      try {
        const result = await resolveUniversalInput(text);
        setIsValidating(false);

        if (onResolved) {
          onResolved(result);
        }

        if (result.type === 'unknown' || result.error) {
          setValidationError(result.error || 'Unrecognized format');
          setDetectedType(null);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          return false;
        }

        setDetectedType(result.type);
        const redirected = handleUniversalRedirect(result, {
          router,
          onBeforeRedirect: () => {
            clearInput();
            if (onBeforeRedirect) onBeforeRedirect();
          },
        });

        return redirected;
      } catch (err: any) {
        setIsValidating(false);
        setValidationError(err?.message || 'Processing failed');
        return false;
      }
    };

    const handlePaste = async () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      try {
        const text = await ClipboardAPI.getStringAsync();
        if (text && text.trim()) {
          inputTextRef.current = text.trim();
          inputRef.current?.setNativeProps({ text: text.trim() });
          setHasText(true);
          await processInput(text.trim(), true);
        } else {
          toast.show('Clipboard Empty', { message: 'No text found in clipboard.' });
        }
      } catch (e) {
        console.error('[UniversalInputCard] Failed to read clipboard:', e);
      }
    };

    const handleInputChange = (text: string) => {
      inputTextRef.current = text;
      const empty = !text.trim();
      if (empty !== !hasText) {
        setHasText(!empty);
      }
      if (empty) {
        setValidationError(null);
        setDetectedType(null);
      }
    };

    useImperativeHandle(ref, () => ({
      clear: clearInput,
      focus: () => inputRef.current?.focus(),
      process: (text?: string) => processInput(text, true),
    }));

    const getTypeBadge = (t: UniversalInputType) => {
      switch (t) {
        case 'cashu_token':
        case 'bey_share_token':
          return { label: 'eCash Token', color: '$green10', icon: CheckCircle2 };
        case 'cashu_request':
        case 'bey_share_request':
          return { label: 'Payment Request', color: '$yellow10', icon: Send };
        case 'lightning_invoice':
        case 'lightning_address':
          return { label: 'Lightning', color: '$amber10', icon: Zap };
        case 'bitcoin_onchain':
          return { label: 'BTC On-Chain', color: '$orange10', icon: Bitcoin };
        case 'nostr_contact':
        case 'bey_username':
          return { label: 'Nostr DM', color: '$purple10', icon: Users };
        default:
          return null;
      }
    };

    const badge = showBadge && detectedType ? getTypeBadge(detectedType) : null;

    return (
      <YStack
        rounded="$5"
        p="$3"
        minHeight={120}
        borderWidth={1}
        borderColor={validationError ? '$red8' : '$gray4'}
        bg="$background"
      >
        <XStack justify="space-between" items="center" mb="$2">
          <XStack gap="$2" items="center">
            <Text color="$gray10" fontSize="$2" fontWeight="600">
              Enter Token, Address or Username
            </Text>
            {badge && (
              <XStack gap="$1" items="center" bg="$gray3" px="$2" py="$0.5" rounded="$3">
                <Text color={badge.color} fontSize="$1" fontWeight="700">
                  {badge.label}
                </Text>
              </XStack>
            )}
          </XStack>
          <XStack gap="$1.5" items="center">
            {hasText ? (
              <>
                <AppIconButton
                  variant="default"
                  emphasis="tertiary"
                  size="xxsmall"

                  shape="circular"
                  accessibilityLabel="Clear input"
                  icon={<X size={14} color="$color" />}
                  disabled={isValidating}
                  onPress={clearInput}
                />
                <AppButton
                  variant="branded"
                  emphasis="primary"
                  size="xxsmall"
                  loading={isValidating && !automaticProcessing}
                  loadingText="Reading payment…"
                  icon={isValidating ? undefined : <ArrowRight size={14} />}
                  onPress={() => processInput()}
                  disabled={isValidating}
                >
                  {isValidating ? '...' : 'Go'}
                </AppButton>
              </>
            ) : (
              <AppButton
                variant="default"
                emphasis="secondary"
                size="xxsmall"
                icon={<Clipboard size={12} />}
                onPress={handlePaste}
              >
                Paste
              </AppButton>
            )}
          </XStack>
        </XStack>
        <Input
          ref={inputRef}
          onChangeText={handleInputChange}
          placeholder={placeholder}
          bg="transparent"
          borderWidth={0}
          fontSize="$4"
          color="$color"
          p={0}
          flex={1}
          textAlignVertical="top"
          placeholderTextColor="$gray8"
          multiline
          numberOfLines={3}
          style={{ padding: 0 }}
          height={height}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus={autoFocus}
        />
        {validationError && (
          <Text color="$red10" fontSize="$2" fontWeight="600" mt="$1.5" px="$1">
            {validationError}
          </Text>
        )}
      </YStack>
    );
  },
);

UniversalInputCard.displayName = 'UniversalInputCard';
