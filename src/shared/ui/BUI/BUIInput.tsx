import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  Animated,
  AppState,
  Easing,
  Text as NativeText,
  TextInput,
  useWindowDimensions,
  type TextInputProps,
} from 'react-native';
import { Eye, EyeOff, Search, XCircle } from '@tamagui/lucide-icons';
import { XStack, YStack } from 'tamagui';
import { AppPressable } from '~/shared/ui/AppPressable';
import { Spinner } from '~/shared/ui/Spinner';
import { useReducedMotion } from '~/shared/hooks/useReducedMotion';
import { useBUITheme } from './useBUITheme';
import { BUIText } from './BUIText';

export type BUIInputProps = Omit<TextInputProps, 'value' | 'onChangeText' | 'readOnly'> & {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  error?: string;
  helper?: string;
  loading?: boolean;
  success?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  disableClear?: boolean;
  suffix?: string;
  trailing?: React.ReactNode;
  inset?: number;
  maxLines?: number;
  radius?: number;
  inputComponent?: React.ComponentType<TextInputProps & React.RefAttributes<TextInput>>;
};

export function BUIFormMessage({ error, helper }: { error?: string; helper?: string }) {
  const c = useBUITheme();
  return error || helper ? (
    <BUIText
      kind="body2"
      color={error ? c.negative : c.muted}
      accessibilityRole={error ? 'alert' : undefined}
      accessibilityLiveRegion="polite"
      px={4}
    >
      {error || helper}
    </BUIText>
  ) : null;
}

