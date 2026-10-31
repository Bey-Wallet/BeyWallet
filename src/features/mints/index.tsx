import { interactionCopy } from '~/services/feedback/interactionCopy';
import { copyWithFeedback } from '~/shared/utils/copyWithFeedback';
import { MintImage } from '~/shared/ui/RemoteImage';
import { AppButton } from '~/shared/ui/AppButton';
import { AppIconButton } from '~/shared/ui/AppIconButton';
import { AppPressable } from '~/shared/ui/AppPressable';
import { HeaderIconButton } from '~/shared/ui/HeaderIconButton';
import React, { useEffect, useState, useMemo } from 'react';
import { YStack, XStack, Text, H2, ScrollView, View } from 'tamagui';
import { Spinner } from '~/shared/ui/Spinner';
import { Globe, Sprout, Share2, Plus, QrCode, Check, X } from '@tamagui/lucide-icons';
import { useRouter, Stack } from 'expo-router';

import * as Haptics from 'expo-haptics';
import { useAppToast } from '~/shared/hooks/useAppToast';
import { useMintInfo } from '~/shared/hooks/useMintInfo';
import { useWalletStore } from '~/state/walletStore';
import { useSettingsStore } from '~/state/settingsStore';
import AppBottomSheet, { AppBottomSheetRef } from '~/shared/ui/AppBottomSheet';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { usePreventRemove } from '@react-navigation/native';
import { Share as RNShare, useWindowDimensions } from 'react-native';
import { appSpacing } from '~/shared/theme/appearance';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MintOverview } from './components/MintOverview';
import { MintUrlQrOverlay } from './components/MintUrlQrOverlay';
import { mintHealthUrl } from '~/services/api/mintHealthService';
import { mintUrlKey } from '~/shared/utils/mintUrl';
import { connectMint } from './connectMint';
interface MintProfileScreenProps {
  url: string;
}
export function MintProfileScreen({ url }: MintProfileScreenProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const sheetPadding = appSpacing.page + appSpacing.compact;
  const [showQr, setShowQr] = useState(false);
  const router = useRouter();
  const toast = useAppToast();
  const { mints } = useWalletStore();
  const hideDisclaimer = useSettingsStore((state) => state.hideMintConnectionDisclaimer);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const connectionSheetRef = React.useRef<AppBottomSheetRef>(null);
  const connectionLock = React.useRef(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  usePreventRemove(isConnecting, () => {});
  const normalizeUrl = mintUrlKey;
  const walletMint = mints.find((m) => normalizeUrl(m.mintUrl) === normalizeUrl(url));
  const isAlreadyAdded = !!walletMint;
  useEffect(() => {
    if (isAlreadyAdded && !isConnecting && !connectionError) {
      connectionSheetRef.current?.dismiss();
      router.replace({
        pathname: '/(modals)/mint-details',
        params: { mintUrl: walletMint?.mintUrl || url },
      });
    }
  }, [isAlreadyAdded, isConnecting, connectionError, router, url, walletMint?.mintUrl]);
  const validUrl = useMemo(() => {
    try {
      mintHealthUrl(url);
      return true;
    } catch {
      return false;
    }
  }, [url]);
  const handleAction = async () => {
    if (connectionLock.current) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setConnectionError(null);
    if (hideDisclaimer) {
      await handleConfirmConnection(true);
      return;
    }
    setDontShowAgain(false);
    connectionSheetRef.current?.present();
  };
  const handleConfirmConnection = async (rememberChoice: boolean) => {
    if (connectionLock.current) return;
    connectionLock.current = true;
    setIsConnecting(true);
    setConnectionError(null);
    try {
      await connectMint(url);
      if (rememberChoice !== hideDisclaimer) {
        await useSettingsStore.getState().setHideMintConnectionDisclaimer(rememberChoice);
      }
      toast.showFeedback(interactionCopy.mintConnected);
    } catch (error) {
      setConnectionError(
        error instanceof Error ? error.message : 'Could not connect to this mint.',
      );
    } finally {
      connectionLock.current = false;
      setIsConnecting(false);
    }
  };
  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await RNShare.share({ message: url });
    } catch (error) {
      toast.showFeedback(interactionCopy.shareFailed);
    }
  };
  const safeGoBack = React.useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  }, [router]);
  const {
    data: fetchedInfo,
    isLoading,
    error: fetchError,
    isFetching: isCheckingConnection,
    dataUpdatedAt: connectionCheckedAt,
    errorUpdatedAt: connectionErrorAt,
    refetch: recheckConnection,
  } = useMintInfo(url, { enabled: validUrl && !isAlreadyAdded, refetchOnMount: 'always' });
  const info = fetchedInfo || {};
  const handleCopy = async (text: string, label: string) => {
    if (!(await copyWithFeedback(text, toast))) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    toast.showFeedback(interactionCopy.copiedToClipboard);
  };
  if (isLoading || (isAlreadyAdded && !isConnecting && !connectionError)) {
    return (
      <YStack flex={1} items="center" justify="center" bg="$background">
        <Spinner size="large" color="$accentColor" />
        <Text mt="$4" color="$gray10">
          Fetching mint details...
        </Text>
      </YStack>
    );
  }
  if (!validUrl) {
    return (
      <YStack flex={1} items="center" justify="center" bg="$background" p="$4" gap="$4">
        <Text color="$red10">Failed to fetch mint information.</Text>
        <AppButton
          variant="default"
          emphasis="secondary"
          size="medium"
          onPress={() => void recheckConnection()}
        >
          Try again
        </AppButton>
        <AppButton variant="default" emphasis="ghost" size="medium" onPress={safeGoBack}>
          Go Back
        </AppButton>
      </YStack>
    );
  }
  const name =
    walletMint?.nickname ||
    info.name ||
    (() => {
      try {
        return new URL(url).hostname;
      } catch (e) {
        return url;
      }
    })();
  // Safely extract icon from store or the fetched v1/info metadata
  const iconToUse = walletMint?.icon || info.icon_url || info.picture || info.icon;
  return (
    <YStack flex={1} bg="$background">
      <Stack.Screen
        options={{
          title: name,
          gestureEnabled: !isConnecting,
        }}
      />

      <ScrollView flex={1} showsVerticalScrollIndicator={false}>
        <YStack px="$page" pb="$10" gap="$5">
          {/* Header Section */}
          <YStack gap="$3">
            <XStack items="center" gap="$3">
              <View
                width={64}
                height={64}
                flexShrink={0}
                rounded="$6"
                bg="$gray3"
                items="center"
                justify="center"
                overflow="hidden"
                borderWidth={1}
                borderColor="$color5"
              >
                <MintImage
                  mintUrl={url}
                  source={{
                    uri: iconToUse,
                    width: 64,
                    height: 64,
                  }}
                  fallback={<Sprout size={32} color="$accentColor" />}
                />
              </View>
              <YStack flex={1} minWidth={0} gap="$2" items="stretch">
                <XStack items="center" gap="$2">
                  <H2 letterSpacing={-1} text="left" flexShrink={1} fontSize={24} lineHeight={30}>
                    {name}
                  </H2>
                </XStack>
                <XStack
                  bg="transparent"
                  px={0}
                  py={0}
                  rounded={100}
                  items="center"
                  gap="$2"
                  maxWidth="100%"
                  onPress={() => handleCopy(url, 'URL')}
                >
                  <Globe size={14} color="$gray10" />
                  <Text color="$gray10" fontSize="$3" flexShrink={1}>
                    {url}
                  </Text>
                </XStack>
              </YStack>
            </XStack>
            <XStack gap="$2" items="center">
              <AppIconButton
                variant="default"
                emphasis="secondary"
                size="small"
                icon={Share2}
                accessibilityLabel="Share mint"
                onPress={handleShare}
              />
              <AppIconButton
                variant="default"
                emphasis="secondary"
                size="small"
                icon={QrCode}
                accessibilityLabel="Show mint QR code"
                onPress={() => setShowQr(true)}
              />
            </XStack>
          </YStack>
          <MintOverview
            url={url}
            info={info}
            connection={isCheckingConnection ? 'checking' : fetchError ? 'offline' : 'online'}
            connectionCheckedAt={Math.max(connectionCheckedAt, connectionErrorAt)}
            onRecheck={() => {
              void recheckConnection({ cancelRefetch: false });
            }}
          />
        </YStack>
      </ScrollView>

      <YStack
        p="$4"
        pb={insets.bottom || '$4'}
        bg="$background"
        borderTopWidth={1}
        borderTopColor="$gray4"
        gap="$3"
      >
        {hideDisclaimer && connectionError && (
          <Text color="$red10" accessibilityRole="alert">
            {connectionError}
          </Text>
        )}
        <AppButton
          variant="default"
          emphasis="primary"
          size="medium"
          icon={<Plus size={18} />}
          disabled={isConnecting}
          loading={isConnecting}
          loadingText="Connecting to mint…"
          onPress={handleAction}
        >
          {'Connect'}
        </AppButton>
      </YStack>

      <AppBottomSheet
        ref={connectionSheetRef}
        maxDynamicContentSize={windowHeight - insets.top - appSpacing.page}
        canDismiss={!isConnecting}
        scrollable
      >
        <BottomSheetScrollView
          contentContainerStyle={{
            paddingTop: appSpacing.page,
            paddingLeft: insets.left + sheetPadding,
            paddingRight: insets.right + sheetPadding,
            paddingBottom: insets.bottom + sheetPadding,
          }}
        >
          <YStack gap="$5">
            <XStack items="center" gap="$2">
              <HeaderIconButton
                icon={X}
                accessibilityLabel="Close connection sheet"
                disabled={isConnecting}
                onPress={() => connectionSheetRef.current?.dismiss()}
              />
              <Text flex={1} fontSize="$6" fontWeight="600" textAlign="center">
                Connect to mint
              </Text>
              <View width={48} />
            </XStack>
            <XStack items="center" gap="$3">
              <View
                width={48}
                height={48}
                rounded="$6"
                overflow="hidden"
                bg="$gray3"
                flexShrink={0}
              >
                <MintImage mintUrl={url} source={{ uri: iconToUse, width: 48, height: 48 }} />
              </View>
              <YStack flex={1} minWidth={0} gap="$1">
                <Text fontSize={14} fontWeight="600">
                  {name}
                </Text>
                <Text color="$gray10" fontSize={12} selectable>
                  {url}
                </Text>
              </YStack>
            </XStack>
            <YStack p="$4" bg="$buttonDefaultSecondary" rounded="$6" gap="$3">
              <Text color="$color" fontSize={14} fontWeight="600">
                Before you connect
              </Text>
              {[
                'This mint holds the bitcoin backing your ecash.',
                'You rely on its operator to redeem your ecash. Only connect if you trust them.',
                'Bey Wallet does not operate this mint and is not responsible for losses it causes.',
              ].map((point) => (
                <XStack key={point} gap="$2" items="flex-start">
                  <Text color="$gray10" fontSize={14} lineHeight={20} accessible={false}>
                    •
                  </Text>
                  <Text color="$color" fontSize={14} lineHeight={20} flex={1}>
                    {point}
                  </Text>
                </XStack>
              ))}
            </YStack>
            <AppPressable
              minHeight={48}
              flexDirection="row"
              items="center"
              gap="$3"
              accessibilityRole="checkbox"
              accessibilityLabel="Do not show again"
              accessibilityState={{ checked: dontShowAgain, disabled: isConnecting }}
              disabled={isConnecting}
              pressStyle={{ opacity: 0.7 }}
              onPress={() => {
                setDontShowAgain(!dontShowAgain);
              }}
            >
              <View
                width={22}
                height={22}
                rounded="$2"
                borderWidth={2}
                borderColor={dontShowAgain ? '$color' : '$gray8'}
                bg={dontShowAgain ? '$color' : 'transparent'}
                items="center"
                justify="center"
              >
                {dontShowAgain && <Check size={14} color="$onAccent" strokeWidth={3} />}
              </View>
              <Text fontSize={14} color="$gray10">
                Do not show again
              </Text>
            </AppPressable>
            {connectionError && (
              <Text color="$red10" accessibilityRole="alert">
                {connectionError}
              </Text>
            )}
            <AppButton
              variant="default"
              emphasis="primary"
              size="medium"
              loading={isConnecting}
              loadingText="Connecting to mint…"
              disabled={isConnecting}
              onPress={() => handleConfirmConnection(dontShowAgain)}
            >
              Confirm
            </AppButton>
          </YStack>
        </BottomSheetScrollView>
      </AppBottomSheet>
      <MintUrlQrOverlay url={url} visible={showQr} onClose={() => setShowQr(false)} />
    </YStack>
  );
}
