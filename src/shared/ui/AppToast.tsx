import { AppButton } from '~/shared/ui/AppButton';
import React from 'react';
import { AlertCircle, Check, Info } from '@tamagui/lucide-icons';
import { Toast, useToastController, useToastState } from '@tamagui/toast';
import { XStack, YStack } from 'tamagui';
import { Spinner } from '~/shared/ui/Spinner';
import { useReducedMotion } from '~/shared/hooks/useReducedMotion';

export type ToastKind = 'loading' | 'success' | 'error' | 'warning' | 'info';

declare module '@tamagui/toast' {
  interface CustomData {
    kind?: ToastKind;
  }
}

type ToastVariant = 'default' | 'action';

export interface ToastActionData {
  kind?: ToastKind;
  variant?: ToastVariant;
  actionLabel?: string;
  onAction?: () => void;
}

export function AppToast() {
  const currentToast = useToastState();
  const controller = useToastController();
  const reducedMotion = useReducedMotion();

  // Severity and outcome haptics belong to the publisher, never inferred from copy.
  const kind: ToastKind =
    (currentToast?.customData as ToastActionData | undefined)?.kind ??
    (currentToast as any)?.kind ??
    'info';

  if (!currentToast || currentToast.isHandledNatively) {
    return null;
  }

  /*
   * Tamagui stores custom toast properties inside customData.
   * Support direct properties as a fallback as well.
   */
  const customData = (currentToast as any)?.customData as ToastActionData | undefined;

  const actionData: ToastActionData = {
    variant: customData?.variant ?? (currentToast as any)?.variant,

    actionLabel: customData?.actionLabel ?? (currentToast as any)?.actionLabel,

    onAction: customData?.onAction ?? (currentToast as any)?.onAction,
  };

  const isActionToast =
    actionData.variant === 'action' && !!actionData.actionLabel && !!actionData.onAction;

  /*
   * Same icon styling for BOTH default and action toasts.
   */
  const statusIcon =
    kind === 'loading' ? (
      <Spinner size={16} strokeWidth={3} color="$color" reduceMotion={reducedMotion} />
    ) : kind === 'success' ? (
      <Check size={16} strokeWidth={3} color="$color" />
    ) : kind === 'error' || kind === 'warning' ? (
      <AlertCircle size={16} strokeWidth={3} color="$color" />
    ) : (
      <Info size={16} strokeWidth={3} color="$color" />
    );

  /*
   * DEFAULT TOAST
   *
   * Original UI preserved.
   */
  if (!isActionToast) {
    return (
      <Toast
        themeInverse
        key={currentToast.id}
        duration={currentToast.duration || (kind === 'loading' ? 12_000 : 3_000)}
        animation={reducedMotion ? undefined : 'quick'}
        mt="$6"
        width="auto"
        maxW={360}
        rounded={3000}
        px="$3"
        pr="$4"
        bg="$gray4"
        alignSelf="center"
      >
        <XStack items="center" gap="$2" py="$2" maxW="100%">
          {statusIcon}

          <YStack
            flexShrink={1}
            minW={0}
            justify="center"
            accessibilityLiveRegion="polite"
            aria-live="polite"
          >
            <Toast.Title
              flexShrink={1}
              fontSize={14}
              fontWeight="600"
              color="$color"
              lineHeight={22}
            >
              {currentToast.title}
            </Toast.Title>
            {!!currentToast.message && (
              <Toast.Description fontSize={12} color="$gray10">
                {currentToast.message}
              </Toast.Description>
            )}
          </YStack>
        </XStack>
      </Toast>
    );
  }

  /*
   * ACTION TOAST
   *
   * Same exact visual language as default.
   * Only difference: action button on the right.
   */
  return (
    <Toast
      key={currentToast.id}
      duration={currentToast.duration || (kind === 'loading' ? 12_000 : 3_000)}
      animation={reducedMotion ? undefined : 'quick'}
      mt="$6"
      width="auto"
      rounded={3000}
      px="$3"
      bg="$gray4"
      style={{
        alignSelf: 'center',
        maxWidth: 360,
      }}
    >
      <XStack items="center" justify="space-between" gap="$2" py="$2">
        {statusIcon}

        <YStack flexShrink={1} accessibilityLiveRegion="polite" aria-live="polite">
          <Toast.Title flexShrink={1} fontSize={14} fontWeight="600" color="$color" lineHeight={22}>
            {currentToast.title}
          </Toast.Title>
          {!!currentToast.message && (
            <Toast.Description fontSize={12} color="$gray10">
              {currentToast.message}
            </Toast.Description>
          )}
        </YStack>

        <AppButton
          variant="default"
          emphasis="secondary"
          size="xxsmall"
          minHeight={48}
          onPress={() => {
            actionData.onAction?.();
            controller.hide();
          }}
          accessibilityLabel={actionData.actionLabel}
        >
          {actionData.actionLabel ?? 'View'}
        </AppButton>
      </XStack>
    </Toast>
  );
}