export const BUIInput = forwardRef<TextInput, BUIInputProps>(function BUIInput(
  {
    label,
    value,
    onChangeText,
    error,
    helper,
    loading = false,
    success = false,
    disabled = false,
    readOnly = false,
    disableClear = false,
    suffix,
    trailing,
    inset = 16,
    maxLines = 4,
    multiline = false,
    radius = 20,
    inputComponent: InputComponent = TextInput,
    style,
    onFocus,
    onBlur,
    onContentSizeChange,
    ...props
  },
  ref,
) {
  const c = useBUITheme();
  const reducedMotion = useReducedMotion();
  const { fontScale } = useWindowDimensions();
  const input = useRef<TextInput>(null);
  useImperativeHandle(ref, () => input.current!);
  const [focused, setFocused] = useState(false);
  const hasText = value.trim().length > 0;
  const floating = focused || hasText;
  const progress = useRef(new Animated.Value(floating ? 1 : 0)).current;
  const [contentHeight, setContentHeight] = useState(24 * fontScale);
  const [width, setWidth] = useState(0);
  const [trailingWidth, setTrailingWidth] = useState(0);
  const [suffixWidth, setSuffixWidth] = useState(0);
  const [textWidth, setTextWidth] = useState(0);
  const labelHeight = label ? 24 * fontScale : 0;
  const inputHeight = multiline
    ? Math.max(24 * fontScale, Math.min(contentHeight, 24 * fontScale * maxLines))
    : 24 * fontScale;
  const expandedHeight = labelHeight * 0.75 + (label ? 4 : 0) + inputHeight;
  const height = Math.max(40, expandedHeight, labelHeight);
  const expandedY =
    Math.max(0, (height - expandedHeight) / 2) + labelHeight * 0.75 + (label ? 4 : 0);
  const clear =
    !disableClear && !loading && !success && hasText && focused && !disabled && !readOnly;
  const showTrailing = (disableClear || !hasText) && !!trailing;
  const hasTrailing = loading || clear || showTrailing;
  const available = Math.max(0, width - (hasTrailing ? trailingWidth : 0));
  const fieldWidth = Math.max(0, available - (hasText && suffix ? suffixWidth + 4 : 0));
  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: floating ? 1 : 0,
      duration: reducedMotion ? 0 : 150,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [floating, progress, reducedMotion]);
  const textStyle = {
    fontFamily: 'InterTextRegular',
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0.08,
    includeFontPadding: false,
  } as const;
  return (
    <YStack mx={inset} gap={4}>
      <YStack minHeight={64} rounded={radius} bg={error ? c.fieldError : c.field} px={16} py={12}>
        <YStack
          position="absolute"
          t={0}
          l={0}
          r={0}
          b={0}
          rounded={radius}
          borderWidth={1.5}
          borderColor={error ? c.fieldErrorBorder : focused ? c.fieldActiveBorder : c.field}
          pointerEvents="none"
        />
        <YStack height={height} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
          {!!label && (
            <Animated.Text
              accessible={false}
              pointerEvents="none"
              allowFontScaling
              numberOfLines={1}
              style={[
                textStyle,
                {
                  position: 'absolute',
                  left: 0,
                  top: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [
                      (height - labelHeight) / 2,
                      Math.max(0, (height - expandedHeight) / 2),
                    ],
                  }),
                  color: c.muted,
                  transformOrigin: 'left top',
                  transform: [
                    { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.75] }) },
                  ],
                },
              ]}
            >
              {label}
            </Animated.Text>
          )}
          <Animated.View
            style={{
              position: 'absolute',
              left: 0,
              top: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [(height - inputHeight) / 2, expandedY],
              }),
              width: width ? fieldWidth : '100%',
            }}
          >
            <InputComponent
              {...props}
              ref={input}
              accessibilityLabel={props.accessibilityLabel ?? label}
              accessibilityHint={props.accessibilityHint ?? error ?? helper}
              accessibilityState={{ ...props.accessibilityState, disabled, busy: loading }}
              value={value}
              onChangeText={(text) => {
                if (!disabled && !readOnly) onChangeText(text);
              }}
              editable={!disabled && !readOnly}
              multiline={multiline}
              placeholder={label ? undefined : props.placeholder}
              placeholderTextColor={c.muted}
              selectionColor={error ? c.negative : c.primary}
              style={[
                textStyle,
                {
                  color: c.text,
                  padding: 0,
                  height: inputHeight,
                  textAlignVertical: multiline ? 'top' : 'center',
                },
                style,
              ]}
              onFocus={(event) => {
                setFocused(true);
                onFocus?.(event);
              }}
              onBlur={(event) => {
                setFocused(false);
                onBlur?.(event);
              }}
              onContentSizeChange={(event) => {
                setContentHeight(event.nativeEvent.contentSize.height);
                onContentSizeChange?.(event);
              }}
            />
          </Animated.View>
          {hasText && !!suffix && (
            <>
              <NativeText
                accessible={false}
                importantForAccessibility="no-hide-descendants"
                pointerEvents="none"
                numberOfLines={1}
                style={[textStyle, { position: 'absolute', opacity: 0, width: 10000 }]}
                onTextLayout={(event) => setTextWidth(event.nativeEvent.lines[0]?.width ?? 0)}
              >
                {props.secureTextEntry ? '•'.repeat(value.length) : value}
              </NativeText>
              <Animated.View
                style={{
                  position: 'absolute',
                  left: Math.min(textWidth, fieldWidth) + 4,
                  top: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [(height - 24 * fontScale) / 2, expandedY],
                  }),
                }}
                onLayout={(event) => setSuffixWidth(event.nativeEvent.layout.width)}
              >
                <BUIText kind="body1" color={c.muted}>
                  {suffix}
                </BUIText>
              </Animated.View>
            </>
          )}
          {hasTrailing && (
            <XStack
              position="absolute"
              r={0}
              t={0}
              b={0}
              gap={8}
              items="center"
              onLayout={(event) => setTrailingWidth(event.nativeEvent.layout.width)}
            >
              {loading && <Spinner size={16} color={c.primary} />}
              {clear && (
                <AppPressable
                  accessibilityLabel={`Clear ${label}`}
                  width={16}
                  minHeight={16}
                  hitSlop={16}
                  onPress={() => {
                    onChangeText('');
                    input.current?.focus();
                  }}
                >
                  <XCircle size={16} color={c.iconSecondary} />
                </AppPressable>
              )}
              {showTrailing && trailing}
            </XStack>
          )}
        </YStack>
      </YStack>
      <BUIFormMessage error={error} helper={helper} />
    </YStack>
  );
});

