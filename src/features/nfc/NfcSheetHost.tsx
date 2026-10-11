import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';
import { FullWindowOverlay } from 'react-native-screens';
import { Button, Text, YStack } from 'tamagui';
import { Nfc } from '@tamagui/lucide-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import AppBottomSheet, { type AppBottomSheetRef } from '~/shared/ui/AppBottomSheet';
import { useAuthStore } from '~/state/authStore';
import { useSettingsStore } from '~/state/settingsStore';
import { useWalletStore } from '~/state/walletStore';
import { nfcService } from '~/services/platform/nfcService';
import { nfcFlow } from './nfcFlow';

export function useNfcPresentation() {
  return useSyncExternalStore(nfcFlow.subscribe, nfcFlow.getSnapshot, nfcFlow.getSnapshot);
}

function NfcWindowOverlay({ children }: React.PropsWithChildren) {
  return <FullWindowOverlay>{children}</FullWindowOverlay>;
}

export function NfcSheetHost({ walletReady }: { walletReady: boolean }) {
  const state = useNfcPresentation();
  const ref = useRef<AppBottomSheetRef>(null);
  const insets = useSafeAreaInsets();
  const authenticated = useAuthStore((store) => store.isAuthenticated);
  const biometric = useSettingsStore((store) => store.biometricEnabled);
  const settingsReady = useSettingsStore((store) => store.initialized);
  const mints = useWalletStore((store) => store.mints);
  const queryClient = useQueryClient();
  useEffect(() => {
    nfcFlow.setReady(walletReady && settingsReady && (!biometric || authenticated));
  }, [walletReady, settingsReady, biometric, authenticated]);
  useEffect(() => {
    if (state.visible) ref.current?.present();
    else ref.current?.dismiss();
  }, [state.visible]);
  useEffect(() => {
    if (state.status === 'confirmed' || state.hasPayment) {
      void queryClient.invalidateQueries({ queryKey: ['history'] });
      void queryClient.invalidateQueries({ queryKey: ['balance'] });
    }
  }, [state.status, state.hasPayment, queryClient]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'background') void nfcFlow.background();
    });
    return () => {
      subscription.remove();
      nfcFlow.setReady(false);
      nfcFlow.background();
    };
  }, []);
  const mint = mints.find((item: { mintUrl: string }) => item.mintUrl === state.mintUrl);
  const titles = {
    ready: state.direction === 'send' ? 'Send via NFC' : 'Receive / Pay',
    reading: 'Reading',
    sending: 'Sending',
    receiving: 'Receiving',
    paying: 'Paying',
    pending: 'Awaiting recipient',
    unconfirmed: 'Receipt unconfirmed',
    confirmed:
      state.direction === 'send' ? 'Sent' : state.direction === 'pay' ? 'Paid' : 'Received',
    error: 'NFC could not complete',
    disabled: 'Enable NFC to continue',
    unsupported: 'NFC is unavailable on this device',
  };
  const viewHistory = () => {
    if (nfcFlow.dismiss()) router.push('/(tabs)/history');
  };
  return (
    <AppBottomSheet
      ref={ref}
      containerComponent={Platform.OS === 'ios' ? NfcWindowOverlay : undefined}
      canDismiss={!state.visible || (!state.locked && state.status !== 'confirmed')}
      onClose={() => {
        nfcFlow.dismiss();
      }}
    >
      <YStack px="$4" pt="$3" pb={Math.max(insets.bottom, 16)} gap="$3" items="center">
        <Nfc size={28} color="$color" />
        <Text fontSize="$6" fontWeight="700" textAlign="center">
          {titles[state.status]}
        </Text>
        {state.amount !== undefined && (
          <Text fontSize="$7" fontWeight="700">
            {state.amount.toLocaleString()} sats
          </Text>
        )}
        <Text color="$color11" textAlign="center">
          {state.message}
        </Text>
        {state.mintUrl && (
          <Text fontSize="$2" color="$color10">
            {mint?.nickname || mint?.name || state.mintUrl.replace(/^https?:\/\//, '')}
          </Text>
        )}
        {state.fees !== undefined && (
          <Text fontSize="$2" color="$color10">
            Fees: {state.fees} sats
          </Text>
        )}
        {state.status === 'disabled' && (
          <Button onPress={() => nfcService.goToNfcSetting()}>Open NFC settings</Button>
        )}
        {['pending', 'unconfirmed'].includes(state.status) ||
        (state.status === 'error' && state.hasPayment) ? (
          <Button disabled={state.locked} onPress={nfcFlow.refresh}>
            Refresh status
          </Button>
        ) : null}
        {state.status === 'error' && state.canRetryDelivery && (
          <Button onPress={nfcFlow.retry}>Retry delivery</Button>
        )}
        {state.status === 'error' && !state.hasPayment && (
          <Button onPress={nfcFlow.retry}>Try again</Button>
        )}
        {state.status === 'disabled' && <Button onPress={nfcFlow.retry}>Check NFC</Button>}
        {['unconfirmed', 'error'].includes(state.status) && state.hasPayment && (
          <Button disabled={state.locked} onPress={viewHistory}>
            View History
          </Button>
        )}
        <Button disabled={state.locked} onPress={nfcFlow.dismiss}>
          {state.status === 'confirmed' ? 'Done' : 'Close'}
        </Button>
      </YStack>
    </AppBottomSheet>
  );
}
