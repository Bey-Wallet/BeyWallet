import React, { useCallback, useSyncExternalStore } from 'react';
import { useFocusEffect } from 'expo-router';
import { Text, XStack } from 'tamagui';
import { nfcFlow } from '~/features/nfc/nfcFlow';
import { nfcService } from '~/services/platform/nfcService';
import NfcIcon from '~/shared/icons/NfcIcon';
import { AppPressable } from '~/shared/ui/AppPressable';

export function useRequestNfc(request: string | null) {
  useFocusEffect(
    useCallback(() => {
      if (request) return nfcFlow.presentRequest(request);
    }, [request]),
  );
}

export function RequestNfcBadge() {
  const { requestStatus, requestPauseReason } = useSyncExternalStore(
    nfcFlow.subscribe,
    nfcFlow.getSnapshot,
    nfcFlow.getSnapshot,
  );
  const label =
    requestStatus === 'ready'
      ? 'Tap to pay'
      : requestStatus === 'starting'
        ? 'Starting NFC…'
        : requestStatus === 'disabled'
          ? 'Enable NFC to tap to pay'
          : requestStatus === 'unsupported'
            ? 'NFC unavailable'
            : requestStatus === 'error'
              ? 'Retry NFC'
              : requestPauseReason === 'payment'
                ? 'Review NFC payment'
                : requestPauseReason === 'locked'
                  ? 'Unlock wallet for NFC'
                  : requestPauseReason === 'session'
                    ? 'Finishing NFC session…'
                    : 'NFC paused';
  const canReview = requestStatus === 'paused' && requestPauseReason === 'payment';
  return (
    <AppPressable
      accessibilityLabel={label}
      accessibilityRole={
        requestStatus === 'disabled' || requestStatus === 'error' || canReview ? 'button' : 'text'
      }
      disabled={requestStatus !== 'disabled' && requestStatus !== 'error' && !canReview}
      onPress={() => {
        if (requestStatus === 'disabled') void nfcService.goToNfcSetting();
        else if (requestStatus === 'error') nfcFlow.resumeRequest();
        else if (canReview) nfcFlow.openReader();
      }}
    >
      <XStack items="center" gap="$2" bg="$gray3" rounded="$10" px="$3" py="$2">
        <NfcIcon size={18} color="$gray11" />
        <Text fontSize={14} color="$gray11">
          {label}
        </Text>
      </XStack>
    </AppPressable>
  );
}
