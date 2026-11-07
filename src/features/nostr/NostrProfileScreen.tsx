import { interactionCopy } from '~/services/feedback/interactionCopy';
import { copyWithFeedback } from '~/shared/utils/copyWithFeedback';
import React from 'react';
import { InteractionManager, Share, ScrollView, useWindowDimensions } from 'react-native';
import { Text, View, XStack, YStack } from 'tamagui';
import {
  Check,
  Copy,
  RefreshCw,
  Share2,
  Settings2,
  Zap,
  Plus,
  Landmark,
  Clock,
} from '@tamagui/lucide-icons';
import { Stack, useFocusEffect, useRouter, useLocalSearchParams, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import * as Haptics from 'expo-haptics';
import { useReducedMotion } from '~/shared/hooks/useReducedMotion';
import { useAppToast } from '~/shared/hooks/useAppToast';
import { useSettingsStore } from '~/state/settingsStore';
import { useNip05Lookup } from '~/shared/hooks/useNip05Lookup';
import Nip05VerifiedBadge from '~/shared/icons/Nip05VerifiedBadge';
import Blockies from '~/shared/ui/Blockies';
import { AppButton } from '~/shared/ui/AppButton';
import { AppIconButton } from '~/shared/ui/AppIconButton';
import { AppPressable } from '~/shared/ui/AppPressable';
import { CustomQRCode } from '~/shared/ui/CustomQRCode';
import { Spinner } from '~/shared/ui/Spinner';
import { BUIHeader } from '~/shared/ui/BUI/BUIHeader';
import { PaymentStageLayout } from '~/shared/ui/PaymentStageLayout';
import { PaymentActionsMenu } from '~/shared/ui/PaymentActionsMenu';
import { ListTable, ListTableRow } from '~/shared/ui/ListTable';
import { appColors, appSpacing, appTypography } from '~/shared/theme/appearance';
import { useLightningAddressStore } from '~/state/lightningAddressStore';
import { lightningAddress, lightningAddressQr } from '~/services/api/npubCashClient';

export default function NostrProfileScreen({ settingsMode = false }: { settingsMode?: boolean }) {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = React.useState<'ecash' | 'lightning'>(
    params.tab === 'lightning' ? 'lightning' : 'ecash',
  );
  const lightning = useLightningAddressStore();
  const pager = React.useRef<ScrollView>(null);
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const pageWidth = width - (insets.left ?? 0) - (insets.right ?? 0);
  React.useEffect(() => {
    const next = params.tab === 'lightning' ? 'lightning' : 'ecash';
    setTab(next);
    pager.current?.scrollTo({ x: next === 'lightning' ? pageWidth : 0, animated: false });
  }, [params.tab]);
  React.useEffect(() => {
    pager.current?.scrollTo({ x: tab === 'lightning' ? pageWidth : 0, animated: false });
  }, [pageWidth]);
  const selectTab = (next: 'ecash' | 'lightning') => {
    setTab(next);
    pager.current?.scrollTo({ x: next === 'lightning' ? pageWidth : 0, animated: !reducedMotion });
  };
  const contentWidth = Math.min(
    440,
    width - 2 * appSpacing.page - (insets.left ?? 0) - (insets.right ?? 0),
  );
  const qrSize = Math.max(
    120,
    Math.min(height < 700 ? 240 : 280, contentWidth - 2 * appSpacing.gap),
  );
  const toast = useAppToast();
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

  const openUsername = () =>
    router.push(settingsMode ? '/(tabs)/settings/username' : '/(modals)/nostr-username');
  const manageLightning = () => router.push('/(tabs)/settings/lightning-address' as Href);
  const shareLabel = isLightning ? 'Share Lightning address' : 'Share ecash address';

  let receivingMintName = lightning.receivingMint;
  try {
    receivingMintName = new URL(lightning.receivingMint).hostname;
  } catch {}

  const renderAddressPage = (page: 'ecash' | 'lightning') => {
    const isLightning = page === 'lightning';
    const copyValue = isLightning ? address : npub;
    const canShare = !!npub && (!isLightning || (lightning.loaded && lightning.enabled));
    const waitingForLightning = isLightning && (!lightning.loaded || !npub);
    const needsLightningSetup = isLightning && lightning.loaded && !!npub && !lightning.enabled;
    return (
      <PaymentStageLayout
        variant="qr"
        hero={
          <YStack width="100%" maxWidth={440} gap={appSpacing.page} items="center">
            {!isLightning && !verified && (
              <YStack gap={appSpacing.compact} items="center" width="100%">
                {!isLightning &&
                  !verified &&
                  (loading ? (
                    <Spinner size="small" />
                  ) : status === 'not_found' ? (
                    <AppButton
                      emphasis="secondary"
                      size="small"
                      fullWidth={false}
                      onPress={openUsername}
                    >
                      Claim username
                    </AppButton>
                  ) : (
                    status === 'error' && (
                      <XStack gap={appSpacing.compact} items="center">
                        <Text {...appTypography.body3} color="$gray10">
                          Could not check your username
                        </Text>
                        <AppIconButton
                          variant="default"
                          emphasis="ghost"
                          size="small"
                          shape="circular"
                          accessibilityLabel="Retry NIP-05 lookup"
                          icon={RefreshCw}
                          onPress={refresh}
                        />
                      </XStack>
                    )
                  ))}
              </YStack>
            )}
            {waitingForLightning || needsLightningSetup ? (
              <YStack
                minHeight={qrSize}
                width="100%"
                items="center"
                justify="center"
                gap={appSpacing.page}
              >
                {waitingForLightning ? (
                  <>
                    <Spinner size="large" color="$color" />
                    <Text
                      {...appTypography.body2}
                      color="$gray10"
                      textAlign="center"
                      accessibilityLiveRegion="polite"
                    >
                      Loading Lightning address…
                    </Text>
                  </>
                ) : (
                  <>
                    <YStack
                      width={56}
                      height={56}
                      rounded="$6"
                      bg="$gray3"
                      items="center"
                      justify="center"
                    >
                      <Zap size={24} color="$iconSecondary" aria-hidden />
                    </YStack>
                    <Text {...appTypography.body2} color="$gray10" textAlign="center">
                      Set up a receiving mint to enable your Lightning address.
                    </Text>
                    <AppButton
                      emphasis="secondary"
                      size="small"
                      fullWidth={false}
                      onPress={manageLightning}
                    >
                      Enable Lightning address
                    </AppButton>
                  </>
                )}
              </YStack>
            ) : (
              <>
                <View
                  bg={appColors.light.canvas}
                  borderWidth={1}
                  borderColor="$borderColor"
                  p={appSpacing.gap}
                  rounded="$6"
                  items="center"
                  justify="center"
                >
                  <View width={qrSize} height={qrSize} items="center" justify="center">
                    {npub && isQrReady ? (
                      <CustomQRCode
                        value={isLightning ? lightningAddressQr(npub) : npub}
                        size={qrSize}
                        color={appColors.light.text}
                        backgroundColor={appColors.light.canvas}
                        dotShape="circle"
                        finderStyle="rounded"
                      />
                    ) : (
                      <YStack items="center" gap={appSpacing.gap}>
                        <Spinner size="large" color={appColors.light.text} />
                        <Text {...appTypography.body3} color={appColors.light.secondaryText}>
                          {npub ? 'Loading QR code…' : 'Loading public key…'}
                        </Text>
                      </YStack>
                    )}
                  </View>
                </View>
                <Text {...appTypography.body3} color="$gray10" textAlign="center">
                  {isLightning ? 'Scan with a Lightning wallet' : 'Scan with an ecash wallet'}
                </Text>
              </>
            )}
          </YStack>
        }
        footer={
          <YStack testID="my-addresses-actions" pb={insets.bottom} items="center">
            {npub && (
              <AppButton
                emphasis="secondary"
                size="small"
                fullWidth={false}
                icon={Plus}
                onPress={() =>
                  router.push(isLightning ? '/(modals)/mint' : '/(modals)/receive?mode=request')
                }
              >
                {isLightning ? 'Create Lightning invoice' : 'Create payment request'}
              </AppButton>
            )}
          </YStack>
        }
      >
        <YStack width="100%" maxWidth={440} self="center" gap={appSpacing.gap}>
          {!isLightning && verified && npub && (
            <YStack bg="$gray2" rounded="$6" p={appSpacing.gap} pt={appSpacing.small}>
              <XStack items="center" justify="space-between" gap={appSpacing.gap}>
                <Text {...appTypography.body3} color="$gray10" flex={1}>
                  Address
                </Text>
                <AppIconButton
                  emphasis="text"
                  size="small"
                  iconSize={appTypography.body3.fontSize}
                  icon={copied === nip05 ? Check : Copy}
                  accessibilityLabel="Copy Nostr address"
                  onPress={() => copy(nip05!)}
                />
              </XStack>
              <XStack items="center" gap={appSpacing.compact}>
                <Blockies seed={npub} size={8} scale={3} style={{ borderRadius: 4 }} />
                <Text {...appTypography.body2} color="$color" selectable flexShrink={1}>
                  {nip05}
                </Text>
                <Nip05VerifiedBadge size={14} />
              </XStack>
            </YStack>
          )}
          {copyValue && canShare && (
            <YStack
              testID="address-copy-card"
              bg="$gray2"
              rounded="$6"
              p={appSpacing.gap}
              pt={appSpacing.small}
            >
              <XStack items="center" justify="space-between" gap={appSpacing.gap}>
                <Text {...appTypography.body3} color="$gray10" flex={1}>
                  {isLightning ? 'Lightning address' : 'Nostr public key'}
                </Text>
                <AppIconButton
                  emphasis="text"
                  size="small"
                  iconSize={appTypography.body3.fontSize}
                  icon={copied === copyValue ? Check : Copy}
                  accessibilityLabel={isLightning ? 'Copy Lightning address' : 'Copy public key'}
                  onPress={() => copy(copyValue)}
                />
              </XStack>
              <Text
                testID="full-receiving-address"
                fontFamily="$body"
                {...appTypography.body2}
                color="$color"
                selectable
              >
                {copyValue}
              </Text>
            </YStack>
          )}
          {isLightning && lightning.loaded && (canShare || lightning.pending.length > 0) && (
            <ListTable>
              {canShare && (
                <>
                  <ListTableRow label="Receiving mint" value={receivingMintName} icon={Landmark} />
                  <ListTableRow label="Connection" value={lightning.connection} />
                </>
              )}
              {lightning.pending.length > 0 && (
                <ListTableRow
                  label={'Pending incoming payments (' + lightning.pending.length + ')'}
                  icon={Clock}
                  onPress={() => router.push('/(tabs)/settings/lightning-address-payments' as Href)}
                />
              )}
            </ListTable>
          )}
        </YStack>
      </PaymentStageLayout>
    );
  };

  return (
    <YStack flex={1} bg="$background" pl={insets.left ?? 0} pr={insets.right ?? 0}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerShadowVisible: false,
          title: 'My addresses',
          header: ({ navigation }) => (
            <BUIHeader
              title="My addresses"
              titleContent={
                <XStack
                  accessibilityRole="tablist"
                  gap={appSpacing.compact}
                  items="center"
                  justify="center"
                >
                  {(['ecash', 'lightning'] as const).map((value) => (
                    <AppPressable
                      key={value}
                      minHeight={48}
                      px={appSpacing.compact}
                      items="center"
                      justify="center"
                      borderBottomWidth={2}
                      borderColor={tab === value ? '$color' : 'transparent'}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: tab === value }}
                      accessibilityLabel={value === 'ecash' ? 'Ecash' : 'Lightning'}
                      onPress={() => selectTab(value)}
                    >
                      <Text
                        {...appTypography.body2}
                        fontWeight={tab === value ? '600' : '400'}
                        color={tab === value ? '$color' : '$gray10'}
                      >
                        {value === 'ecash' ? 'Ecash' : 'Lightning'}
                      </Text>
                    </AppPressable>
                  ))}
                </XStack>
              }
              topInset={insets.top ?? 0}
              navigation={settingsMode ? 'back' : 'close'}
              onNavigate={() => {
                if (settingsMode) {
                  if (navigation.getState().index > 0) navigation.goBack();
                  else router.replace('/(tabs)/settings');
                } else if (router.canGoBack()) router.back();
                else router.replace('/(tabs)');
              }}
              actions={
                <PaymentActionsMenu
                  label="Address actions"
                  actions={[
                    {
                      id: 'share',
                      title: shareLabel,
                      icon: <Share2 size={20} color="$color" />,
                      disabled: !canShare,
                      onPress: share,
                    },
                    {
                      id: 'manage',
                      title: isLightning ? 'Manage Lightning address' : 'Manage username',
                      icon: <Settings2 size={20} color="$color" />,
                      disabled: !npub,
                      onPress: isLightning ? manageLightning : openUsername,
                    },
                  ]}
                />
              }
            />
          ),
        }}
      />
      <ScrollView
        ref={pager}
        testID="address-pager"
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyboardDismissMode="on-drag"
        onMomentumScrollEnd={(event) =>
          setTab(event.nativeEvent.contentOffset.x >= pageWidth / 2 ? 'lightning' : 'ecash')
        }
        style={{ flex: 1 }}
      >
        {(['ecash', 'lightning'] as const).map((page) => (
          <YStack
            key={page}
            testID={`${page}-address-page`}
            width={pageWidth}
            height="100%"
            flexShrink={0}
            accessibilityElementsHidden={tab !== page}
            importantForAccessibility={tab === page ? 'auto' : 'no-hide-descendants'}
          >
            {renderAddressPage(page)}
          </YStack>
        ))}
      </ScrollView>
    </YStack>
  );
}
