import { PaymentStatusIcon } from '~/shared/ui/PaymentStatusIcon';
import { PaymentAmount } from '~/shared/ui/PaymentAmount';
import { formatPaymentDateTime } from '~/shared/utils/time';
import { ListTable, ListTableRow } from '~/shared/ui/ListTable';
import { AppButton } from '~/shared/ui/AppButton';
import { AppFullScreenModal } from '~/shared/ui/AppFullScreenModal';
import React, { useEffect, useSyncExternalStore } from 'react';
import { AppState, ScrollView } from 'react-native';
import { Text, View, XStack, YStack, useTheme } from 'tamagui';
import {
  ArrowUpRight,
  ArrowDownLeft,
  AlertTriangle,
  Settings2,
  Ban,
  Check,
} from '@tamagui/lucide-icons';
import NfcIcon from '~/shared/icons/NfcIcon';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Spinner } from '~/shared/ui/Spinner';
import { appTypography } from '~/shared/theme/appearance';
import { useAuthStore } from '~/state/authStore';
import { useSettingsStore } from '~/state/settingsStore';
import { useWalletStore } from '~/state/walletStore';
import { nfcService } from '~/services/platform/nfcService';
import { nfcFlow } from './nfcFlow';
import { nfcReceiveCoordinator } from '~/services/wallet/nfcReceiveCoordinator';

const stateIcons = {
  starting: Spinner,
  ready: NfcIcon,
  reading: NfcIcon,
  sending: ArrowUpRight,
  receiving: ArrowDownLeft,
  paying: ArrowUpRight,
  pending: Spinner,
  unconfirmed: Spinner,
  confirmed: Check,
  error: AlertTriangle,
  disabled: Settings2,
  unsupported: Ban,
};

export function useNfcPresentation() {
  return useSyncExternalStore(nfcFlow.subscribe, nfcFlow.getSnapshot, nfcFlow.getSnapshot);
}

