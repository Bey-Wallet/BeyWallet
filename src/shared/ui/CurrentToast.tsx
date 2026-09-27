import React, { useEffect, useMemo } from 'react';
import { AlertCircle, Check, Info } from '@tamagui/lucide-icons';
import { Toast, useToastController, useToastState } from '@tamagui/toast';
import { Button, Circle, Spinner, Text, XStack, YStack } from 'tamagui';
import * as Haptics from 'expo-haptics';

type ToastKind = 'loading' | 'success' | 'error' | 'warning' | 'info';

type ToastVariant = 'default' | 'action';

export interface ToastActionData {
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

export function CurrentToast() {
  const currentToast = useToastState();
  const controller = useToastController();

  const kind = useMemo(
    () => inferKind(currentToast?.title || '', (currentToast as any)?.type),
    [currentToast?.id, currentToast?.title],
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
      <Spinner size="small" color="$color" />
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

        <Toast.Title flexShrink={1} fontSize="$4" fontWeight="800" color="$color" lineHeight={18}>
          {currentToast.title}
        </Toast.Title>

        <Button
          size="$2"
          rounded={3000}
          fontWeight="800"
          pressStyle={{
            opacity: 0.6,
          }}
          onPress={() => {
            actionData.onAction?.();
            controller.hide();
          }}
          accessibilityLabel={actionData.actionLabel}
        >
          {actionData.actionLabel}
        </Button>
      </XStack>
    </Toast>
  );
}

export function ToastControl() {
  const toast = useToastController();

  const show = (kind: ToastKind, variant: ToastVariant = 'default') => {
    const content: Record<
      ToastKind,
      {
        title: string;
        duration?: number;
      }
    > = {
      info: {
        title: 'Your wallet is ready',
      },

      loading: {
        title: 'Processing your Lightning payment',
        duration: 12_000,
      },

      success: {
        title: '1,000 sats from arshad@bey.cash',
      },

      warning: {
        title: 'Mint Untrusted',
      },

      error: {
        title: 'Payment failed',
      },
    };

    const selected = content[kind];

    toast.show(selected.title, {
      id: `toast-ui-preview-${kind}-${variant}`,
      duration: selected.duration || 3_000,

      customData:
        variant === 'action'
          ? {
              variant: 'action',
              actionLabel: kind === 'error' ? 'Retry' : 'View',

              onAction: () => {
                // Add action here.
              },
            }
          : {
              variant: 'default',
            },
    });
  };

  return (
    <YStack
      width="100%"
      gap="$2"
      p="$3"
      bg="$gray2"
      borderWidth={1}
      borderColor="$gray5"
      rounded="$5"
    >
      <YStack gap={2}>
        <Text fontSize="$3" fontWeight="800">
          Toast Lab
        </Text>

        <Text fontSize="$2" color="$gray10">
          Temporary controls for testing every toast state.
        </Text>
      </YStack>

      {/* Default toasts */}

      <XStack gap="$2">
        <ToastPreviewButton label="Info" onPress={() => show('info')} />

        <ToastPreviewButton label="Loading" onPress={() => show('loading')} />

        <ToastPreviewButton label="Success" onPress={() => show('success')} />
      </XStack>

      <XStack gap="$2">
        <ToastPreviewButton label="Warning" onPress={() => show('warning')} />

        <ToastPreviewButton label="Error" onPress={() => show('error')} />
      </XStack>

      {/* Action toasts */}

      <Text mt="$1" fontSize="$2" fontWeight="700" color="$gray10">
        Action variant
      </Text>

      <XStack gap="$2">
        <ToastPreviewButton label="Received · View" onPress={() => show('success', 'action')} />

        <ToastPreviewButton label="Error · Retry" onPress={() => show('error', 'action')} />
      </XStack>
    </YStack>
  );
}

function ToastPreviewButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Button flex={1} size="$3" bg="$gray4" borderWidth={1} borderColor="$gray6" onPress={onPress}>
      {label}
    </Button>
  );
}
