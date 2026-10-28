import { interactionCopy } from '~/services/feedback/interactionCopy';
import { copyWithFeedback } from '~/shared/utils/copyWithFeedback';
import { MintImage } from '~/shared/ui/RemoteImage';
import { AppButton } from '~/shared/ui/AppButton';
import { AppIconButton } from '~/shared/ui/AppIconButton';
import React, { useEffect, useState, useMemo } from 'react';
import { YStack, XStack, Text, H2, H4, ScrollView, View } from 'tamagui';
import { Spinner } from '~/shared/ui/Spinner';
import { Globe, Sprout, Share2, Plus, QrCode } from '@tamagui/lucide-icons';
import { useRouter, Stack } from 'expo-router';

import * as Haptics from 'expo-haptics';
import { useAppToast } from '~/shared/hooks/useAppToast';
import { useMintInfo } from '~/shared/hooks/useMintInfo';
import { useWalletStore } from '~/state/walletStore';
import AppBottomSheet, { AppBottomSheetRef } from '~/shared/ui/AppBottomSheet';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { usePreventRemove } from '@react-navigation/native';
import { ListTable, ListTableRow } from '~/shared/ui/ListTable';
import { Share as RNShare } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MintPreviewHealth, MintReliabilityRow } from './components/MintPreviewHealth';
import { MintPreviewMethods, mintPreviewMethods } from './components/MintPreviewMethods';
import { MintUrlQrOverlay } from './components/MintUrlQrOverlay';
import { MintNutsRow } from './components/MintNutsRow';
import { MintTermsRow } from './components/MintTermsRow';
import { MintContacts } from './components/MintContacts';
import { mintHealthUrl } from '~/services/api/mintHealthService';
import { mintUrlKey } from '~/shared/utils/mintUrl';
interface MintProfileScreenProps {
  url: string;
}
export function MintProfileScreen({ url }: MintProfileScreenProps) {
  const insets = useSafeAreaInsets();
  const [showQr, setShowQr] = useState(false);
  const router = useRouter();
  const toast = useAppToast();
  const { addMint, mints } = useWalletStore();
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setConnectionError(null);
    connectionSheetRef.current?.present();
  };
  const handleConfirmConnection = async () => {
    if (connectionLock.current) return;
    connectionLock.current = true;
    setIsConnecting(true);
    setConnectionError(null);
    try {
      useWalletStore.setState({ error: null });
      // Keep the SDK's mint and keyset validation behind explicit consent.
      await addMint(url, { trusted: true });
      const state = useWalletStore.getState();
      if (state.error) throw new Error(state.error);
      if (
        !state.mints.some(
          (mint) => normalizeUrl(mint.mintUrl) === normalizeUrl(url) && mint.trusted,
        )
      ) {
        throw new Error('Could not connect to this mint. Please try again.');
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
        <AppButton variant="default" emphasis="tertiary" size="medium" onPress={safeGoBack}>
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
  const description = info.description || info.description_long;
  const motd = info.motd;
  const version = info.version;
  const nuts = info.nuts || {};
  const previewTableProps = {
    compact: true,
  };
  const previewUnits = [
    ...new Set([
      ...(Array.isArray(info.units)
        ? info.units.filter((unit: unknown) => typeof unit === 'string')
        : []),
      ...mintPreviewMethods(info).flatMap((method) => (method.unit ? [method.unit] : [])),
    ]),
  ];
  // Safely extract icon from store or the fetched v1/info metadata
  const iconToUse = walletMint?.icon || info.icon_url || info.picture || info.icon;
  const hostname = (() => {
    try {
      return new URL(url).hostname;
    } catch (e) {
      return url;
    }
  })();
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
            <MintReliabilityRow
              key={`score-${url}`}
              url={url}
              connection={isCheckingConnection ? 'checking' : fetchError ? 'offline' : 'online'}
              onRecheck={() => {
                void recheckConnection({ cancelRefetch: false });
              }}
            />
          </YStack>

          {/* Description */}
          {description && (
            <YStack gap="$3">
              <Text color="$gray10" fontSize="$4" fontWeight="600">
                About
              </Text>
              <YStack gap="$2">
                <Text lineHeight={22}>{description}</Text>
              </YStack>
            </YStack>
          )}
          {/* MOTD */}
          {motd && (
            <YStack gap="$3" theme="orange">
              <Text color="$gray10" fontSize="$4" fontWeight="600">
                Message from the mint
              </Text>
              <ListTable {...previewTableProps}>
                <YStack px="$page" py="$rowGap" gap="$2">
                  <Text lineHeight={22}>{motd}</Text>
                </YStack>
              </ListTable>
            </YStack>
          )}

          {/* General Metadata lists */}
          <YStack gap="$3">
            <H4 color="$gray10" fontSize="$4">
              Mint Details
            </H4>
            <ListTable {...previewTableProps}>
              <ListTableRow label="URL" value={hostname} isCopyable copyValue={url} />
              {version && <ListTableRow label="Version" value={version} />}
              <MintNutsRow key={url} nuts={nuts} />
              <ListTableRow label="Units" value={previewUnits.join(', ') || 'Not provided'} />
              {info.pubkey && <ListTableRow label="Public key" value={info.pubkey} isCopyable />}
              <MintTermsRow url={info.tos_url} />
            </ListTable>
          </YStack>

          <MintPreviewMethods info={info} />

          {/* Connection and independent monitoring */}
          <MintPreviewHealth
            key={url}
            url={url}
            connection={isCheckingConnection ? 'checking' : fetchError ? 'offline' : 'online'}
            connectionCheckedAt={Math.max(connectionCheckedAt, connectionErrorAt)}
            onRecheck={() => {
              void recheckConnection();
            }}
          />

          <MintContacts contacts={info.contact} />
        </YStack>
      </ScrollView>

      <YStack
        p="$4"
        pb={insets.bottom || '$4'}
        bg="$background"
        borderTopWidth={1}
        borderTopColor="$gray4"
      >
        <AppButton
          variant="default"
          emphasis="primary"
          size="medium"
          icon={<Plus size={18} />}
          disabled={isConnecting}
          onPress={handleAction}
        >
          {'Connect'}
        </AppButton>
      </YStack>

      <AppBottomSheet ref={connectionSheetRef} snapPoints={['65%']} canDismiss={!isConnecting}>
        <BottomSheetScrollView
          contentContainerStyle={{ padding: 24, paddingBottom: Math.max(insets.bottom, 24) }}
        >
          <YStack gap="$5">
            <Text fontSize="$6" fontWeight="600" textAlign="center">
              Connect to mint
            </Text>
            <YStack items="center" gap="$2">
              <View width={64} height={64} rounded="$6" overflow="hidden" bg="$gray3">
                <MintImage mintUrl={url} source={{ uri: iconToUse, width: 64, height: 64 }} />
              </View>
              <Text fontSize="$5" fontWeight="600" textAlign="center">
                {name}
              </Text>
              <Text color="$gray10" textAlign="center" selectable>
                {url}
              </Text>
            </YStack>
            <View p="$3" bg="$gray5" theme="orange" rounded="$6">
              <Text color="$color" fontSize="$4">
                This mint holds the bitcoin backing your ecash. You depend on its operator to redeem
                it. Bey Wallet does not operate this mint and is not responsible for losses caused
                by it. Only connect if you trust the operator.
              </Text>
            </View>
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
              onPress={handleConfirmConnection}
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
