import { PaymentStatusIcon } from '~/shared/ui/PaymentStatusIcon';
import { PaymentAmount } from '~/shared/ui/PaymentAmount';
import { formatPaymentDateTime } from '~/shared/utils/time';
import { ListTable, ListTableRow } from '~/shared/ui/ListTable';
import { AppButton } from '~/shared/ui/AppButton';
import AppBottomSheet, { type AppBottomSheetRef } from '~/shared/ui/AppBottomSheet';

import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';

import { FullWindowOverlay } from 'react-native-screens';

import { Text, View, XStack, YStack, useTheme } from 'tamagui';
import { AlertTriangle, Settings2, Ban, Check, Nfc, type AppIconProps } from '~/shared/icons';
import { useQueryClient } from '@tanstack/react-query';
import { appTypography } from '~/shared/theme/appearance';
import { useAuthStore } from '~/state/authStore';
import { useSettingsStore } from '~/state/settingsStore';
import { useWalletStore } from '~/state/walletStore';
import { nfcService } from '~/services/platform/nfcService';
import { nfcFlow } from './nfcFlow';
import { nfcReceiveCoordinator } from '~/services/wallet/nfcReceiveCoordinator';

const stateIcons = {
  starting: Nfc,
  ready: (props: AppIconProps) => <Nfc {...props} weight="fill" />,
  reading: Nfc,
  sending: Nfc,
  receiving: Nfc,
  paying: Nfc,
  pausing: Nfc,
  pending: Nfc,
  unconfirmed: AlertTriangle,
  confirmed: Check,
  error: AlertTriangle,
  disabled: Settings2,
  unsupported: Ban,
};

export function useNfcPresentation() {
  return useSyncExternalStore(nfcFlow.subscribe, nfcFlow.getSnapshot, nfcFlow.getSnapshot);
}

function NfcWindowOverlay({ children }: React.PropsWithChildren) {
  return <FullWindowOverlay>{children}</FullWindowOverlay>;
}

