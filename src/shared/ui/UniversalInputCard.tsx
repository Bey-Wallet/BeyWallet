import { usePendingOperationToast } from '~/shared/ui/OperationFeedback';
import { AppIconButton } from '~/shared/ui/AppIconButton';
import { AppButton } from '~/shared/ui/AppButton';
import React, { useState, useRef, useImperativeHandle, forwardRef, useEffect } from 'react';
import { YStack, XStack, Text, Input, View } from 'tamagui';
import {
  X,
  Clipboard,
  ArrowRight,
  Zap,
  Send,
  Bitcoin,
  CheckCircle2,
  Search,
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
import { ScrollView } from 'react-native';

export interface UniversalInputCardRef {
  clear: () => void;
  focus: () => void;
  process: (text?: string) => Promise<boolean>;
}

export interface UniversalInputCardProps {
  compact?: boolean;
  layout?: 'inline' | 'stacked' | 'screen';
  children?: React.ReactNode;
  scrollComponent?: React.ElementType;
  inputComponent?: React.ElementType;
  bottomInset?: number;
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
      children,
      scrollComponent: ScrollComponent = ScrollView,
      inputComponent: InputComponent,
      bottomInset = 0,
      onProcessingChange,
      label = 'Payment details',
      placeholder = 'Token, request, invoice, address, LNURL or link',
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
    const screen = layout === 'screen';
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
      // Native inputs can echo the text written by Paste while its lookup is pending.
      if (text === inputTextRef.current) return;
      const previous = inputTextRef.current;
      let start = 0;
      while (start < previous.length && start < text.length && previous[start] === text[start]) {
        start++;
      }
      let end = text.length;
      let previousEnd = previous.length;
      while (end > start && previousEnd > start && text[end - 1] === previous[previousEnd - 1]) {
        end--;
        previousEnd--;
      }
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
      // Android exposes context-menu paste as a multi-character text insertion.
      // Single-character typing and deletions keep the explicit Continue action.
      if (screen && !empty && end - start > 1) void processInput(text, true);
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
        default:
          return null;
      }
    };

    const badge = showBadge && detectedType ? getTypeBadge(detectedType) : null;
    const showContinue = hasText && !(isValidating && automaticProcessing);

    const input = (
      <Input
        asChild={InputComponent ? true : undefined}
        ref={inputRef}
        accessibilityLabel={label}
        onChangeText={handleInputChange}
        placeholder={placeholder}
        bg="transparent"
        borderWidth={screen ? 2 : 0}
        borderColor={screen ? (validationError ? '$red10' : '$borderColor') : undefined}
        rounded={screen ? '$6' : undefined}
        fontFamily="$body"
        fontWeight="400"
        fontSize={screen ? 14 : compact && !stacked ? '$3' : '$4'}
        lineHeight={screen ? 20 : stacked ? 24 : compact ? 20 : undefined}
        color="$color"
        p={10}
        flex={stacked || screen ? undefined : 1}
        minWidth={0}
        width={stacked || screen ? '100%' : undefined}
        textAlignVertical="top"
        placeholderTextColor={compact ? '$gray10' : '$gray8'}
        multiline
        numberOfLines={stacked ? 2 : 3}
        style={
          screen
            ? { padding: 8, paddingRight: 56 }
            : compact && !stacked
              ? { padding: 0, paddingTop: 12 }
              : { padding: 0 }
        }
        height={screen ? 96 : stacked ? 56 : compact ? 96 : height}
        editable={!isValidating}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus={autoFocus}
      >
        {InputComponent ? <InputComponent /> : undefined}
      </Input>
    );

    if (screen)
      return (
        <ScrollComponent
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <YStack gap="$4" pb={Math.max(bottomInset, 16)}>
            <View position="relative" testID="payment-input-field">
              {input}
              {hasText && (
                <View position="absolute" top={4} right={4}>
                  <AppIconButton
                    variant="default"
                    emphasis="tertiary"
                    size="small"
                    shape="circular"
                    accessibilityLabel="Clear input"
                    icon={<X size={20} color="$gray10" />}
                    disabled={isValidating}
                    onPress={clearInput}
                  />
                </View>
              )}
            </View>
            {validationError && (
              <Text fontFamily="$body" fontSize={12} color="$red10" accessibilityRole="alert">
                {validationError}
              </Text>
            )}
            {children}
            <XStack testID="payment-input-actions" justify="center" items="center">
              <AppButton
                variant="default"
                emphasis="secondary"
                size="small"
                style={{ borderRadius: 100, minHeight: 48, paddingHorizontal: 24 }}
                icon={showContinue ? undefined : <Clipboard size={18} />}
                disabled={isValidating}
                loading={isValidating}
                loadingText="Reading payment"
                onPress={hasText ? () => processInput() : handlePaste}
              >
                {showContinue ? 'Continue' : 'Paste'}
              </AppButton>
            </XStack>
          </YStack>
        </ScrollComponent>
      );

    if (stacked)
      return (
        <YStack
          rounded="$6"
          p="$3"
          pt="$5"
          gap="$2"
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
        p="$3"
        minHeight={120}
        borderWidth={1}
        items="center"
        borderColor={validationError ? '$red10' : compact ? 'transparent' : '$gray4'}
        bg={compact ? '$buttonDefaultSecondary' : '$gray3'}
      >
        <XStack
          width={compact ? '100%' : undefined}
          justify="space-between"
          items={compact ? 'flex-start' : 'center'}
          gap="$2"
          mb={compact ? 0 : '$2'}
        >
          {compact ? (
            <>
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
                <Search size={20} strokeWidth={2.5} color="$gray10" />
              </View>
              {input}
            </>
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
                  size={compact ? 'xsmall' : 'xxsmall'}

                  shape="circular"
                  accessibilityLabel="Clear input"
                  icon={<X size={14} color="$color" />}
                  disabled={isValidating}
                  onPress={clearInput}
                />
                <AppButton
                  variant="branded"
                  emphasis="primary"
                  size={compact ? 'xsmall' : 'xxsmall'}
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
                size={compact ? 'xsmall' : 'xxsmall'}
                icon={<Clipboard size={compact ? 16 : 12} />}
                disabled={isValidating}
                loading={isValidating && automaticProcessing}
                loadingText="Reading payment"
                onPress={handlePaste}
              >
                Paste
              </AppButton>
            )}
          </XStack>
        </XStack>
        {!compact && input}
        {validationError && (
          <Text
            accessibilityRole="alert"
            color="$red10"
            fontSize="$2"
            fontWeight="600"
            mt="$1.5"
            px="$1"
          >
            {validationError}
          </Text>
        )}
      </YStack>
    );
  },
);

UniversalInputCard.displayName = 'UniversalInputCard';
