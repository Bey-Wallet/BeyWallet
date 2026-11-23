import React, { useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { X, AlertTriangle, Check, Info } from '~/shared/icons';
import { Toast } from '@tamagui/toast';
import { XStack, YStack } from 'tamagui';
import { Spinner } from './Spinner';
import { AppTextButton } from './AppTextButton';
import { useReducedMotion } from '~/shared/hooks/useReducedMotion';
import type { ToastKind } from './AppToast';
import { appDimensions, appSpacing, appTypography } from '~/shared/theme/appearance';

// The approved surface, shared by passive notices and operation progress.
export const toastSurfaceProps = {
  themeInverse: false,
  width: 'auto',
  minHeight: appDimensions.touchTarget,
  rounded: '$6',
  px: appSpacing.page,
  py: appSpacing.compact,
  bg: '$gray2',
  alignSelf: 'center',
  justify: 'center',
  mx: 0,
} as const;

export function ToastContent({
  kind,
  title,
  message,
  action,
  maxWidth,
}: {
  kind: ToastKind;
  title: string;
  message?: string;
  maxWidth: number;
  action?: { label: string; onPress: () => void };
}) {
  const { fontScale } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const [titleLayout, setTitleLayout] = useState<{
    title: string;
    width: number;
    fontScale: number;
    multiline: boolean;
  } | null>(null);
  const multiline =
    !!message ||
    title.includes('\n') ||
    (titleLayout?.title === title &&
      titleLayout.width === maxWidth &&
      titleLayout.fontScale === fontScale &&
      titleLayout.multiline);
  const alignment = multiline ? 'flex-start' : 'center';
  const isActionToast = !!action;
  const stackAction =
    isActionToast &&
    (fontScale > 1.3 ||
      (maxWidth < 300 && title.length + (action?.label?.length ?? 0) > 28) ||
      (action?.label?.length ?? 0) > 18);
  const statusColor =
    kind === 'success'
      ? '$toastSuccessForeground'
      : kind === 'error'
        ? '$toastErrorForeground'
        : kind === 'warning'
          ? '$toastWarningForeground'
          : '$toastInfoForeground';

  /*
   * Same icon styling for BOTH default and action toasts.
   */
  const statusIcon =
    kind === 'loading' ? (
      <Spinner size={22} strokeWidth={3} color={statusColor} reduceMotion={reducedMotion} />
    ) : kind === 'success' ? (
      <Check size={20} strokeWidth={2.5} color={statusColor} />
    ) : kind === 'error' ? (
      <X size={20} strokeWidth={2.5} color={statusColor} />
    ) : kind === 'warning' ? (
      <AlertTriangle size={20} strokeWidth={2} color={statusColor} />
    ) : (
      <Info size={20} strokeWidth={2} color={statusColor} />
    );

  return (
    <XStack
      flexDirection={stackAction ? 'column' : 'row'}
      items={stackAction ? 'stretch' : alignment}
      gap={stackAction ? appSpacing.small : appSpacing.compact}
    >
      <XStack flexShrink={1} minW={0} gap={appSpacing.compact} items={alignment}>
        <YStack
          width={22}
          height={22}
          flexShrink={0}
          items="center"
          justify="center"
          aria-hidden
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {statusIcon}
        </YStack>

        <YStack
          flexShrink={1}
          minW={0}
          gap={0}
          justify="center"
          accessibilityLiveRegion="polite"
          aria-live="polite"
          onLayout={({ nativeEvent }) => {
            // Leave room for native font padding when identifying a second line.
            const wrapped =
              nativeEvent.layout.height > appTypography.body1.lineHeight * fontScale * 1.5;
            setTitleLayout((current) =>
              current?.title === title &&
              current.width === maxWidth &&
              current.fontScale === fontScale &&
              current.multiline === wrapped
                ? current
                : { title, width: maxWidth, fontScale, multiline: wrapped },
            );
          }}
        >
          <Toast.Title
            flexShrink={1}
            fontFamily="$body"
            {...appTypography.body1}
            color={statusColor}
          >
            {title}
          </Toast.Title>
          {!!message && (
            <Toast.Description fontFamily="$body" {...appTypography.body2} color={statusColor}>
              {message}
            </Toast.Description>
          )}
        </YStack>
      </XStack>

      {isActionToast && (
        <AppTextButton
          color={statusColor}
          maxWidth={stackAction ? maxWidth : maxWidth * 0.4}
          alignSelf={stackAction ? 'flex-end' : alignment}
          onPress={() => {
            action?.onPress();
          }}
          accessibilityLabel={action?.label}
        >
          {action?.label ?? 'View'}
        </AppTextButton>
      )}
    </XStack>
  );
}