export function NfcSheetHost({ walletReady }: { walletReady: boolean }) {
  const state = useNfcPresentation();
  const sheetRef = useRef<AppBottomSheetRef>(null);
  const theme = useTheme();
  const authenticated = useAuthStore((store) => store.isAuthenticated);
  const biometric = useSettingsStore((store) => store.biometricEnabled);
  const settingsReady = useSettingsStore((store) => store.initialized);
  const mints = useWalletStore((store) => store.mints);
  const queryClient = useQueryClient();
  useEffect(() => {
    if (state.visible) sheetRef.current?.present();
    else sheetRef.current?.dismiss();
  }, [state.visible]);
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
      nfcFlow.background('host_unmount');
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
    pausing: 'Payment paused',
    pending: 'Awaiting recipient',
    unconfirmed: 'Receipt unconfirmed',
    confirmed:
      state.direction === 'send' ? 'Sent' : state.direction === 'pay' ? 'Paid' : 'Received',
    error: 'NFC could not complete',
    disabled: 'Enable NFC to continue',
    unsupported: 'NFC is unavailable on this device',
  };
  const processing = ['starting', 'reading', 'sending', 'receiving', 'paying', 'pausing'].includes(
    state.status,
  );
  const showDone =
    processing ||
    ['confirmed', 'pending', 'unconfirmed'].includes(state.status) ||
    (state.status === 'error' && state.hasPayment);
  const knownFee = state.fees != null && Number.isSafeInteger(state.fees) && state.fees >= 0;
  const retryDelivery = ['error', 'unconfirmed'].includes(state.status) && state.canRetryDelivery;
  const close = () => {
    if (!nfcFlow.getSnapshot().locked) nfcFlow.dismiss();
  };
  const primaryAction = state.canRetryLightning
    ? { label: 'Retry payment', run: nfcFlow.retry }
    : state.status === 'confirmed'
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
  const showHistory =
    ['pending', 'unconfirmed', 'error'].includes(state.status) && state.hasPayment;
  const showNewPayment = showHistory || !!state.canRetryLightning;
  const showRefresh = retryDelivery && state.hasPayment;
  const showCheckNfc = state.status === 'disabled';
  return (
    <AppBottomSheet
      ref={sheetRef}
      backgroundColor="$background"
      title={processing ? titles[state.status] : 'NFC'}
      titleSize={appTypography.title3.fontSize}
      titleLiveRegion="polite"
      navigationLabel="Close NFC"
      onNavigate={close}
      containerComponent={Platform.OS === 'ios' ? NfcWindowOverlay : undefined}
      canDismiss={!state.visible || !state.locked}
      onClose={() => {
        if (!nfcFlow.getSnapshot().visible) nfcFlow.sheetClosed();
        else close();
      }}
    >
      <YStack gap="$4">
        <YStack gap="$3" items="center">
          <YStack
            testID="nfc-sheet-status"
            width="100%"
            minHeight={processing ? 120 : 200}
            py="$4"
            gap="$3"
            items="center"
            justify="center"
          >
            {!processing &&
              (['confirmed', 'error', 'pending', 'unconfirmed'].includes(state.status) ? (
                <PaymentStatusIcon
                  status={
                    state.status === 'confirmed'
                      ? 'success'
                      : state.status === 'error'
                        ? 'error'
                        : 'pending'
                  }
                />
              ) : (
                <View
                  backgroundColor={badgeColor}
                  borderRadius={100}
                  width={72}
                  height={72}
                  alignItems="center"
                  justifyContent="center"
                >
                  <StateIcon size={40} color={iconColor} />
                </View>
              ))}
            {!processing && (
              <Text
                fontFamily="$heading"
                {...appTypography.title3}
                color="$color"
                textAlign="center"
                accessibilityLiveRegion="polite"
              >
                {titles[state.status]}
              </Text>
            )}
            {state.amount !== undefined && (
              <PaymentAmount amount={state.amount} compact size="prominent" />
            )}
            {state.message !== state.error &&
              !['confirmed', 'pending', 'unconfirmed', 'error'].includes(state.status) && (
                <Text
                  fontFamily="$body"
                  {...appTypography.body2}
                  color="$gray10"
                  textAlign="center"
                  maxWidth={360}
                  accessibilityLiveRegion="polite"
                >
                  {state.message}
                </Text>
              )}
          </YStack>
          <YStack width="100%" gap="$3" items="center">
            {!processing && primaryAction && primaryAction.label !== 'Done' && (
              <AppButton
                variant="default"
                emphasis={showDone ? 'secondary' : 'primary'}
                size={showDone ? 'small' : 'large'}
                fullWidth={!showDone}
                disabled={state.locked || state.checkingStatus}
                loading={primaryAction.label === 'Refresh status' && state.checkingStatus}
                loadingText="Checking status…"
                onPress={primaryAction.run}
              >
                {primaryAction.label}
              </AppButton>
            )}
            {(state.mintUrl || state.error || state.hasPayment) && (
              <ListTable compact width="100%">
                {!processing && <ListTableRow label="Status" value={titles[state.status]} />}
                {!!state.mintUrl && (
                  <ListTableRow
                    label="Mint"
                    value={mint?.nickname || mint?.name || state.mintUrl}
                  />
                )}
                <ListTableRow label="Method" value="NFC" />
                {state.eventTime && (
                  <ListTableRow label="Time" value={formatPaymentDateTime(state.eventTime)} />
                )}
                {knownFee && (
                  <ListTableRow
                    label={state.direction === 'pay' ? 'Maximum fee' : 'Creation fee'}
                    value={`${state.fees} sat`}
                  />
                )}
                {state.status === 'confirmed' && state.direction !== 'send' && (
                  <ListTableRow label="Fee paid" value="Unavailable" />
                )}
                {!!state.error && (
                  <ListTableRow
                    label="Details"
                    multiline
                    value={
                      <Text
                        accessibilityRole="alert"
                        accessibilityLiveRegion="assertive"
                        fontFamily="$body"
                        {...appTypography.body2}
                        color="$red10"
                      >
                        {state.error}
                      </Text>
                    }
                  />
                )}
              </ListTable>
            )}
            {showNewPayment && (
              <YStack width="100%" gap="$2">
                <AppButton
                  variant="default"
                  emphasis="secondary"
                  size="small"
                  fullWidth={false}
                  self="center"
                  disabled={state.locked}
                  onPress={nfcFlow.newPayment}
                >
                  Start new payment
                </AppButton>
                {state.hasPayment && (
                  <Text {...appTypography.body3} color="$gray10" textAlign="center">
                    The previous payment may still complete. Check status before paying it again.
                  </Text>
                )}
              </YStack>
            )}
            {(showRefresh || showCheckNfc) && (
              <XStack width="100%" items="center" justify="center" gap="$3" flexWrap="wrap">
                {showRefresh && (
                  <AppButton
                    variant="default"
                    emphasis="secondary"
                    size="xsmall"
                    disabled={state.locked || state.checkingStatus}
                    loading={state.checkingStatus}
                    loadingText="Checking status…"
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
                    disabled={state.locked || state.checkingStatus}
                    onPress={nfcFlow.retry}
                  >
                    Check NFC
                  </AppButton>
                )}
              </XStack>
            )}
            {showDone && (
              <AppButton
                variant="default"
                emphasis="primary"
                size="large"
                fullWidth
                disabled={state.locked || processing}
                loading={processing}
                loadingText={titles[state.status]}
                onPress={close}
              >
                Done
              </AppButton>
            )}
          </YStack>
        </YStack>
      </YStack>
    </AppBottomSheet>
  );
}
