import { HeaderIconButton } from '~/shared/ui/HeaderIconButton';
import React from 'react';
import { InteractionManager, Share, useWindowDimensions } from 'react-native';
import { ScrollView, Text, View, XStack, YStack, useTheme } from 'tamagui';
import { Check, Copy, RefreshCw, Scan, Share2 } from '@tamagui/lucide-icons';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useToastController } from '@tamagui/toast';
import { useSettingsStore } from '~/state/settingsStore';
import { useNip05Lookup } from '~/shared/hooks/useNip05Lookup';
import Nip05VerifiedBadge from '~/shared/icons/Nip05VerifiedBadge';
import { AppButton } from '~/shared/ui/AppButton';
import { AppIconButton } from '~/shared/ui/AppIconButton';
import { AppPressable } from '~/shared/ui/AppPressable';
import { CustomQRCode } from '~/shared/ui/CustomQRCode';
import { Spinner } from '~/shared/ui/Spinner';

export default function NostrProfileScreen({ settingsMode = false }: { settingsMode?: boolean }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const qrSize = Math.max(120, Math.min(height < 700 ? 240 : 280, width - 64));
  const theme = useTheme();
  const toast = useToastController();
  const npub = useSettingsStore((state) => state.npub);
  const { nip05, loading, status, refresh } = useNip05Lookup();
  const verified = status === 'verified' && !!nip05;
  const [isQrReady, setIsQrReady] = React.useState(false);
  const [copied, setCopied] = React.useState<string | null>(null);
  const copyTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasFocused = React.useRef(false);

  React.useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => setIsQrReady(true));
    return () => task.cancel();
  }, []);

  React.useEffect(() => {
    setCopied(null);
    return () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, [npub, nip05]);

  useFocusEffect(
    React.useCallback(() => {
      if (hasFocused.current) refresh();
      else hasFocused.current = true;
    }, [refresh]),
  );

  const copy = async (value: string) => {
    await Clipboard.setStringAsync(value);
    toast.show('Copied to clipboard');
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(value);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(null), 2000);
  };

  const share = async () => {
    if (!npub) return;
    try {
      await Share.share({ message: verified ? `${nip05}\n${npub}` : npub });
    } catch {
      toast.show('Could not share profile. Please try again.');
    }
  };

  return (
    <YStack flex={1} bg="$background">
      {!settingsMode && (
        <Stack.Screen
          options={{
            headerShown: true,
            title: 'My profile',
            headerTitleAlign: 'center',
            headerShadowVisible: false,
            headerRight: () => (
              <HeaderIconButton
                accessibilityLabel="Share profile"
                icon={<Share2 />}
                disabled={!npub}
                onPress={share}
              />
            ),
          }}
        />
      )}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          flexGrow: 1,
          padding: 24,
          paddingBottom: Math.max(insets.bottom, 16) + 16,
          gap: 32,
        }}
      >
        <YStack
          flex={1}
          justify="center"
          width="100%"
          maxWidth={400}
          self="center"
          gap="$4"
          items="center"
        >
          {status === 'not_found' && !loading ? (
            <AppButton
              variant="default"
              emphasis="text-only"
              size="xxsmall"
              minHeight={48}
              onPress={() =>
                router.push(settingsMode ? '/(tabs)/settings/username' : '/(modals)/nostr-username')
              }
            >
              Claim username
            </AppButton>
          ) : (
            <AppPressable
              onPress={() => verified && copy(nip05!)}
              disabled={!verified}
              minHeight={48}
              accessibilityLabel={verified ? 'Copy Nostr address' : 'My Nostr profile'}
              justify="center"
            >
              <XStack items="center" justify="center" gap="$2">
                <Text fontSize={22} fontWeight="600" color="$color" text="center" flexShrink={1}>
                  {verified ? nip05 : 'My Nostr profile'}
                </Text>
                {verified &&
                  (copied === nip05 ? (
                    <Check size={18} color="$color" />
                  ) : (
                    <Nip05VerifiedBadge size={18} />
                  ))}
              </XStack>
            </AppPressable>
          )}

          <View bg="$background" width={qrSize} height={qrSize} items="center" justify="center">
            {npub && isQrReady ? (
              <CustomQRCode
                value={npub}
                size={qrSize}
                color={String(theme.color.val)}
                backgroundColor={String(theme.background.val)}
                dotShape="circle"
                finderStyle="rounded"
              />
            ) : (
              <YStack items="center" gap="$3">
                <Spinner size="large" color="$color" />
                <Text fontSize={12} color="$gray10">
                  {npub ? 'Loading QR code…' : 'Loading public key…'}
                </Text>
              </YStack>
            )}
          </View>
          {npub && (
            <AppPressable
              width="100%"
              rounded="$6"
              borderWidth={1}
              borderColor="$borderColor"
              px="$4"
              py="$5"
              mt="$3"
              minHeight={48}
              onPress={() => copy(npub)}
              accessibilityLabel="Copy public key"
            >
              <XStack
                position="absolute"
                top={-12}
                self="center"
                items="center"
                gap="$2"
                px="$2"
                bg="$background"
              >
                <Text fontSize={14} color="$gray10">
                  Public key
                </Text>
                {copied === npub ? (
                  <Check size={16} color="$color" />
                ) : (
                  <Copy size={16} color="$gray10" />
                )}
              </XStack>
              <Text fontSize={14} fontWeight="500" lineHeight={24} color="$color" text="center">
                {npub}
              </Text>
            </AppPressable>
          )}
          <Text fontSize={14} color="$gray10" text="center" maxWidth={300} lineHeight={20}>
            Scan or share this public key to connect with me on Nostr.
          </Text>

          {!verified && status !== 'not_found' && (
            <XStack width="100%" items="center" gap="$3">
              <Text flex={1} fontSize={12} color="$gray10">
                {status === 'error'
                  ? 'Could not check your Nostr address. Your QR code still works.'
                  : 'Checking your Nostr address…'}
              </Text>
              {loading ? (
                <Spinner size="small" />
              ) : status === 'error' ? (
                <AppIconButton
                  variant="default"
                  emphasis="tertiary"
                  size="small"
                  shape="circular"
                  accessibilityLabel="Retry NIP-05 lookup"
                  icon={<RefreshCw size={20} />}
                  onPress={refresh}
                />
              ) : null}
            </XStack>
          )}
        </YStack>
        <XStack self="center" items="center" gap="$2">
          <AppButton
            variant="default"
            emphasis="secondary"
            rounded="$10"
            px="$5"
            icon={<Scan />}
            onPress={() => router.push('/(modals)/scanner')}
          >
            Scan a QR code
          </AppButton>
          {settingsMode && (
            <AppIconButton
              variant="default"
              emphasis="tertiary"
              size="small"
              shape="circular"
              iconSize={18}
              icon={<Share2 />}
              accessibilityLabel="Share profile"
              disabled={!npub}
              onPress={share}
            />
          )}
        </XStack>
      </ScrollView>
    </YStack>
  );
}
