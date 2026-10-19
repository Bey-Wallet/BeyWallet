import { usePendingOperationToast } from '~/shared/ui/OperationFeedback';
import { AppIconButton } from '~/shared/ui/AppIconButton';
import { AppButton } from '~/shared/ui/AppButton';
import React, { useState, useRef, useImperativeHandle, forwardRef, useEffect } from 'react';
import { YStack, XStack, Text, Input } from 'tamagui';
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
  compact?: boolean;
  layout?: 'inline' | 'stacked';
  onProcessingChange?: (processing: boolean) => void;
  label?: string;
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
      compact = false,
      layout = 'inline',
      onProcessingChange,
      label = 'Enter Token, Address or Username',
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
    const generation = useRef(0);
    const processing = useRef(false);
    const navigating = useRef(false);
    const stacked = layout === 'stacked';
    useEffect(
      () => () => {
        ++generation.current;
        processing.current = false;
      },
      [],
    );

    const [hasText, setHasText] = useState(false);
    const [validationError, setValidationError] = useState<string | null>(null);
    const [isValidating, setIsValidating] = useState(false);
    const [automaticProcessing, setAutomaticProcessing] = useState(false);
    usePendingOperationToast({
      active: isValidating && automaticProcessing,
      title: 'Reading payment…',
    });
    const [detectedType, setDetectedType] = useState<UniversalInputType | null>(null);

    const clearInput = () => {
      ++generation.current;
      navigating.current = false;
      processing.current = false;
      setIsValidating(false);
      onProcessingChange?.(false);
      inputTextRef.current = '';
      inputRef.current?.clear();
      setHasText(false);
      setValidationError(null);
      setDetectedType(null);
    };

    const resolveInput = async (text: string, ticket: number): Promise<boolean> => {
      try {
        const result = await resolveUniversalInput(text);
        if (ticket !== generation.current) return false;

        if (onResolved) {
          onResolved(result);
        }
        if (ticket !== generation.current) return false;

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
            navigating.current = true;
          },
        });

        return redirected;
      } catch {
        if (ticket === generation.current)
          setValidationError('Could not read payment details. Try again.');
        return false;
      } finally {
        if (ticket === generation.current) {
          processing.current = false;
          setIsValidating(false);
          onProcessingChange?.(false);
        }
      }
    };

    const startProcessing = (automatic: boolean) => {
      processing.current = true;
      setAutomaticProcessing(automatic);
      setIsValidating(true);
      setValidationError(null);
      onProcessingChange?.(true);
      return ++generation.current;
    };

    const processInput = async (textToProcess?: string, automatic = false): Promise<boolean> => {
      if (processing.current || navigating.current) return false;
      const text = (textToProcess ?? inputTextRef.current).trim();
      if (!text) return false;
      return resolveInput(text, startProcessing(automatic));
    };

    const handlePaste = async () => {
      if (processing.current || navigating.current) return;
      const ticket = startProcessing(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      try {
        const text = await ClipboardAPI.getStringAsync();
        if (ticket !== generation.current) return;
        if (text && text.trim()) {
          inputTextRef.current = text.trim();
          inputRef.current?.setNativeProps({ text: text.trim() });
          setHasText(true);
          await resolveInput(text.trim(), ticket);
        } else {
          toast.show('Clipboard is empty', { kind: 'info' });
        }
      } catch {
        if (ticket === generation.current)
          setValidationError('Could not read the clipboard. Paste or type payment details.');
      } finally {
        if (ticket === generation.current) {
          processing.current = false;
          setIsValidating(false);
          onProcessingChange?.(false);
        }
      }
    };

    const handleInputChange = (text: string) => {
      if (processing.current) clearInput();
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

    const input = (
      <Input
        ref={inputRef}
        accessibilityLabel={label}
        onChangeText={handleInputChange}
        placeholder={placeholder}
        bg="transparent"
        borderWidth={0}
        fontFamily="$body"
        fontWeight="400"
        fontSize={compact && !stacked ? '$3' : '$4'}
        lineHeight={stacked ? 24 : undefined}
        color="$color"
        p={0}
        flex={stacked ? undefined : 1}
        minWidth={0}
        width={stacked ? '100%' : undefined}
        textAlignVertical={compact && !stacked ? 'center' : 'top'}
        placeholderTextColor="$gray8"
        multiline={stacked || !compact}
        numberOfLines={stacked ? 2 : compact ? 1 : 3}
        style={{ padding: 0 }}
        height={stacked ? 56 : compact ? 40 : height}
        editable={!isValidating}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus={autoFocus}
      />
    );

    if (stacked)
      return (
        <YStack
          rounded="$6"
          p="$3"
          gap="$3"
          minHeight={132}
          borderWidth={1}
          borderColor={validationError ? '$red8' : '$borderColor'}
          bg="$gray3"
        >
          {input}
          <XStack width="100%" items="center" justify="space-between" gap="$2" flexWrap="wrap">
            <AppButton
              variant="default"
              emphasis="tertiary"
              size="small"
              icon={<Clipboard size={18} />}
              disabled={isValidating}
              loading={isValidating && automaticProcessing}
              loadingText="Reading payment"
              onPress={handlePaste}
            >
              Paste
            </AppButton>
            <XStack gap="$2" items="center">
              {hasText && (
                <>
                  <AppIconButton
                    variant="default"
                    emphasis="tertiary"
                    size="small"
                    accessibilityLabel="Clear input"
                    icon={<X size={18} color="$color" />}
                    disabled={isValidating}
                    onPress={clearInput}
                  />
                  <AppButton
                    variant="branded"
                    emphasis="primary"
                    size="small"
                    disabled={isValidating}
                    loading={isValidating && !automaticProcessing}
                    loadingText="Reading payment"
                    onPress={() => processInput()}
                  >
                    Continue
                  </AppButton>
                </>
              )}
            </XStack>
          </XStack>
          {validationError && (
            <Text
              fontFamily="$body"
              fontSize="$3"
              fontWeight="400"
              color="$red10"
              accessibilityRole="alert"
            >
              {validationError}
            </Text>
          )}
        </YStack>
      );

    return (
      <YStack
        rounded="$6"
        p={compact ? '$2' : '$3'}
        minHeight={compact ? 64 : 120}
        borderWidth={1}
        items="center"
        borderColor={validationError ? '$red8' : '$gray4'}
        bg="$gray3"
      >
        <XStack justify="space-between" items="center" gap="$2" mb={compact ? 0 : '$2'}>
          {compact ? (
            input
          ) : (
            <XStack gap="$2" items="center">
              <Text color="$gray10" fontSize="$2" fontWeight="600">
                {label}
              </Text>
              {badge && (
                <XStack gap="$1" items="center" bg="$gray3" px="$2" py="$0.5" rounded="$3">
                  <Text color={badge.color} fontSize="$1" fontWeight="700">
                    {badge.label}
                  </Text>
                </XStack>
              )}
            </XStack>
          )}
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
                emphasis="tertiary"
                size="xxsmall"
                icon={<Clipboard size={12} />}
                onPress={handlePaste}
              >
                Paste
              </AppButton>
            )}
          </XStack>
        </XStack>
        {!compact && input}
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
