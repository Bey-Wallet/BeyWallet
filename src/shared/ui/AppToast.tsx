import { AppButton } from '~/shared/ui/AppButton';
import React, { useEffect, useMemo } from 'react';
import { AlertCircle, Check, Info } from '@tamagui/lucide-icons';
import { Toast, useToastController, useToastState } from '@tamagui/toast';
import { XStack, YStack } from 'tamagui';
import { Spinner } from '~/shared/ui/Spinner';
import { useReducedMotion } from '~/shared/hooks/useReducedMotion';
import * as Haptics from 'expo-haptics';

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

function inferKind(title: string, explicitType?: string): ToastKind {
  const text = `${explicitType || ''} ${title}`.toLowerCase();

  if (/loading|checking|restoring|processing|sending|publishing|creating/.test(text)) {
    return 'loading';
  }

  if (/error|fail|invalid|denied|not paid|warning/.test(text)) {
    return text.includes('warning') ? 'warning' : 'error';
  }

  if (/success|saved|paid|claimed|added|updated|received|loaded|copied|complete/.test(text)) {
    return 'success';
  }

  return 'info';
}

export function AppToast() {
  const currentToast = useToastState();
  const controller = useToastController();
  const reducedMotion = useReducedMotion();

  const kind = useMemo(
    () =>
      (currentToast?.customData as ToastActionData | undefined)?.kind ??
      (currentToast as any)?.kind ??
      inferKind(currentToast?.title || '', (currentToast as any)?.type),
    [currentToast?.id, currentToast?.title, currentToast?.customData, currentToast?.kind],
  );

  useEffect(() => {
    if (!currentToast) return;

    if (kind === 'success') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (kind === 'error') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else if (kind !== 'loading') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [currentToast?.id, kind]);

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
      <Spinner size={16} color="$color" reduceMotion={reducedMotion} />
    ) : kind === 'success' ? (
      <Check size={16} strokeWidth={2.75} color="$color" />
    ) : kind === 'error' || kind === 'warning' ? (
      <AlertCircle size={16} strokeWidth={2.5} color="$color" />
    ) : (
      <Info size={16} strokeWidth={2.5} color="$color" />
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
        animation="quick"
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

          <YStack flexShrink={1} minW={0} justify="center">
            <Toast.Title
              flexShrink={1}
              fontSize="$4"
              fontWeight="800"
              color="$color"
              lineHeight={18}
            >
              {currentToast.title}
            </Toast.Title>
            {currentToast.message && <Toast.Description>{currentToast.message}</Toast.Description>}
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
      animation="quick"
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

        <YStack flexShrink={1}>
          <Toast.Title flexShrink={1} fontSize="$4" fontWeight="800" color="$color" lineHeight={18}>
            {currentToast.title}
          </Toast.Title>
          {currentToast.message && <Toast.Description>{currentToast.message}</Toast.Description>}
        </YStack>

        <AppButton
          variant="default"
          emphasis="secondary"
          size="xxsmall"
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
