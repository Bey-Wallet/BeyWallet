import React, { useState } from 'react';
import { Theme, XStack, YStack } from 'tamagui';
import { ToastProvider, useToastController } from '@tamagui/toast';
import { BUIChoices, BUIPage, BUISection } from '~/shared/ui/BUI';
import { AppButton } from '~/shared/ui/AppButton';
import { AppToast, type ToastKind } from '~/shared/ui/AppToast';
import { AppToastViewport } from '~/shared/ui/AppToastViewport';
import { useBUIStore } from '~/state/buiStore';

const examples: Record<ToastKind, { title: string; long: string }> = {
  success: { title: 'Mint added', long: 'Your mint was added and is ready to use in this wallet.' },
  error: {
    title: 'Could not connect to mint',
    long: 'The mint could not be reached. Check your connection and try again.',
  },
  warning: {
    title: 'Connection unavailable',
    long: 'This mint is temporarily unavailable. Try checking its connection again later.',
  },
  info: {
    title: 'Mint URL copied',
    long: 'The mint address has been copied and is ready to share with another wallet.',
  },
  loading: {
    title: 'Checking mint…',
    long: 'Checking the mint connection and loading its available payment methods…',
  },
};

/** A local provider keeps playground notices separate from wallet feedback. */
export function BUIToastsScreen() {
  const appearance = useBUIStore((state) => state.appearance);
  return (
    <Theme name={appearance === 'light' ? 'light' : 'dark'}>
      <ToastProvider swipeDirection="horizontal" duration={3000} native={[]}>
        <ToastPlayground />
        <AppToast />
        <AppToastViewport />
      </ToastProvider>
    </Theme>
  );
}

function ToastPlayground() {
  const toast = useToastController();
  const [kind, setKind] = useState<ToastKind>('info');
  const [length, setLength] = useState<'Short' | 'Long'>('Short');
  const [description, setDescription] = useState<'Title only' | 'With details'>('Title only');
  const [action, setAction] = useState<'No action' | 'With action'>('No action');
  const [status, setStatus] = useState('Sample notices only. No wallet operations run.');
  const show = () => {
    toast.show(length === 'Long' ? examples[kind].long : examples[kind].title, {
      duration: kind === 'loading' ? 6000 : 3000,
      message:
        description === 'With details'
          ? 'This is a preview of supporting details for a wallet notice.'
          : undefined,
      customData: {
        kind,
        essentialDescription: description === 'With details',
        ...(action === 'With action'
          ? {
              variant: 'action',
              actionLabel: 'View',
              onAction: () => setStatus('Preview action tapped. No navigation or wallet changes.'),
            }
          : {}),
      },
    });
  };
  return (
    <BUIPage title="BUI / Toasts" status={status}>
      <BUISection
        name="Status"
        measurement="ListTable row styling: 16-point corners and side padding, compact 8-point vertical padding, 14-point title and 13-point details. Single-line content centers; multiline content aligns to the top. Status text and icons share higher-contrast colors."
      >
        <YStack px={16} gap={12}>
          <BUIChoices
            values={['success', 'error', 'warning', 'info', 'loading'] as const}
            value={kind}
            onChange={setKind}
          />
        </YStack>
      </BUISection>
      <BUISection
        name="Content"
        measurement="Try long copy and large system text. Action buttons stack when space is limited; essential descriptions wrap."
      >
        <YStack px={16} gap={12}>
          <BUIChoices values={['Short', 'Long'] as const} value={length} onChange={setLength} />
          <BUIChoices
            values={['Title only', 'With details'] as const}
            value={description}
            onChange={setDescription}
          />
          <BUIChoices
            values={['No action', 'With action'] as const}
            value={action}
            onChange={setAction}
          />
        </YStack>
      </BUISection>
      <BUISection
        name="Live preview"
        measurement="Uses the existing top placement, safe-area gutters and 360-point width cap. Swipe horizontally to dismiss. Loading preview ends after six seconds."
      >
        <XStack px={16} gap={12} flexWrap="wrap">
          <AppButton onPress={show}>Show toast</AppButton>
          <AppButton emphasis="secondary" onPress={() => toast.hide()}>
            Dismiss
          </AppButton>
        </XStack>
      </BUISection>
    </BUIPage>
  );
}
