import { PaymentStatusIcon } from '~/shared/ui/PaymentStatusIcon';
import { PaymentAmount } from '~/shared/ui/PaymentAmount';
import { formatPaymentDateTime } from '~/shared/utils/time';
import { ListTable, ListTableRow } from '~/shared/ui/ListTable';
import { AppButton } from '~/shared/ui/AppButton';
import AppBottomSheet, { type AppBottomSheetRef } from '~/shared/ui/AppBottomSheet';
import { HeaderIconButton } from '~/shared/ui/HeaderIconButton';
import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import { AppState, Platform, useWindowDimensions } from 'react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { FullWindowOverlay } from 'react-native-screens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, View, XStack, YStack, useTheme } from 'tamagui';
import { AlertTriangle, Settings2, Ban, Check, X } from '@tamagui/lucide-icons';
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
import { useResultHaptic } from '~/shared/hooks/useResultHaptic';

const stateIcons = {
  starting: Spinner,
  ready: NfcIcon,
  reading: Spinner,
  sending: Spinner,
  receiving: Spinner,
  paying: Spinner,
  pending: Spinner,
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
  useResultHaptic(
    state.visible
      ? state.status === 'confirmed'
        ? 'success'
        : state.status === 'error'
          ? 'error'
          : undefined
      : undefined,
    state.status === 'confirmed' ? state.eventTime : undefined,
  );
  const sheetRef = useRef<AppBottomSheetRef>(null);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
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
  const showHistory =
    ['pending', 'unconfirmed', 'error'].includes(state.status) && state.hasPayment;
  const showNewPayment = showHistory;
  const showRefresh = retryDelivery && state.hasPayment;
  const showCheckNfc = state.status === 'disabled';
  return (
    <AppBottomSheet
      ref={sheetRef}
      backgroundColor="$background"
      scrollable
      containerComponent={Platform.OS === 'ios' ? NfcWindowOverlay : undefined}
      canDismiss={!state.visible || !state.locked}
      onClose={close}
    >
      <BottomSheetScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: Math.max(insets.bottom, 16),
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <YStack gap="$4" minHeight={Math.min(300, Math.round(height * 0.65))}>
          <XStack py="$2" items="center" gap="$3">
            <HeaderIconButton
              accessibilityLabel="Close NFC"
              icon={X}
              disabled={state.locked}
              onPress={close}
            />
            <Text
              accessibilityRole="header"
              flex={1}
              textAlign="center"
              fontFamily="$heading"
              fontSize="$6"
              fontWeight="500"
              color="$color"
              accessibilityLiveRegion="polite"
            >
              {titles[state.status]}
            </Text>
            <View width={40} />
          </XStack>
          <YStack gap="$3" items="center">
            <YStack
              testID="nfc-sheet-status"
              width="100%"
              minHeight={200}
              py="$4"
              gap="$3"
              items="center"
              justify="center"
            >
              {state.status === 'confirmed' || state.status === 'error' ? (
                <PaymentStatusIcon status={state.status === 'confirmed' ? 'success' : 'error'} />
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
              )}
              {state.amount !== undefined && (
                <PaymentAmount amount={state.amount} compact size="prominent" />
              )}
              {state.message !== state.error && (
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
              {state.error && (
                <YStack width="100%" bg="$gray3" rounded="$6" p="$3">
                  <Text
                    accessibilityRole="alert"
                    accessibilityLiveRegion="assertive"
                    fontFamily="$body"
                    {...appTypography.body2}
                    color="$red10"
                  >
                    {state.error}
                  </Text>
                </YStack>
              )}
              {state.mintUrl && (
                <ListTable width="100%">
                  <ListTableRow
                    label="Mint"
                    value={mint?.nickname || mint?.name || state.mintUrl}
                  />
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
                    variant="default"
                    emphasis="primary"
                    size="large"
                    flex={1}
                    disabled={state.locked || state.checkingStatus}
                    loading={primaryAction.label === 'Refresh status' && state.checkingStatus}
                    loadingText="Checking status…"
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
              {showNewPayment && (
                <YStack width="100%" gap="$2">
                  <AppButton
                    emphasis="secondary"
                    size="large"
                    fullWidth
                    disabled={state.locked}
                    onPress={nfcFlow.newPayment}
                  >
                    Try new payment
                  </AppButton>
                  <Text {...appTypography.body2} color="$gray10" textAlign="center">
                    The previous payment may still complete. Check History before paying it again.
                  </Text>
                </YStack>
              )}
            </YStack>
          </YStack>
        </YStack>
      </BottomSheetScrollView>
    </AppBottomSheet>
  );
}
