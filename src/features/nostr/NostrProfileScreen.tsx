import { HeaderIconButton } from '~/shared/ui/HeaderIconButton';
import React from 'react';
import { InteractionManager, Share, useWindowDimensions } from 'react-native';
import { ScrollView, Text, View, XStack, YStack, useTheme } from 'tamagui';
import { Check, Copy, RefreshCw, Share2 } from '@tamagui/lucide-icons';
import { Stack, useFocusEffect, useRouter, useLocalSearchParams, type Href } from 'expo-router';
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
import Blockies from '~/shared/ui/Blockies';
import { useLightningAddressStore } from '~/state/lightningAddressStore';
import { lightningAddress, lightningAddressQr } from '~/services/api/npubCashClient';

export default function NostrProfileScreen({ settingsMode = false }: { settingsMode?: boolean }) {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = React.useState<'ecash' | 'lightning'>(
    params.tab === 'lightning' ? 'lightning' : 'ecash',
  );
  const lightning = useLightningAddressStore();
  React.useEffect(() => {
    setTab(params.tab === 'lightning' ? 'lightning' : 'ecash');
  }, [params.tab]);
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const qrSize = Math.max(120, Math.min(height < 700 ? 240 : 280, width - 64));
  const theme = useTheme();
  const toast = useToastController();
  const npub = useSettingsStore((state) => state.npub);
  const isLightning = tab === 'lightning';
  const address = npub ? lightningAddress(npub) : '';
  const canShare = !!npub && (!isLightning || (lightning.loaded && lightning.enabled));
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
    if (!npub || !canShare) return;
    try {
      await Share.share({ message: isLightning ? address : verified ? `${nip05}\n${npub}` : npub });
    } catch {
      toast.show('Could not share address. Please try again.');
    }
  };

  return (
    <YStack flex={1} bg="$background">
      <Stack.Screen
        options={{
          ...(!settingsMode && {
            headerShown: true,
            title: 'My addresses',
            headerTitleAlign: 'center' as const,
            headerShadowVisible: false,
          }),
          headerRight: () => (
            <HeaderIconButton
              accessibilityLabel={isLightning ? 'Share Lightning address' : 'Share ecash address'}
              icon={<Share2 />}
              disabled={!canShare}
              onPress={share}
            />
          ),
        }}
      />
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
          <XStack width="100%" accessibilityRole="tablist" gap="$2">
            {(['ecash', 'lightning'] as const).map((value) => (
              <AppPressable
                key={value}
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === value }}
                accessibilityLabel={value === 'ecash' ? 'Ecash' : 'Lightning'}
                onPress={() => setTab(value)}
                flex={1}
                minHeight={48}
                rounded="$6"
                items="center"
                justify="center"
                bg={tab === value ? '$buttonDefaultSecondary' : '$background'}
                pressStyle={{ bg: '$buttonDefaultSecondaryPress' }}
              >
                <Text fontSize={14} color={tab === value ? '$color' : '$gray10'}>
                  {value === 'ecash' ? 'Ecash' : 'Lightning'}
                </Text>
              </AppPressable>
            ))}
          </XStack>
          <YStack items="center" gap="$3" maxWidth="100%">
            {npub && (
              <View
                width={56}
                height={56}
                flexShrink={0}
                rounded={28}
                overflow="hidden"
                accessibilityLabel="Your addresses avatar"
              >
                <Blockies seed={npub} size={8} scale={7} />
              </View>
            )}
            {isLightning ? (
              <Text fontSize={14} color="$color" textAlign="center">
                Lightning address
              </Text>
            ) : status === 'not_found' && !loading ? (
              <AppButton
                variant="default"
                emphasis="text-only"
                size="small"
                onPress={() =>
                  router.push(
                    settingsMode ? '/(tabs)/settings/username' : '/(modals)/nostr-username',
                  )
                }
              >
                Claim username
              </AppButton>
            ) : (
              <AppPressable
                onPress={() => verified && copy(nip05!)}
                disabled={!verified}
                minHeight={48}
                accessibilityLabel={verified ? 'Copy Nostr address' : 'My ecash address'}
                flexShrink={1}
                items="center"
                justify="center"
              >
                <XStack items="center" gap="$2">
                  <Text
                    fontSize={20}
                    fontWeight="600"
                    color="$color"
                    textAlign="center"
                    flexShrink={1}
                  >
                    {verified ? nip05!.split('@')[0] : 'My ecash address'}
                  </Text>
                  {verified &&
                    (copied === nip05 ? (
                      <Check size={18} color="$color" />
                    ) : (
                      <Nip05VerifiedBadge size={18} />
                    ))}
                </XStack>
                {verified && (
                  <Text fontSize={14} color="$gray10" textAlign="center">
                    @{nip05!.split('@').slice(1).join('@')}
                  </Text>
                )}
              </AppPressable>
            )}
          </YStack>
          {isLightning && !canShare ? (
            <YStack gap="$3" items="center">
              <Text fontSize={12} color="$gray10" textAlign="center">
                Set up a receiving mint to enable your Lightning address.
              </Text>
              <AppButton
                size="small"
                onPress={() => router.push('/(tabs)/settings/lightning-address' as Href)}
              >
                Enable Lightning address
              </AppButton>
            </YStack>
          ) : (
            <View bg="$background" width={qrSize} height={qrSize} items="center" justify="center">
              {npub && isQrReady ? (
                <CustomQRCode
                  value={isLightning ? lightningAddressQr(npub) : npub}
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
          )}
          {isLightning && canShare && (
            <YStack gap="$3" width="100%" items="center">
              <AppPressable
                width="100%"
                rounded="$6"
                bg="$buttonDefaultSecondary"
                p="$4"
                minHeight={48}
                onPress={() => copy(address)}
                accessibilityLabel="Copy Lightning address"
                pressStyle={{ bg: '$buttonDefaultSecondaryPress' }}
              >
                <Text fontSize={14} color="$color" textAlign="center">
                  {address}
                </Text>
                <XStack justify="center" gap="$2" mt="$2">
                  <Copy size={16} color="$gray10" />
                  <Text fontSize={12} color="$gray10">
                    {copied === address ? 'Address copied' : 'Copy address'}
                  </Text>
                </XStack>
              </AppPressable>
              <Text fontSize={12} color="$gray10" textAlign="center">
                Receiving mint: {lightning.receivingMint}
              </Text>
              <Text fontSize={12} color="$gray10" textAlign="center">
                {lightning.connection}.{' '}
                {lightning.autoCollect
                  ? 'Payments are collected when your wallet is open and unlocked.'
                  : 'Collect incoming payments in Lightning address settings.'}
              </Text>
              {lightning.pending.length > 0 && (
                <AppButton
                  size="small"
                  emphasis="tertiary"
                  onPress={() => router.push('/(tabs)/settings/lightning-address-payments' as Href)}
                >{`Pending incoming payments (${lightning.pending.length})`}</AppButton>
              )}
            </YStack>
          )}
          {!isLightning && npub && (
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
              <Text
                fontSize={14}
                fontWeight="500"
                lineHeight={24}
                color="$color"
                textAlign="center"
              >
                {npub}
              </Text>
            </AppPressable>
          )}
          {!isLightning && (
            <Text fontSize={12} color="$gray10" textAlign="center" maxWidth={280} lineHeight={18}>
              {copied === npub ? 'Public key copied' : 'Receive ecash over Nostr.'}
            </Text>
          )}

          {!isLightning &&
            !verified &&
            (loading || status === 'error') &&
            (loading ? (
              <Spinner size="small" />
            ) : (
              <AppIconButton
                variant="default"
                emphasis="tertiary"
                size="small"
                shape="circular"
                accessibilityLabel="Retry NIP-05 lookup"
                icon={<RefreshCw size={20} />}
                onPress={refresh}
              />
            ))}
        </YStack>
      </ScrollView>
    </YStack>
  );
}
