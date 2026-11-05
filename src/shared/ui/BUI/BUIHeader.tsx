import React, { forwardRef, useEffect, useRef, useState } from 'react';
import { Animated, Easing, I18nManager, PixelRatio, Text as NativeText } from 'react-native';
import { XStack, YStack } from 'tamagui';
import { AppPressable, type AppPressableProps } from '~/shared/ui/AppPressable';
import { Spinner } from '~/shared/ui/Spinner';
import { useReducedMotion } from '~/shared/hooks/useReducedMotion';
import { BUIIcon } from './BUIIcon';
import { BUIText } from './BUIText';
import { useBUIChromeTheme as useBUITheme } from './useBUITheme';
import { buiBadgeOffset } from './badgeGeometry';
import {
  buiHeaderTitleInset,
  buiHeaderTitleScale,
  buiLargeHeaderHeight,
} from './navigationGeometry';

function useHeaderProgress(visible: boolean, onHidden?: () => void) {
  const reducedMotion = useReducedMotion();
  const progress = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const hiddenCallback = useRef(onHidden);
  hiddenCallback.current = onHidden;
  useEffect(() => {
    if (reducedMotion) {
      progress.setValue(visible ? 1 : 0);
      if (!visible) hiddenCallback.current?.();
      return;
    }
    const motion = Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: 180,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
      useNativeDriver: false,
    });
    motion.start(({ finished }) => {
      if (finished && !visible) hiddenCallback.current?.();
    });
    return () => motion.stop();
  }, [visible, progress, reducedMotion]);
  return progress;
}

export const BUIHeaderAction = forwardRef<
  React.ComponentRef<typeof AppPressable>,
  Omit<AppPressableProps, 'accessibilityLabel'> & {
    label: string;
    busy?: boolean;
  }
>(function BUIHeaderAction(
  { label, children, disabled = false, busy = false, onPress, accessibilityState, ...props },
  ref,
) {
  const c = useBUITheme();
  const blocked = disabled || busy;
  const selected = accessibilityState?.selected || accessibilityState?.expanded;
  return (
    <AppPressable
      {...props}
      ref={ref}
      accessibilityLabel={label}
      accessibilityState={{ ...accessibilityState, disabled: blocked, busy }}
      disabled={blocked}
      width={32}
      height={32}
      minHeight={32}
      rounded={16}
      hitSlop={8}
      bg={selected ? c.primary : c.secondaryButton[0]}
      opacity={disabled && !busy ? 0.48 : 1}
      items="center"
      justify="center"
      onPress={(event) => {
        if (!blocked) onPress?.(event);
      }}
      hoverStyle={{ bg: selected ? c.primaryPressed : c.secondaryButton[2], opacity: 1 }}
      pressStyle={{ bg: selected ? c.primaryPressed : c.secondaryButton[2], opacity: 1 }}
    >
      {children}
    </AppPressable>
  );
});

export function BUIHeaderIcon({
  label,
  children,
  badge = false,
  onPress,
}: {
  label: string;
  children: React.ReactNode;
  badge?: boolean;
  onPress: () => void;
}) {
  const c = useBUITheme();
  const dot = buiBadgeOffset(
    'Corner',
    I18nManager.isRTL ? 'StartTop' : 'EndTop',
    { width: 22, height: 22 },
    { width: 6, height: 6 },
    PixelRatio.get(),
  );
  return (
    <AppPressable
      accessibilityLabel={`${label}${badge ? ', unread' : ''}`}
      width={48}
      height={48}
      minHeight={48}
      rounded={24}
      items="center"
      justify="center"
      onPress={onPress}
    >
      <YStack
        width={22}
        height={22}
        accessible={false}
        importantForAccessibility="no-hide-descendants"
      >
        {children}
        {badge && (
          <YStack
            pointerEvents="none"
            position="absolute"
            l={dot.x}
            t={dot.y}
            width={6}
            height={6}
            rounded={3}
            bg={c.negative}
          />
        )}
      </YStack>
    </AppPressable>
  );
}