export const BUITextArea = forwardRef<TextInput, BUIInputProps>(function BUITextArea(props, ref) {
  return <BUIInput {...props} ref={ref} multiline />;
});

export const BUIPasswordInput = forwardRef<
  TextInput,
  Omit<BUIInputProps, 'secureTextEntry' | 'trailing' | 'disableClear' | 'multiline'>
>(function BUIPasswordInput({ onBlur, disabled, readOnly, ...props }, ref) {
  const [revealed, setRevealed] = useState(false);
  const c = useBUITheme();
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') setRevealed(false);
    });
    return () => subscription.remove();
  }, []);
  const Icon = revealed ? EyeOff : Eye;
  return (
    <BUIInput
      {...props}
      ref={ref}
      disabled={disabled}
      readOnly={readOnly}
      secureTextEntry={!revealed}
      autoCapitalize="none"
      autoCorrect={false}
      disableClear
      onBlur={(event) => {
        setRevealed(false);
        onBlur?.(event);
      }}
      trailing={
        <AppPressable
          accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
          accessibilityState={{ expanded: revealed }}
          disabled={disabled || readOnly}
          width={20}
          minHeight={20}
          hitSlop={14}
          onPress={() => setRevealed((value) => !value)}
        >
          <Icon size={20} color={c.iconSecondary} />
        </AppPressable>
      }
    />
  );
});

export const BUISearchInput = forwardRef<
  TextInput,
  Omit<TextInputProps, 'value' | 'onChangeText'> & {
    value: string;
    onChangeText: (value: string) => void;
    label: string;
    disabled?: boolean;
    error?: boolean;
    onCancel?: () => void;
  }
>(function BUISearchInput(
  {
    value,
    onChangeText,
    label,
    disabled = false,
    error = false,
    onCancel,
    onFocus,
    onBlur,
    ...props
  },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const c = useBUITheme();
  return (
    <XStack mx={16} items="center">
      <XStack flex={1} minHeight={48} rounded={20} bg={c.surface} items="center">
        <YStack
          position="absolute"
          t={0}
          l={0}
          r={0}
          b={0}
          rounded={20}
          borderWidth={1.5}
          borderColor={focused ? c.primary : error ? c.negative : c.surface}
          pointerEvents="none"
        />
        <YStack px={16}>
          <Search size={16} color={c.iconSecondary} />
        </YStack>
        <TextInput
          {...props}
          ref={ref}
          accessibilityLabel={label}
          value={value}
          onChangeText={(text) => {
            if (!disabled) onChangeText(text);
          }}
          editable={!disabled}
          placeholder={label}
          placeholderTextColor={c.muted}
          selectionColor={error ? c.negative : c.primary}
          returnKeyType="search"
          style={{
            flex: 1,
            minWidth: 0,
            fontFamily: 'InterTextRegular',
            fontSize: 16,
            lineHeight: 24,
            letterSpacing: 0.08,
            includeFontPadding: false,
            color: disabled ? c.tertiaryText : c.text,
            paddingVertical: 6,
            paddingHorizontal: 2,
          }}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
        />
        {!!value && (
          <AppPressable
            accessibilityLabel={`Clear ${label}`}
            disabled={disabled}
            minHeight={48}
            width={48}
            items="center"
            justify="center"
            onPress={() => onChangeText('')}
          >
            <XCircle size={16} color={c.iconSecondary} />
          </AppPressable>
        )}
      </XStack>
      {onCancel && (
        <AppPressable
          accessibilityLabel="Cancel search"
          minHeight={48}
          px={16}
          justify="center"
          onPress={onCancel}
        >
          <BUIText color={c.primary}>Cancel</BUIText>
        </AppPressable>
      )}
    </XStack>
  );
});
