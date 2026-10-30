import { interactionCopy } from '~/services/feedback/interactionCopy';
import { copyWithFeedback } from '~/shared/utils/copyWithFeedback';
import { HeaderIconButton } from '~/shared/ui/HeaderIconButton';
import React from 'react';
import { InteractionManager, Share, useWindowDimensions } from 'react-native';
import { ScrollView, Text, View, XStack, YStack, useTheme } from 'tamagui';
import { Check, Copy, RefreshCw, Share2, ChevronRight } from '@tamagui/lucide-icons';
import { Stack, useFocusEffect, useRouter, useLocalSearchParams, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import * as Haptics from 'expo-haptics';
import { useAppToast } from '~/shared/hooks/useAppToast';
import { useSettingsStore } from '~/state/settingsStore';
import { useNip05Lookup } from '~/shared/hooks/useNip05Lookup';
import Nip05VerifiedBadge from '~/shared/icons/Nip05VerifiedBadge';
import { AppButton } from '~/shared/ui/AppButton';
import { AppIconButton } from '~/shared/ui/AppIconButton';
import { AppPressable } from '~/shared/ui/AppPressable';
import { CustomQRCode } from '~/shared/ui/CustomQRCode';
import { Spinner } from '~/shared/ui/Spinner';
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
  const toast = useAppToast();
  const npub = useSettingsStore((state) => state.npub);
  const isLightning = tab === 'lightning';
  const address = npub ? lightningAddress(npub) : '';
  const copyValue = isLightning ? address : npub;
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
    if (!(await copyWithFeedback(value, toast))) return;
    toast.showFeedback(interactionCopy.copiedToClipboard);
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
      toast.showFeedback(interactionCopy.couldNotShareAddressPleaseTryAgain);
    }
  };

  const tabs = (
    <XStack
      width="100%"
      accessibilityRole="tablist"
      bg="$buttonDefaultSecondary"
      rounded="$6"
      p="$1"
      gap="$1"
    >
      {(['ecash', 'lightning'] as const).map((value) => (
        <AppPressable
          key={value}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === value }}
          accessibilityLabel={value === 'ecash' ? 'Ecash' : 'Lightning'}
          onPress={() => setTab(value)}
          flex={1}
          px="$3"
          minWidth={0}
          minHeight={48}
          rounded="$6"
          items="center"
          justify="center"
          bg={tab === value ? '$background' : 'transparent'}
          hoverStyle={{ bg: '$buttonDefaultSecondaryHover' }}
          pressStyle={{ bg: '$buttonDefaultSecondaryPress' }}
        >
          <Text fontSize={14} fontWeight="500" color={tab === value ? '$color' : '$gray10'}>
            {value === 'ecash' ? 'Ecash' : 'Lightning'}
          </Text>
        </AppPressable>
      ))}
    </XStack>
  );

  let receivingMintName = lightning.receivingMint;
  try {
    receivingMintName = new URL(lightning.receivingMint).hostname;
  } catch {}

  return (
    <YStack flex={1} bg="$background">
      <Stack.Screen
        options={{
          ...(!settingsMode && { headerShown: true, headerShadowVisible: false }),
          title: 'My addresses',
          headerTitle: 'My addresses',
          headerTitleAlign: 'center',
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
          padding: 16,
          paddingBottom: Math.max(insets.bottom, 16) + 16,
        }}
      >
        <YStack width="100%" maxWidth={400} self="center" gap="$4">
          {tabs}
          <YStack width="100%" items="center" gap="$4" py="$2">
            <XStack minHeight={48} items="center" justify="center" gap="$2" maxWidth="100%">
              {isLightning ? (
                <Text fontSize={20} fontWeight="600" color="$color" textAlign="center">
                  Lightning address
                </Text>
              ) : status === 'not_found' && !loading ? (
                <AppButton
                  variant="default"
                  emphasis="text"
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
                <>
                  <AppPressable
                    onPress={() => verified && copy(nip05!)}
                    disabled={!verified}
                    minHeight={48}
                    accessibilityLabel={verified ? 'Copy Nostr address' : 'My ecash address'}
                    flexShrink={1}
                    items="center"
                    justify="center"
                  >
                    <XStack items="center" gap="$2" minWidth={0}>
                      <Text
                        fontSize={20}
                        fontWeight="600"
                        color="$color"
                        textAlign="center"
                        flexShrink={1}
                        numberOfLines={1}
                      >
                        {verified ? nip05 : 'Ecash address'}
                      </Text>
                      {verified &&
                        (copied === nip05 ? (
                          <Check size={18} color="$color" />
                        ) : (
                          <Nip05VerifiedBadge size={18} />
                        ))}
                    </XStack>
                  </AppPressable>
                  {!verified &&
                    (loading ? (
                      <Spinner size="small" />
                    ) : status === 'error' ? (
                      <AppIconButton
                        variant="default"
                        emphasis="ghost"
                        size="small"
                        shape="circular"
                        accessibilityLabel="Retry NIP-05 lookup"
                        icon={<RefreshCw size={20} />}
                        onPress={refresh}
                      />
                    ) : null)}
                </>
              )}
            </XStack>

            {isLightning && !canShare ? (
              <YStack minHeight={qrSize} gap="$3" items="center" justify="center">
                {!lightning.loaded || !npub ? (
                  <>
                    <Spinner size="large" color="$color" />
                    <Text
                      fontSize={12}
                      color="$gray10"
                      textAlign="center"
                      accessibilityLiveRegion="polite"
                    >
                      Loading Lightning address…
                    </Text>
                  </>
                ) : (
                  <>
                    <Text fontSize={12} color="$gray10" textAlign="center">
                      Set up a receiving mint to enable your Lightning address.
                    </Text>
                    <AppButton
                      size="small"
                      onPress={() => router.push('/(tabs)/settings/lightning-address' as Href)}
                    >
                      Enable Lightning address
                    </AppButton>
                  </>
                )}
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

            {copyValue && canShare && (
              <AppPressable
                width="100%"
                rounded="$6"
                bg="$buttonDefaultSecondary"
                px="$3"
                py="$2"
                minHeight={56}
                flexDirection="row"
                items="center"
                gap="$3"
                onPress={() => copy(copyValue)}
                accessibilityLabel={isLightning ? 'Copy Lightning address' : 'Copy public key'}
                accessibilityValue={{ text: copyValue }}
                hoverStyle={{ bg: '$buttonDefaultSecondaryHover' }}
                pressStyle={{ bg: '$buttonDefaultSecondaryPress' }}
              >
                <YStack flex={1} minWidth={0} gap="$1">
                  <Text fontSize={12} color="$gray10">
                    {isLightning ? 'Lightning address' : 'Nostr public key'}
                  </Text>
                  <Text fontSize={14} color="$color" numberOfLines={1} ellipsizeMode="middle">
                    {copyValue}
                  </Text>
                </YStack>
                {copied === copyValue ? (
                  <Check size={20} color="$gray10" aria-hidden />
                ) : (
                  <Copy size={20} color="$gray10" aria-hidden />
                )}
              </AppPressable>
            )}
            {isLightning && lightning.loaded && (canShare || lightning.pending.length > 0) && (
              <YStack bg="$buttonDefaultSecondary" rounded="$6" overflow="hidden">
                {canShare && (
                  <AppPressable
                    accessibilityLabel="Manage Lightning address"
                    minHeight={48}
                    px="$3"
                    py="$2"
                    flexDirection="row"
                    items="center"
                    gap="$3"
                    hoverStyle={{ bg: '$buttonDefaultSecondaryHover' }}
                    pressStyle={{ bg: '$buttonDefaultSecondaryPress' }}
                    onPress={() => router.push('/(tabs)/settings/lightning-address' as Href)}
                  >
                    <YStack flex={1} minWidth={0} gap="$1">
                      <Text fontSize={14} color="$color">
                        Manage Lightning address
                      </Text>
                      <Text fontSize={12} color="$gray10" numberOfLines={1}>
                        {lightning.connection}
                        {receivingMintName ? ' · ' + receivingMintName : ''}
                      </Text>
                    </YStack>
                    <ChevronRight size={18} color="$gray10" aria-hidden />
                  </AppPressable>
                )}
                {lightning.pending.length > 0 && (
                  <>
                    {canShare && <View height={2} width="100%" bg="$background" />}
                    <AppPressable
                      accessibilityLabel={
                        'Pending incoming payments (' + lightning.pending.length + ')'
                      }
                      minHeight={48}
                      px="$3"
                      py="$2"
                      flexDirection="row"
                      items="center"
                      gap="$3"
                      hoverStyle={{ bg: '$buttonDefaultSecondaryHover' }}
                      pressStyle={{ bg: '$buttonDefaultSecondaryPress' }}
                      onPress={() =>
                        router.push('/(tabs)/settings/lightning-address-payments' as Href)
                      }
                    >
                      <Text fontSize={14} color="$color" flex={1}>
                        Pending incoming payments ({lightning.pending.length})
                      </Text>
                      <ChevronRight size={18} color="$gray10" aria-hidden />
                    </AppPressable>
                  </>
                )}
              </YStack>
            )}
            {npub && (
              <AppButton
                size="small"
                emphasis="secondary"

                onPress={() =>
                  router.push(isLightning ? '/(modals)/mint' : '/(modals)/receive?mode=request')
                }
              >
                {isLightning ? 'Create Lightning invoice' : 'Create payment request'}
              </AppButton>
            )}
          </YStack>
        </YStack>
      </ScrollView>
    </YStack>
  );
}
