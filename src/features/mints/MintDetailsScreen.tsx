import { BUILabel } from '~/shared/ui/BUI/BUIBadge';
import { MintAppearance, MintCard, MintText as Text } from './components/MintUI';
import { BUIHeaderAction } from '~/shared/ui/BUI/BUIHeader';
import { BUIActionMenu } from '~/shared/ui/BUI/BUIActionMenu';
import { buiTypography } from '~/shared/ui/BUI/typography';
import { AppInput as Input } from '~/shared/ui/AppInput';
import { interactionCopy } from '~/services/feedback/interactionCopy';
import { HeaderIconButton } from '~/shared/ui/HeaderIconButton';
import { appSpacing } from '~/shared/theme/appearance';
import { MintImage } from '~/shared/ui/RemoteImage';
import { AppButton } from '~/shared/ui/AppButton';
import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { YStack, XStack, View } from 'tamagui';
import { ArrowLeft, Share2, Pencil, Check, AlertTriangle, Trash2 } from '@tamagui/lucide-icons';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';

import AppBottomSheet, { AppBottomSheetRef } from '~/shared/ui/AppBottomSheet';

import { Share as RNShare, Keyboard } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useWalletStore } from '~/state/walletStore';
import { useSettingsStore } from '~/state/settingsStore';
import { currencyService, CurrencyCode } from '~/services/wallet/currencyService';
import { bitcoinService } from '~/services/api/bitcoinService';
import { useAppToast } from '~/shared/hooks/useAppToast';
import { SafeFlex } from '~/shared/ui/Flex';
import { useMintInfo } from '~/shared/hooks/useMintInfo';
import { MintDetailsView } from './components/MintDetailsView';
import { copyWithFeedback } from '~/shared/utils/copyWithFeedback';
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
  const { mintUrl, editName } = useLocalSearchParams<{ mintUrl: string; editName?: string }>();
  const {
    mints,
    balances,
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
    router.push({ pathname: '/recover-funds', params: { mintUrl } });
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
            <XStack items="center" gap={appSpacing.page}>
              <BUIHeaderAction
                label={isEditingName ? 'Save mint name' : 'Edit mint name'}
                disabled={isSavingName}
                onPress={
                  isEditingName
                    ? handleSaveName
                    : () => {
                        nameDraft.current = name;
                        setIsEditingName(true);
                      }
                }
              >
                {isEditingName ? (
                  <Check size={22} color="$color" />
                ) : (
                  <Pencil size={16} color="$color" />
                )}
              </BUIHeaderAction>
              <BUIActionMenu
                label="Mint actions"
                headerTrigger
                items={[
                  { id: 'share', title: 'Share mint', icon: <Share2 size={20} color="$color" /> },
                  {
                    id: 'remove',
                    title: 'Remove mint',
                    destructive: true,
                    icon: <Trash2 size={20} color="$red11" />,
                    disabled: isRemoving,
                  },
                ]}
                onAction={(id) => {
                  if (id === 'share') void handleShare();
                  if (id === 'remove') {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    removeMintSheetRef.current?.present();
                  }
                }}
              />
            </XStack>
          ),
        }}
      />
      <SafeFlex fill>
        <MintDetailsView
          url={mintUrl}
          name={name}
          icon={iconToUse}
          info={info || {}}
          connection={connection}
          connectionCheckedAt={Math.max(connectionCheckedAt, connectionErrorAt)}
          onRecheck={() => {
            void recheckConnection({ cancelRefetch: false });
          }}
          onCopyUrl={() => {
            void copyWithFeedback(mintUrl, toast);
          }}
          balance={{
            amount:
              primaryCurrency === 'SATS' || secondaryCurrency === 'NONE'
                ? `${showBitcoinSymbol ? '₿' : ''}${balance.toLocaleString()}`
                : currencyService.formatValue(fiatBalance, secondaryCurrency as CurrencyCode),
            unit:
              (primaryCurrency === 'SATS' || secondaryCurrency === 'NONE') && !showBitcoinSymbol
                ? 'sat'
                : undefined,
            secondary:
              secondaryCurrency === 'NONE'
                ? undefined
                : primaryCurrency === 'SATS'
                  ? currencyService.formatValue(fiatBalance, secondaryCurrency as CurrencyCode)
                  : showBitcoinSymbol
                    ? `₿${balance.toLocaleString()}`
                    : `${balance.toLocaleString()} sat`,
          }}
          badges={
            <>
              <BUILabel tone={isTrusted ? 'success' : 'error'}>
                {isTrusted ? 'Trusted by you' : 'Untrusted'}
              </BUILabel>
              {isActive && <BUILabel tone="primary">Active</BUILabel>}
            </>
          }
          onQr={() => setShowQr(true)}
          onRestore={handleRestoreProofs}
          restoring={isRestoring && restoringMintUrl === mintUrl}
          restoreDisabled={isRestoring && restoringMintUrl !== mintUrl}
          bottomAction={
            <AppButton
              emphasis="secondary"
              size="large"
              icon={Trash2}
              disabled={isRemoving || isRestoring}
              onPress={() => removeMintSheetRef.current?.present()}
            >
              Remove mint
            </AppButton>
          }
        />

        <AppBottomSheet title="Remove mint" ref={removeMintSheetRef} canDismiss={!isRemoving}>
          <YStack gap={16}>
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
                            ? `₿${balance.toLocaleString()}`
                            : `${balance.toLocaleString()} sat`}
                        </Text>{' '}
                        in this mint. Transfer or withdraw this balance before removing it. Removing
                        the mint does not move your funds, and recovery is not guaranteed.
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
        </AppBottomSheet>
        <MintUrlQrOverlay url={mintUrl} visible={showQr} onClose={() => setShowQr(false)} />
      </SafeFlex>
    </YStack>
  );
}