export function NfcSheetHost({ walletReady }: { walletReady: boolean }) {
  const state = useNfcPresentation();
  const theme = useTheme();
  const authenticated = useAuthStore((store) => store.isAuthenticated);
  const biometric = useSettingsStore((store) => store.biometricEnabled);
  const settingsReady = useSettingsStore((store) => store.initialized);
  const mints = useWalletStore((store) => store.mints);
  const queryClient = useQueryClient();
  useEffect(() => {
    nfcFlow.setReady(walletReady && settingsReady && (!biometric || authenticated));
    nfcReceiveCoordinator.setReady(walletReady && settingsReady && (!biometric || authenticated));
  }, [walletReady, settingsReady, biometric, authenticated]);
  useEffect(() => {
    const stop = nfcReceiveCoordinator.subscribe(() => nfcFlow.resumeRequest());
    return () => {
      stop();
      nfcReceiveCoordinator.setReady(false);
    };
  }, []);
  useEffect(() => {
    if (state.status === 'confirmed' || state.hasPayment) {
      void queryClient.invalidateQueries({ queryKey: ['history'] });
      void queryClient.invalidateQueries({ queryKey: ['balance'] });
    }
  }, [state.status, state.hasPayment, queryClient]);
  useEffect(() => {
    // Remounting can stop the controller without another AppState event.
    if (AppState.currentState === 'active') nfcFlow.foreground();
    else if (AppState.currentState === 'background') void nfcFlow.background();
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'background') void nfcFlow.background();
      else if (next === 'active') {
        nfcFlow.foreground();
        void nfcReceiveCoordinator.processPending();
      }
    });
    return () => {
      subscription.remove();
      nfcFlow.setReady(false);
      nfcFlow.background();
    };
  }, []);
  const mint = mints.find((item: { mintUrl: string }) => item.mintUrl === state.mintUrl);
  const StateIcon = stateIcons[state.status];
  const badgeColor = theme.gray3.val;
  const iconColor = theme.iconPrimary.val;
  const titles = {
    starting: 'Starting NFC',
    ready: 'Hold phones together',
    reading: 'Receive ecash or pay',
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
  const retryDelivery = ['error', 'unconfirmed'].includes(state.status) && state.canRetryDelivery;
  const close = () => {
    if (!nfcFlow.getSnapshot().locked) nfcFlow.dismiss();
  };
  const primaryAction =
    state.status === 'confirmed'
      ? { label: 'Done', run: close }
      : state.status === 'disabled'
        ? { label: 'Open NFC settings', run: () => nfcService.goToNfcSetting() }
        : retryDelivery
          ? { label: 'Retry delivery', run: nfcFlow.retry }
          : state.status === 'error' && !state.hasPayment
            ? { label: 'Try again', run: nfcFlow.retry }
            : ['pending', 'unconfirmed'].includes(state.status) ||
                (state.status === 'error' && state.hasPayment)
              ? { label: 'Refresh status', run: nfcFlow.refresh }
              : undefined;
  const showHistory = ['unconfirmed', 'error'].includes(state.status) && state.hasPayment;
  const showRefresh = retryDelivery && state.hasPayment;
  const showCheckNfc = state.status === 'disabled';
  return (
    <AppFullScreenModal
      visible={state.visible}
      title="NFC"
      closeLabel="Close NFC"
      canDismiss={!state.locked}
      onClose={close}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <YStack flex={1} px="$4" pt="$3" pb="$4" gap="$3" items="center">
          <YStack
            testID="nfc-modal-status"
            width="100%"
            flexGrow={1}
            flexShrink={0}
            py="$6"
            gap="$4"
            items="center"
            justify="center"
          >
            {state.status === 'confirmed' || state.status === 'error' ? (
              <PaymentStatusIcon status={state.status === 'confirmed' ? 'success' : 'error'} />
            ) : (
              <View
                backgroundColor={badgeColor}
                borderRadius={100}
                width={88}
                height={88}
                alignItems="center"
                justifyContent="center"
              >
                <StateIcon size={40} color={iconColor} />
              </View>
            )}
            <Text
              fontFamily="$heading"
              {...appTypography.title2}
              color="$color"
              textAlign="center"
              accessibilityLiveRegion="polite"
            >
              {titles[state.status]}
            </Text>
            {state.amount !== undefined && (
              <PaymentAmount amount={state.amount} compact size="prominent" />
            )}
            <Text
              fontFamily="$body"
              {...appTypography.body2}
              color="$gray10"
              textAlign="center"
              maxWidth={360}
            >
              {state.message}
            </Text>
          </YStack>
          <YStack width="100%" gap="$3" items="center">
            {state.mintUrl && (
              <ListTable width="100%">
                <ListTableRow label="Mint" value={mint?.nickname || mint?.name || state.mintUrl} />
                {state.eventTime && (
                  <ListTableRow label="Time" value={formatPaymentDateTime(state.eventTime)} />
                )}
                {state.status === 'confirmed' && state.fees != null && state.fees > 0 && (
                  <ListTableRow label="Fee" value={`${state.fees} sat`} />
                )}
              </ListTable>
            )}

            {primaryAction && (
              <XStack width="100%" gap="$3">
                <AppButton
                  variant="branded"
                  emphasis="primary"
                  size="large"
                  flex={1}
                  disabled={state.locked}
                  onPress={primaryAction.run}
                >
                  {primaryAction.label}
                </AppButton>
              </XStack>
            )}
            {(showHistory || showRefresh || showCheckNfc) && (
              <XStack width="100%" items="center" justify="center" gap="$3" flexWrap="wrap">
                {showRefresh && (
                  <AppButton
                    variant="default"
                    emphasis="secondary"
                    size="xsmall"
                    disabled={state.locked}
                    onPress={nfcFlow.refresh}
                  >
                    Refresh status
                  </AppButton>
                )}
                {showCheckNfc && (
                  <AppButton
                    variant="default"
                    emphasis="secondary"
                    size="xsmall"
                    disabled={state.locked}
                    onPress={nfcFlow.retry}
                  >
                    Check NFC
                  </AppButton>
                )}
                {showHistory && (
                  <AppButton
                    variant="default"
                    emphasis="secondary"
                    size="xsmall"
                    disabled={state.locked}
                    onPress={viewHistory}
                  >
                    View History
                  </AppButton>
                )}
              </XStack>
            )}
          </YStack>
        </YStack>
      </ScrollView>
    </AppFullScreenModal>
  );
}
