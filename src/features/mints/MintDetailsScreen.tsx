import { BUILabel } from '~/shared/ui/BUI/BUIBadge';
import {
  MintAppearance,
  MintCard,
  MintRows,
  MintSection,
  MintDetailRow,
  MintText as Text,
} from './components/MintUI';
import { BUIActionButton } from '~/shared/ui/BUI/BUIButton';
import { BUIHeader } from '~/shared/ui/BUI/BUIHeader';
import { buiTypography } from '~/shared/ui/BUI/typography';
import { AppInput as Input } from '~/shared/ui/AppInput';
import { interactionCopy } from '~/services/feedback/interactionCopy';
import { HeaderIconButton } from '~/shared/ui/HeaderIconButton';
import { appSpacing } from '~/shared/theme/appearance';
import { MintImage } from '~/shared/ui/RemoteImage';
import { AppButton } from '~/shared/ui/AppButton';
import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { YStack, XStack, ScrollView, View } from 'tamagui';
import {
  ArrowLeft,
  Share2,
  QrCode,
  Pencil,
  Check,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowRightLeft,
  AlertTriangle,
  Trash2,
  RefreshCw,
} from '@tamagui/lucide-icons';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';

import AppBottomSheet, { AppBottomSheetRef } from '~/shared/ui/AppBottomSheet';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { Share as RNShare, Keyboard, useWindowDimensions } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWalletStore } from '~/state/walletStore';
import { useSettingsStore } from '~/state/settingsStore';
import { currencyService, CurrencyCode } from '~/services/wallet/currencyService';
import { bitcoinService } from '~/services/api/bitcoinService';
import { useAppToast } from '~/shared/hooks/useAppToast';
import { SafeFlex } from '~/shared/ui/Flex';
import { useMintInfo } from '~/shared/hooks/useMintInfo';
import { MintOverview } from './components/MintOverview';
import { MintUrlQrOverlay } from './components/MintUrlQrOverlay';

const mintText = (value: unknown) => (typeof value === 'string' ? value : undefined);

export default function MintDetailsModal() {
  return (
    <MintAppearance>
      <MintDetailsContent />
    </MintAppearance>
  );
}