function HeaderTitle({
  title,
  variant,
  shrink,
  liveRegion,
}: {
  title: string;
  variant: 'centered' | 'simple' | 'modal';
  shrink: boolean;
  liveRegion?: 'none' | 'polite' | 'assertive';
}) {
  const c = useBUITheme();
  const [available, setAvailable] = useState(0);
  const [measured, setMeasured] = useState({ text: '', width: 0 });
  const size = variant === 'centered' ? 24 : 20;
  const scale =
    shrink && measured.text === title ? buiHeaderTitleScale(measured.width, available) : 1;
  return (
    <YStack
      maxWidth="100%"
      width="100%"
      onLayout={({ nativeEvent }) => setAvailable(nativeEvent.layout.width)}
    >
      {shrink && (
        <NativeText
          pointerEvents="none"
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          numberOfLines={1}
          style={{
            position: 'absolute',
            width: 100000,
            opacity: 0,
            fontFamily: 'InterTextSemiBold',
            fontSize: size,
            letterSpacing: 0,
            includeFontPadding: false,
          }}
          onTextLayout={({ nativeEvent }) => {
            const width = nativeEvent.lines[0]?.width ?? 0;
            setMeasured((current) =>
              current.text === title && current.width === width ? current : { text: title, width },
            );
          }}
        >
          {title}
        </NativeText>
      )}
      <BUIText
        accessibilityLiveRegion={liveRegion}
        color={c.text}
        kind={variant === 'centered' ? 'h2' : 'h3'}
        fontSize={size * scale}
        numberOfLines={1}
        textAlign="center"
        accessibilityRole="header"
      >
        {title}
      </BUIText>
    </YStack>
  );
}

