import React from 'react';
import { useWindowDimensions } from 'react-native';
import { X, AlertTriangle, Check, Info } from '@tamagui/lucide-icons';
import { Toast } from '@tamagui/toast';
import { XStack, YStack } from 'tamagui';
import { Spinner } from './Spinner';
import { AppTextButton } from './AppTextButton';
import { useReducedMotion } from '~/shared/hooks/useReducedMotion';
import type { ToastKind } from './AppToast';

// The approved surface, shared by passive notices and operation progress.
export const toastSurfaceProps = {
  themeInverse: true,
  width: 'auto',
  minHeight: 54,
  rounded: 999,
  px: '$3',
  pr: '$4',
  py: '$2',
  bg: '$background',
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
  const isActionToast = !!action;
  const stackAction =
    isActionToast &&
    (fontScale > 1.3 ||
      (maxWidth < 300 && title.length + (action?.label?.length ?? 0) > 28) ||
      (action?.label?.length ?? 0) > 18);
  const statusBackground =
    kind === 'success'
      ? '$toastSuccessBackground'
      : kind === 'error'
        ? '$toastErrorBackground'
        : kind === 'warning'
          ? '$toastWarningBackground'
          : '$toastInfoBackground';

  /*
   * Same icon styling for BOTH default and action toasts.
   */
  const statusIcon =
    kind === 'loading' ? (
      <Spinner size={22} strokeWidth={3} color="$iconPrimary" reduceMotion={reducedMotion} />
    ) : kind === 'success' ? (
      <Check size={18} strokeWidth={3} color="$toastStatusForeground" />
    ) : kind === 'error' ? (
      <X size={18} strokeWidth={2.5} color="$toastStatusForeground" />
    ) : kind === 'warning' ? (
      <AlertTriangle size={18} strokeWidth={2.2} color="$toastStatusForeground" />
    ) : (
      <Info size={18} strokeWidth={2.2} color="$toastStatusForeground" />
    );

  return (
    <XStack
      flexDirection={stackAction ? 'column' : 'row'}
      items={stackAction ? 'stretch' : 'center'}
      gap={stackAction ? '$1' : '$2'}
    >
      <XStack flexShrink={1} minW={0} gap="$2" items="center">
        <YStack
          width={32}
          height={32}
          rounded={16}
          bg={kind === 'loading' ? 'transparent' : statusBackground}
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
          gap={2}
          justify="center"
          accessibilityLiveRegion="polite"
          aria-live="polite"
        >
          <Toast.Title
            flexShrink={1}
            fontFamily="$body"
            fontSize={14}
            fontWeight="600"
            color="$iconPrimary"
            lineHeight={20}
          >
            {title}
          </Toast.Title>
          {!!message && (
            <Toast.Description
              fontFamily="$body"
              fontSize={12}
              lineHeight={18}
              color="$gray10"
              numberOfLines={1}
            >
              {message}
            </Toast.Description>
          )}
        </YStack>
      </XStack>

      {isActionToast && (
        <AppTextButton
          color="$toastAction"
          maxWidth={stackAction ? maxWidth : maxWidth * 0.4}
          alignSelf={stackAction ? 'flex-end' : 'center'}
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
