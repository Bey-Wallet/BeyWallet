import React from 'react';
import { ToastContent, toastSurfaceProps } from './ToastContent';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Toast, useToastController, useToastState } from '@tamagui/toast';
import { useReducedMotion } from '~/shared/hooks/useReducedMotion';
import { getToastLayout } from './toastLayout';

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
  essentialDescription?: boolean;
}

export function AppToast() {
  const currentToast = useToastState();
  const controller = useToastController();
  const reducedMotion = useReducedMotion();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const layout = getToastLayout(width, insets);

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
  const showDescription = customData?.essentialDescription === true;

  const actionData: ToastActionData = {
    variant: customData?.variant ?? (currentToast as any)?.variant,

    actionLabel: customData?.actionLabel ?? (currentToast as any)?.actionLabel,

    onAction: customData?.onAction ?? (currentToast as any)?.onAction,
  };

  const isActionToast =
    actionData.variant === 'action' && !!actionData.actionLabel && !!actionData.onAction;
  return (
    <Toast
      {...toastSurfaceProps}
      key={currentToast.id}
      duration={currentToast.duration || (kind === 'loading' ? 12_000 : 3_000)}
      animation={reducedMotion ? undefined : 'quick'}

      maxW={layout.width}
    >
      <ToastContent
        kind={kind}
        title={currentToast.title}
        message={showDescription ? currentToast.message : undefined}
        maxWidth={layout.width}
        action={
          isActionToast
            ? {
                label: actionData.actionLabel!,
                onPress: () => {
                  controller.hide();
                  actionData.onAction?.();
                },
              }
            : undefined
        }
      />
    </Toast>
  );
}