export function BUIHeader({
  title,
  subtitle,
  variant = 'modal',
  navigation = 'back',
  onNavigate,
  actions,
  onTitlePress,
  titleLabel,
  updating = false,
  textVisible = true,
  shrink = false,
  divider = false,
  topInset = 0,
  leading,
  titleContent: customTitle,
  navigationDisabled = false,
  navigationLabel,
  horizontalInset = 16,
  transparent = false,
  titleLiveRegion,
}: {
  title: string;
  leading?: React.ReactNode;
  titleContent?: React.ReactNode;
  navigationDisabled?: boolean;
  navigationLabel?: string;
  horizontalInset?: number;
  transparent?: boolean;
  titleLiveRegion?: 'none' | 'polite' | 'assertive';
  subtitle?: string;
  variant?: 'centered' | 'simple' | 'modal';
  navigation?: 'back' | 'close' | 'none';
  onNavigate?: () => void;
  actions?: React.ReactNode;
  onTitlePress?: () => void;
  titleLabel?: string;
  updating?: boolean;
  textVisible?: boolean;
  shrink?: boolean;
  divider?: boolean;
  topInset?: number;
}) {
  const c = useBUITheme();
  const hasLeading = !!leading || navigation !== 'none';
  const [navigationWidth, setNavigationWidth] = useState(hasLeading ? 48 : 0);
  const [actionsWidth, setActionsWidth] = useState(actions ? 32 : 0);
  const hasActions = !!actions;
  const [renderActions, setRenderActions] = useState(hasActions);
  const lastActions = useRef(actions);
  if (hasActions) lastActions.current = actions;
  useEffect(() => {
    if (hasActions) setRenderActions(true);
  }, [hasActions]);
  const actionsAlpha = useHeaderProgress(hasActions, () => setRenderActions(false));
  const titleAlpha = useHeaderProgress(textVisible);
  const subtitleVisible = variant !== 'centered' && (!!subtitle?.trim() || updating);
  const subtitleProgress = useHeaderProgress(subtitleVisible);
  const titleInset =
    buiHeaderTitleInset(hasLeading ? navigationWidth : 0, renderActions ? actionsWidth : 0) -
    16 +
    horizontalInset;
  const titleContent = (
    <Animated.View
      style={{ opacity: titleAlpha, alignItems: 'center', width: '100%' }}
      accessibilityElementsHidden={!textVisible}
      importantForAccessibility={textVisible ? 'auto' : 'no-hide-descendants'}
    >
      {customTitle ?? (
        <HeaderTitle title={title} variant={variant} shrink={shrink} liveRegion={titleLiveRegion} />
      )}
      <Animated.View
        style={{
          height: subtitleProgress.interpolate({ inputRange: [0, 1], outputRange: [0, 20] }),
          opacity: subtitleProgress,
          overflow: 'hidden',
          justifyContent: 'center',
          alignItems: 'center',
          maxWidth: '100%',
        }}
        accessibilityElementsHidden={!subtitleVisible}
        importantForAccessibility={subtitleVisible ? 'auto' : 'no-hide-descendants'}
      >
        {subtitleVisible && updating ? (
          <YStack
            height={20}
            items="center"
            justify="center"
            accessible
            accessibilityLabel="Updating"
            accessibilityRole="progressbar"
            accessibilityState={{ busy: true }}
          >
            <Spinner size={12} strokeWidth={1.5} color={c.muted} />
          </YStack>
        ) : (
          subtitleVisible && (
            <BUIText
              kind="body2"
              lineHeight={variant === 'simple' ? 20 : undefined}
              fontWeight={variant === 'simple' ? '500' : '400'}
              numberOfLines={1}
              color={c.muted}
            >
              {subtitle}
            </BUIText>
          )
        )}
      </Animated.View>
    </Animated.View>
  );
  return (
    <YStack width="100%" bg={transparent ? 'transparent' : c.canvas} pt={Math.max(0, topInset)}>
      <YStack height={64}>
        <YStack
          position="absolute"
          t={0}
          b={0}
          l={titleInset}
          r={titleInset}
          items="center"
          justify="center"
          pointerEvents={textVisible ? 'auto' : 'none'}
          accessibilityElementsHidden={!textVisible}
          importantForAccessibility={textVisible ? 'auto' : 'no-hide-descendants'}
        >
          {onTitlePress ? (
            <AppPressable
              minHeight={48}
              width="100%"
              items="center"
              justify="center"
              accessibilityLabel={titleLabel ?? title}
              disabled={!textVisible}
              onPress={() => {
                if (textVisible) onTitlePress();
              }}
              pressStyle={{ opacity: 1 }}
            >
              {titleContent}
            </AppPressable>
          ) : (
            titleContent
          )}
        </YStack>
        {hasLeading && (
          <XStack
            position="absolute"
            l={horizontalInset}
            t={0}
            b={0}
            items="center"
            onLayout={({ nativeEvent }) => setNavigationWidth(nativeEvent.layout.width)}
          >
            {leading ?? (
              <BUIHeaderAction
                label={navigationLabel ?? (navigation === 'close' ? 'Close' : 'Back')}
                disabled={navigationDisabled || !onNavigate}
                onPress={() => {
                  if (!navigationDisabled) onNavigate?.();
                }}
              >
                <BUIIcon
                  name={navigation === 'close' ? 'close' : 'back'}
                  size={22}
                  color={c.secondaryButton[3]}
                />
              </BUIHeaderAction>
            )}
          </XStack>
        )}
        {renderActions && (
          <Animated.View
            pointerEvents={hasActions ? 'auto' : 'none'}
            accessibilityElementsHidden={!hasActions}
            importantForAccessibility={hasActions ? 'auto' : 'no-hide-descendants'}
            style={{
              position: 'absolute',
              right: horizontalInset,
              top: 0,
              bottom: 0,
              justifyContent: 'center',
              opacity: actionsAlpha,
            }}
          >
            <XStack
              gap={8}
              items="center"
              onLayout={({ nativeEvent }) => setActionsWidth(nativeEvent.layout.width)}
            >
              {lastActions.current}
            </XStack>
          </Animated.View>
        )}
      </YStack>
      {divider && <YStack height={0.5} bg={c.separator} />}
    </YStack>
  );
}

export function BUILargeHeader({
  title,
  offset,
  topInset = 0,
}: {
  title: string;
  offset: number;
  topInset?: number;
}) {
  const c = useBUITheme();
  const height = buiLargeHeaderHeight(offset, PixelRatio.get());
  return (
    <YStack bg={c.canvas} pt={Math.max(0, topInset)}>
      <YStack
        height={height}
        overflow="hidden"
        justify="flex-end"
        px={16}
        accessibilityElementsHidden={height === 0}
        importantForAccessibility={height === 0 ? 'no-hide-descendants' : 'auto'}
      >
        <BUIText color={c.text} kind="h1" accessibilityRole="header" flexShrink={0}>
          {title}
        </BUIText>
      </YStack>
    </YStack>
  );
}