function MintDetailsContent() {
  const router = useRouter();
  const toast = useAppToast();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const sheetPadding = appSpacing.page + appSpacing.compact;
  const { mintUrl, editName } = useLocalSearchParams<{ mintUrl: string; editName?: string }>();
  const {
    mints,
    balances,
    setActiveMint,
    activeMintUrl,
    setMintNickname,
    removeMint,
    isRestoring,
    restoringMintUrl,
  } = useWalletStore();
  const { primaryCurrency, secondaryCurrency, showBitcoinSymbol } = useSettingsStore();
  const [isEditingName, setIsEditingName] = useState(false);
  const [isSavingName, setIsSavingName] = useState(false);
  const nameDraft = useRef('');
  const nameSaveLock = useRef(false);
  const autoEditHandled = useRef(false);
  const [showQr, setShowQr] = useState(false);
  const removeMintSheetRef = useRef<AppBottomSheetRef>(null);
  const isRemovingRef = useRef(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const safeGoBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  }, [router]);

  const handleRemoveMint = async () => {
    if (isRemovingRef.current) return;
    isRemovingRef.current = true;
    setIsRemoving(true);
    try {
      await removeMint(mintUrl || '');
      removeMintSheetRef.current?.dismiss();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      safeGoBack();
      toast.showFeedback(interactionCopy.mintRemoved);
    } catch (e: any) {
      isRemovingRef.current = false;
      console.error('Failed to remove mint:', e);
      toast.showFeedback(interactionCopy.couldNotRemoveThisMintCheckIts);
    } finally {
      setIsRemoving(false);
    }
  };

  const handleRestoreProofs = () => {
    if (!mintUrl) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({ pathname: '/(tabs)/settings/recover-funds', params: { mintUrl } });
  };

  const { data: btcData } = useQuery({
    queryKey: ['bitcoinPrice', secondaryCurrency],
    queryFn: () => bitcoinService.fetchPrice(secondaryCurrency),
    staleTime: 30000,
    enabled: secondaryCurrency !== 'NONE',
  });

  const {
    data: info,
    isFetching: isCheckingConnection,
    error: connectionError,
    dataUpdatedAt: connectionCheckedAt,
    errorUpdatedAt: connectionErrorAt,
    refetch: recheckConnection,
  } = useMintInfo(mintUrl || '', { refetchOnMount: 'always' });

  const normalizedTargetUrl = useMemo(() => mintUrl?.replace(/\/$/, '') || '', [mintUrl]);

  const walletMint = useMemo(() => {
    return mints.find((m) => m.mintUrl.replace(/\/$/, '') === normalizedTargetUrl);
  }, [mints, normalizedTargetUrl]);

  const balance = useMemo(() => {
    if (!mintUrl) return 0;
    return balances[mintUrl] || 0;
  }, [balances, mintUrl]);

  const fiatBalance = useMemo(() => {
    if (secondaryCurrency === 'NONE') return 0;

    if (!btcData?.price) return 0;
    return currencyService.convertSatsToCurrency(balance, btcData.price);
  }, [balance, btcData?.price, secondaryCurrency]);

  const name =
    walletMint?.nickname ||
    walletMint?.name ||
    mintText(info?.name) ||
    (() => {
      try {
        return new URL(mintUrl || '').hostname;
      } catch (e) {
        return mintUrl || '';
      }
    })();

  useEffect(() => {
    if (editName === 'true' && walletMint && !autoEditHandled.current) {
      autoEditHandled.current = true;
      nameDraft.current = name;
      setIsEditingName(true);
    }
  }, [editName, walletMint, name]);

  const iconToUse =
    walletMint?.icon || mintText(info?.icon_url) || mintText(info?.picture) || mintText(info?.icon);
  const isTrusted = walletMint?.trusted ?? false;
  const isActive = activeMintUrl?.replace(/\/$/, '') === normalizedTargetUrl;

  const hostname = (() => {
    try {
      return new URL(mintUrl || '').hostname;
    } catch (e) {
      return mintUrl || '';
    }
  })();

  const handleSaveName = useCallback(async () => {
    if (!mintUrl || nameSaveLock.current) return;
    nameSaveLock.current = true;
    setIsSavingName(true);
    const nickname = nameDraft.current.trim();
    try {
      useWalletStore.setState({ error: null });
      await setMintNickname(mintUrl, nickname);
      const state = useWalletStore.getState();
      if (state.error) throw new Error(state.error);
      const saved = state.mints.find(
        (mint) => mint.mintUrl.replace(/\/$/, '') === normalizedTargetUrl,
      );
      if (!saved || (saved.nickname || '') !== nickname)
        throw new Error('Could not save mint name. Please try again.');
      setIsEditingName(false);
      Keyboard.dismiss();
      toast.showFeedback(interactionCopy.mintNameUpdated);
    } catch (error) {
      toast.showFeedback(interactionCopy.couldNotSaveMintNamePleaseTry);
    } finally {
      nameSaveLock.current = false;
      setIsSavingName(false);
    }
  }, [mintUrl, normalizedTargetUrl, setMintNickname, toast]);

  // Native input owns the draft while typing so the navigation header stays mounted.
  const renderHeaderTitle = useCallback(
    () => (
      <YStack items="center" justify="center" maxWidth={220}>
        {isEditingName ? (
          <Input
            accessibilityLabel="Mint name"
            defaultValue={nameDraft.current}
            onChangeText={(value) => {
              nameDraft.current = value;
            }}
            onSubmitEditing={handleSaveName}
            autoFocus={!isSavingName}
            editable={!isSavingName}
            selectTextOnFocus
            returnKeyType="done"
            autoCapitalize="sentences"
            {...buiTypography.h3}
            color="$color"
            textAlign="center"
            width={200}
            height={36}
            py={0}
            px="$2"
            bg="$gray2"
            borderWidth={0}
          />
        ) : (
          <Text kind="h3" color="$color" numberOfLines={1}>
            {name}
          </Text>
        )}
        <Text kind="body3" color="$gray10" numberOfLines={1} style={{ maxWidth: 200 }}>
          {hostname}
        </Text>
      </YStack>
    ),
    [isEditingName, isSavingName, handleSaveName, name, hostname],
  );

  if (!mintUrl || !walletMint) {
    return (
      <YStack flex={1} justify="center" items="center" p="$4" bg="$background">
        <Text color="$color" kind="h3">
          Mint not found
        </Text>
        <AppButton variant="default" emphasis="primary" size="large" mt="$4" onPress={safeGoBack}>
          Go Back
        </AppButton>
      </YStack>
    );
  }

  const connection = isCheckingConnection ? 'checking' : connectionError ? 'offline' : 'online';

  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await RNShare.share({ message: mintUrl });
    } catch (error) {
      toast.showFeedback(interactionCopy.shareFailed);
    }
  };

  const handleDeposit = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActiveMint(mintUrl);
    router.push('/(modals)/mint');
  };

  const handleWithdraw = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActiveMint(mintUrl);
    router.push('/(modals)/melt');
  };

  const handleTransfer = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActiveMint(mintUrl);
    router.push('/(modals)/swap');
  };

  return (
    <YStack flex={1} bg="$background">
      <Stack.Screen
        options={{
          headerTitle: renderHeaderTitle,
          headerLeft: () => (
            <HeaderIconButton
              accessibilityLabel="Go back"
              icon={<ArrowLeft color="$color" />}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                safeGoBack();
              }}
            />
          ),
          headerRight: () => (
            <HeaderIconButton
              accessibilityLabel={isEditingName ? 'Save mint name' : 'Edit mint name'}
              icon={isEditingName ? <Check color="$color" /> : <Pencil color="$color" />}
              disabled={isSavingName}
              onPress={
                isEditingName
                  ? handleSaveName
                  : () => {
                      nameDraft.current = name;
                      setIsEditingName(true);
                    }
              }
            />
          ),
        }}
      />
      <SafeFlex fill>
        <ScrollView
          flex={1}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        >
          <YStack px={16} pt={16} gap={16}>
            <MintCard>
              <YStack gap={16}>
                <XStack justify="space-between" items="center" gap={16}>
                  <YStack gap={8} flex={1} minWidth={0}>
                    <XStack items="baseline" gap="$1">
                      {primaryCurrency === 'SATS' || secondaryCurrency === 'NONE' ? (
                        <Text kind="num2" color="$color">
                          {showBitcoinSymbol ? '₿' : ''}
                          {balance.toLocaleString()}
                          {!showBitcoinSymbol && <Text kind="label2">{' sat'}</Text>}
                        </Text>
                      ) : (
                        <Text kind="num2" color="$color">
                          {currencyService.formatValue(
                            fiatBalance,
                            secondaryCurrency as CurrencyCode,
                          )}
                        </Text>
                      )}
                    </XStack>
                    {secondaryCurrency !== 'NONE' && (
                      <Text kind="label2" color="$gray10">
                        {primaryCurrency === 'SATS' || secondaryCurrency === 'NONE'
                          ? currencyService.formatValue(
                              fiatBalance,
                              secondaryCurrency as CurrencyCode,
                            )
                          : showBitcoinSymbol
                            ? `₿\u202f${balance.toLocaleString()}`
                            : `${balance.toLocaleString()} sat`}
                      </Text>
                    )}

                    <XStack mt={8} gap={8} items="center" flexWrap="wrap">
                      <BUILabel tone={isTrusted ? 'success' : 'error'}>
                        {isTrusted ? 'Trusted by you' : 'Untrusted'}
                      </BUILabel>
                      {isActive && <BUILabel tone="primary">Active</BUILabel>}
                    </XStack>
                  </YStack>

                  <YStack items="center" gap="$2">
                    <MintImage
                      mintUrl={mintUrl}
                      source={{ uri: iconToUse }}
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: 16,
                      }}
                    />
                  </YStack>
                </XStack>

                <XStack gap="$2" items="center">
                  <AppButton
                    variant="default"
                    emphasis="secondary"
                    size="small"
                    flex={1}
                    fullWidth={false}
                    icon={Share2}
                    accessibilityLabel="Share mint"
                    onPress={handleShare}
                  >
                    Share
                  </AppButton>
                  <AppButton
                    variant="default"
                    emphasis="secondary"
                    size="small"
                    flex={1}
                    fullWidth={false}
                    icon={QrCode}
                    accessibilityLabel="Show mint QR code"
                    onPress={() => setShowQr(true)}
                  >
                    Show QR
                  </AppButton>
                </XStack>
                <XStack gap={8}>
                  <BUIActionButton flex={1} plain title="Deposit" onPress={handleDeposit}>
                    <ArrowDownToLine size={22} color="$color" />
                  </BUIActionButton>
                  <BUIActionButton flex={1} plain title="Withdraw" onPress={handleWithdraw}>
                    <ArrowUpFromLine size={22} color="$color" />
                  </BUIActionButton>
                  <BUIActionButton flex={1} plain title="Transfer" onPress={handleTransfer}>
                    <ArrowRightLeft size={22} color="$color" />
                  </BUIActionButton>
                </XStack>
              </YStack>
            </MintCard>

            <MintOverview
              url={mintUrl}
              info={info || {}}
              connection={connection}
              connectionCheckedAt={Math.max(connectionCheckedAt, connectionErrorAt)}
              onRecheck={() => {
                void recheckConnection({ cancelRefetch: false });
              }}
            />
            <MintSection title="Manage mint">
              <MintRows>
                <MintDetailRow
                  label="Restore funds"
                  icon={RefreshCw}
                  value={isRestoring && restoringMintUrl === mintUrl ? 'Restoring…' : undefined}
                  disabled={isRestoring}
                  onPress={handleRestoreProofs}
                />
                <MintDetailRow
                  label="Remove mint"
                  icon={Trash2}
                  labelColor="$red11"
                  iconColor="$red11"
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    removeMintSheetRef.current?.present();
                  }}
                />
              </MintRows>
            </MintSection>
          </YStack>
        </ScrollView>

        <AppBottomSheet
          ref={removeMintSheetRef}
          scrollable
          canDismiss={!isRemoving}
          maxDynamicContentSize={windowHeight - insets.top - appSpacing.page}
        >
          <BottomSheetScrollView
            contentContainerStyle={{
              paddingTop: appSpacing.page,
              paddingLeft: insets.left + sheetPadding,
              paddingRight: insets.right + sheetPadding,
              paddingBottom: insets.bottom + sheetPadding,
            }}
          >
            <YStack gap={16}>
              <BUIHeader
                title="Remove mint"
                navigation="close"
                navigationLabel="Close remove mint sheet"
                navigationDisabled={isRemoving}
                onNavigate={() => removeMintSheetRef.current?.dismiss()}
                horizontalInset={0}
              />
              <XStack items="center" gap="$3">
                <View
                  width={48}
                  height={48}
                  rounded="$6"
                  overflow="hidden"
                  bg="$gray3"
                  flexShrink={0}
                >
                  <MintImage mintUrl={mintUrl} source={{ uri: iconToUse, width: 48, height: 48 }} />
                </View>
                <YStack flex={1} minWidth={0} gap="$1">
                  <Text kind="label2" color="$color">
                    {name}
                  </Text>
                  <Text kind="body3" color="$gray10" selectable>
                    {mintUrl}
                  </Text>
                </YStack>
              </XStack>
              <Text color="$gray10" kind="body2">
                This removes the mint from your connected mints. Your transaction history is kept.
              </Text>

              {balance > 0 && (
                <MintCard>
                  <View accessibilityRole="alert">
                    <XStack gap="$3">
                      <AlertTriangle color="$orange10" size={24} />
                      <YStack flex={1}>
                        <Text color="$orange10" kind="label2">
                          This mint still has funds
                        </Text>
                        <Text color="$orange10" kind="body2" mt="$1">
                          You currently have a balance of{' '}
                          <Text kind="label2">
                            {showBitcoinSymbol
                              ? `₿\u202f${balance.toLocaleString()}`
                              : `${balance.toLocaleString()} sat`}
                          </Text>{' '}
                          in this mint. Transfer or withdraw this balance before removing it.
                          Removing the mint does not move your funds, and recovery is not
                          guaranteed.
                        </Text>
                      </YStack>
                    </XStack>
                  </View>
                </MintCard>
              )}

              <YStack gap="$3" mt="$2">
                <AppButton
                  variant="critical"
                  emphasis="primary"
                  size="large"
                  onPress={handleRemoveMint}
                  loading={isRemoving}
                  loadingText="Removing mint…"
                >
                  Confirm Remove
                </AppButton>
                <AppButton
                  variant="default"
                  emphasis="secondary"
                  size="large"
                  disabled={isRemoving}
                  onPress={() => removeMintSheetRef.current?.dismiss()}
                >
                  Cancel
                </AppButton>
              </YStack>
            </YStack>
          </BottomSheetScrollView>
        </AppBottomSheet>
        <MintUrlQrOverlay url={mintUrl} visible={showQr} onClose={() => setShowQr(false)} />
      </SafeFlex>
    </YStack>
  );
}
