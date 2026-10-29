import React, { useEffect, useLayoutEffect, useRef, useCallback, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView, Text, YStack } from 'tamagui';
import AppBottomSheet, { type AppBottomSheetRef } from '~/shared/ui/AppBottomSheet';
import { ReceiptSheetContext } from '~/shared/ui/ReceiptSheetContext';
import { ListTableVariantProvider } from '~/shared/ui/ListTable';
import { useAuthStore } from '~/state/authStore';
import { useSettingsStore } from '~/state/settingsStore';
import { Spinner } from '~/shared/ui/Spinner';
import { AppTextButton } from '~/shared/ui/AppTextButton';

/** One route keeps the current wallet operation mounted across settlement. */
export function TransactionReceiptSheet({
  children,
  expanded = false,
  busy = false,
  active = false,
  ready = true,
}: {
  children: React.ReactNode;
  expanded?: boolean;
  busy?: boolean;
  active?: boolean;
  ready?: boolean;
}) {
  const sheet = useRef<AppBottomSheetRef>(null);
  const [resolvedOnce, setResolvedOnce] = useState(ready);
  useEffect(() => {
    if (ready) setResolvedOnce(true);
  }, [ready]);
  const resolving = !ready && !resolvedOnce;
  const [openedActive, setOpenedActive] = useState(active && ready);
  useEffect(() => {
    if (active && ready) setOpenedActive(true);
  }, [active, ready]);
  // A live payment stays full screen after completion; reopening it can use a sheet.
  const fullScreen = (ready && active) || openedActive;
  const screenMode = useRef(fullScreen);
  useLayoutEffect(() => {
    screenMode.current = fullScreen;
  }, [fullScreen]);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const authenticated = useAuthStore((state) => state.isAuthenticated);
  const biometricEnabled = useSettingsStore((state) => state.biometricEnabled);
  const wallet = useSettingsStore((state) => state.npub);
  const openingWallet = useRef(wallet);
  const walletChanged = !!openingWallet.current && wallet !== openingWallet.current;
  const concealed = !!(biometricEnabled && !authenticated) || walletChanged;
  const presented = useRef(false);
  const leaving = useRef(false);
  const leave = useCallback(() => {
    if (leaving.current) return;
    leaving.current = true;
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  }, [router]);
  useEffect(() => {
    if (concealed && !busy) {
      if (presented.current) sheet.current?.dismiss();
      else leave();
    } else if (!resolving && !fullScreen && !concealed && !presented.current) {
      sheet.current?.present();
      presented.current = true;
    }
  }, [resolving, fullScreen, concealed, busy, leave]);
  const close = useCallback(() => {
    if (busy) return;
    if (resolving || screenMode.current) leave();
    else sheet.current?.dismiss();
  }, [busy, resolving, leave]);
  const onSheetClose = useCallback(() => {
    // Removing the sheet while promoting a receipt must not pop the active screen.
    if (!screenMode.current) leave();
  }, [leave]);
  const hidden = (
    <YStack p="$4">
      <Text color="$gray10">Unlock Bey to view this receipt.</Text>
    </YStack>
  );
  const scrollPadding = { paddingHorizontal: 16, paddingBottom: Math.max(insets.bottom, 16) };
  const content = resolving ? (
    <YStack
      testID="transaction-loading-overlay"
      flex={1}
      bg="$overlayLight"
      items="center"
      justify="center"
    >
      <YStack p="$3" bg="$background" rounded="$6">
        <Spinner
          size={32}
          color="$color"
          accessibilityLabel="Loading transaction"
          accessibilityRole="progressbar"
          accessible
        />
        <AppTextButton
          onPress={close}
          disabled={busy}
          accessibilityLabel="Cancel loading transaction"
        >
          Cancel
        </AppTextButton>
      </YStack>
    </YStack>
  ) : fullScreen ? (
    <YStack testID="transaction-full-screen" flex={1} bg="$background" pt={insets.top}>
      {concealed ? (
        hidden
      ) : expanded ? (
        children
      ) : (
        <ScrollView flex={1} contentContainerStyle={scrollPadding}>
          {children}
        </ScrollView>
      )}
    </YStack>
  ) : (
    <AppBottomSheet
      ref={sheet}
      maxDynamicContentSize={height - Math.max(insets.top, 24)}
      scrollable
      canDismiss={!busy}
      onClose={onSheetClose}
      backgroundColor="$background"
    >
      {concealed ? (
        hidden
      ) : (
        <BottomSheetScrollView contentContainerStyle={scrollPadding}>
          {children}
        </BottomSheetScrollView>
      )}
    </AppBottomSheet>
  );
  return (
    <ReceiptSheetContext.Provider
      value={{
        close,
        busy,
        presentation: fullScreen ? 'screen' : 'sheet',
        headerInset: fullScreen && expanded ? 16 : 0,
      }}
    >
      <ListTableVariantProvider value="outlined">{content}</ListTableVariantProvider>
    </ReceiptSheetContext.Provider>
  );
}
