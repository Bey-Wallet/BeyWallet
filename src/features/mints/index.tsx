import { MintAppearance, MintText as Text } from './components/MintUI';
import { MintTrustSheet } from './components/MintTrustSheet';

import { BUIActionMenu } from '~/shared/ui/BUI/BUIActionMenu';
import { interactionCopy } from '~/services/feedback/interactionCopy';
import { copyWithFeedback } from '~/shared/utils/copyWithFeedback';
import { AppButton } from '~/shared/ui/AppButton';
import React, { useEffect, useState, useMemo } from 'react';
import { YStack } from 'tamagui';
import { Spinner } from '~/shared/ui/Spinner';
import { Share2, Plus } from '@tamagui/lucide-icons';
import { useRouter, Stack } from 'expo-router';

import * as Haptics from 'expo-haptics';
import { useAppToast } from '~/shared/hooks/useAppToast';
import { useMintInfo } from '~/shared/hooks/useMintInfo';
import { useWalletStore } from '~/state/walletStore';
import { useSettingsStore } from '~/state/settingsStore';
import type { AppBottomSheetRef } from '~/shared/ui/AppBottomSheet';

import { usePreventRemove } from '@react-navigation/native';
import { Share as RNShare } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MintDetailsView } from './components/MintDetailsView';
import { MintUrlQrOverlay } from './components/MintUrlQrOverlay';
import { mintHealthUrl } from '~/services/api/mintHealthService';
import { mintUrlKey } from '~/shared/utils/mintUrl';
import { connectMint } from './connectMint';
interface MintProfileScreenProps {
  url: string;
}
export function MintProfileScreen(props: MintProfileScreenProps) {
  return (
    <MintAppearance>
      <MintProfileContent {...props} />
    </MintAppearance>
  );
}

function MintProfileContent({ url }: MintProfileScreenProps) {
  const insets = useSafeAreaInsets();
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
          size="large"
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
          headerRight: () => (
            <BUIActionMenu
              label="Mint actions"
              headerTrigger
              items={[
                { id: 'share', title: 'Share mint', icon: <Share2 size={20} color="$color" /> },
              ]}
              onAction={() => void handleShare()}
            />
          ),
        }}
      />

      <MintDetailsView
        url={url}
        name={name}
        icon={iconToUse}
        info={info}
        connection={isCheckingConnection ? 'checking' : fetchError ? 'offline' : 'online'}
        connectionCheckedAt={Math.max(connectionCheckedAt, connectionErrorAt)}
        onRecheck={() => {
          void recheckConnection({ cancelRefetch: false });
        }}
        onCopyUrl={() => {
          void handleCopy(url, 'URL');
        }}
        onQr={() => setShowQr(true)}
      />

      <YStack p="$4" pb={insets.bottom || '$4'} bg="$background" gap="$3">
        {hideDisclaimer && connectionError && (
          <Text color="$red10" accessibilityRole="alert">
            {connectionError}
          </Text>
        )}
        <AppButton
          variant="default"
          emphasis="primary"
          size="large"
          icon={<Plus size={18} />}
          disabled={isConnecting}
          loading={isConnecting}
          loadingText="Connecting to mint…"
          onPress={handleAction}
        >
          {'Connect'}
        </AppButton>
      </YStack>

      <MintTrustSheet
        ref={connectionSheetRef}
        mint={{ url, name, icon: iconToUse }}
        busy={isConnecting}
        error={connectionError}
        remember={dontShowAgain}
        onRememberChange={setDontShowAgain}
        onConfirm={() => handleConfirmConnection(dontShowAgain)}
      />
      <MintUrlQrOverlay url={url} visible={showQr} onClose={() => setShowQr(false)} />
    </YStack>
  );
}
