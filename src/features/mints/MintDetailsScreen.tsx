import { MintImage } from '~/shared/ui/RemoteImage';
import { AppIconButton } from '~/shared/ui/AppIconButton';
import { AppButton } from '~/shared/ui/AppButton';
import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { YStack, XStack, Text, ScrollView, View, Separator, Input } from 'tamagui';
import {
  ChevronLeft,
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
import * as Clipboard from 'expo-clipboard';
import AppBottomSheet, { AppBottomSheetRef } from '~/shared/ui/AppBottomSheet';
import { Share as RNShare, Keyboard } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWalletStore } from '~/state/walletStore';
import { useSettingsStore } from '~/state/settingsStore';
import { currencyService, CurrencyCode } from '~/services/wallet/currencyService';
import { bitcoinService } from '~/services/api/bitcoinService';
import { ListTable, ListTableRow } from '~/shared/ui/ListTable';
import { useToastController } from '@tamagui/toast';
import { SafeFlex } from '~/shared/ui/Flex';
import { useMintInfo } from '~/shared/hooks/useMintInfo';
import { MintReliabilityRow, MintPreviewHealth } from './components/MintPreviewHealth';
import { MintPreviewMethods, mintPreviewMethods } from './components/MintPreviewMethods';
import { MintUrlQrOverlay } from './components/MintUrlQrOverlay';

const mintText = (value: unknown) => (typeof value === 'string' ? value : undefined);

export default function MintDetailsModal() {
  const router = useRouter();
  const toast = useToastController();
  const insets = useSafeAreaInsets();
  const { mintUrl, editName } = useLocalSearchParams<{ mintUrl: string; editName?: string }>();
  const {
    mints,
    balances,
    setActiveMint,
    activeMintUrl,
    removeMint,
    isRestoring,
    restoringMintUrl,
    setMintNickname,
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
    try {
      removeMintSheetRef.current?.dismiss();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      safeGoBack();
      await removeMint(mintUrl || '');
      toast.show('Mint removed', { kind: 'success' });
    } catch (e: any) {
      isRemovingRef.current = false;
      console.error('Failed to remove mint:', e);
      toast.show(e.message || 'Failed to remove mint.', { kind: 'error' });
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
    if (!btcData?.price) return 0;
    return currencyService.convertSatsToCurrency(balance, btcData.price);
  }, [balance, btcData?.price]);

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

  const description = mintText(info?.description) || mintText(info?.description_long);
  const motd = mintText(info?.motd);
  const version = mintText(info?.version);
  const nuts = info?.nuts || {};
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
      toast.show('Mint name updated', { kind: 'success' });
    } catch (error) {
      toast.show(error instanceof Error ? error.message : 'Could not save mint name.', {
        kind: 'error',
      });
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
            fontSize="$4"
            fontWeight="800"
            color="$color"
            textAlign="center"
            width={200}
            height={36}
            py={0}
            px="$2"
            bg="$gray3"
            borderWidth={0}
          />
        ) : (
          <Text fontSize="$4" fontWeight="800" color="$color" numberOfLines={1}>
            {name}
          </Text>
        )}
        <Text fontSize="$1" color="$gray10" numberOfLines={1} style={{ maxWidth: 200 }}>
          {hostname}
        </Text>
      </YStack>
    ),
    [isEditingName, isSavingName, handleSaveName, name, hostname],
  );

  if (!mintUrl || !walletMint) {
    return (
      <YStack flex={1} justify="center" items="center" p="$4" bg="$background">
        <Text color="$color" fontSize="$5" fontWeight="600">
          Mint not found
        </Text>
        <AppButton variant="default" emphasis="primary" size="medium" mt="$4" onPress={safeGoBack}>
          Go Back
        </AppButton>
      </YStack>
    );
  }

  const tableProps = {
    compact: true,
    bg: '$gray3',
    separator: <YStack height={2} width="100%" bg="$background" />,
  };
  const connection = isCheckingConnection ? 'checking' : connectionError ? 'offline' : 'online';
  const units = [
    ...new Set([
      ...(Array.isArray(info?.units)
        ? info.units.filter((unit): unit is string => typeof unit === 'string')
        : []),
      ...mintPreviewMethods(info || {}).flatMap((method) => (method.unit ? [method.unit] : [])),
    ]),
  ];
  const contacts = Array.isArray(info?.contact) ? info.contact : [];

  const handleCopy = async (text: string, label: string) => {
    await Clipboard.setStringAsync(text);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    toast.show(`${label} copied to clipboard`, { kind: 'success' });
  };

  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await RNShare.share({ message: mintUrl });
    } catch (error) {
      handleCopy(mintUrl, 'Mint URL');
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
            <AppIconButton
              variant="default"
              emphasis="secondary"
              size="xsmall"

              shape="circular"
              accessibilityLabel="Go back"
              icon={<ChevronLeft size={20} color="$color" />}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                safeGoBack();
              }}
            />
          ),
          headerRight: () => (
            <AppIconButton
              variant="default"
              emphasis="secondary"
              size="xsmall"

              shape="circular"
              accessibilityLabel={isEditingName ? 'Save mint name' : 'Edit mint name'}
              iconSize={isEditingName ? 18 : 14}
              icon={
                isEditingName ? (
                  <Check size={18} color="$color" />
                ) : (
                  <Pencil size={14} color="$color" />
                )
              }
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
          contentContainerStyle={{ paddingBottom: insets.bottom + 90 }}
        >
          <YStack px="$4" gap="$5">
            {/* Balance and Avatar Row */}
            <XStack justify="space-between" items="center" pt="$4">
              <YStack gap="$2">
                <XStack items="baseline" gap="$1">
                  {primaryCurrency === 'SATS' ? (
                    <Text fontSize={36} fontWeight="900" color="$color">
                      {showBitcoinSymbol ? '₿' : ''}
                      {balance.toLocaleString()}
                      {!showBitcoinSymbol && <Text fontSize={20}>{' sat'}</Text>}
                    </Text>
                  ) : (
                    <Text fontSize={36} fontWeight="900" color="$color">
                      {currencyService.formatValue(fiatBalance, secondaryCurrency as CurrencyCode)}
                    </Text>
                  )}
                </XStack>
                <Text fontSize="$6" color="$gray12" fontWeight="600">
                  {primaryCurrency === 'SATS'
                    ? currencyService.formatValue(fiatBalance, secondaryCurrency as CurrencyCode)
                    : showBitcoinSymbol
                      ? `₿${balance.toLocaleString()}`
                      : `${balance.toLocaleString()} sat`}
                </Text>

                {/* Trust badges */}
                <XStack mt="$2" gap="$2" items="center">
                  {isTrusted ? (
                    <View bg="$green3" px="$2" py="$1" rounded="$3">
                      <Text color="$green11" fontWeight="600">
                        Trusted
                      </Text>
                    </View>
                  ) : (
                    <View bg="$red3" px="$2" py="$1" rounded="$3">
                      <Text color="$red11" fontWeight="600">
                        Untrusted
                      </Text>
                    </View>
                  )}
                  {isActive && (
                    <View bg="$blue3" px="$2" py="$1" rounded="$3">
                      <Text color="$blue11" fontWeight="600">
                        Active
                      </Text>
                    </View>
                  )}
                </XStack>
              </YStack>

              <YStack items="center" gap="$2">
                <MintImage
                  mintUrl={mintUrl}
                  source={{ uri: iconToUse }}
                  style={{
                    width: 100,
                    height: 100,
                    borderRadius: 20,
                  }}
                />
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
            </XStack>

            {/* Action Columns Row */}
            <XStack py="$4" justify="space-around" bg="$gray2" rounded="$6" mt="$2">
              <YStack
                items="center"
                gap="$2"
                onPress={handleDeposit}
                pressStyle={{ opacity: 0.7 }}
                flex={1}
              >
                <ArrowDownToLine size={24} color="$color" />
                <Text fontSize="$3" fontWeight="600" color="$color">
                  Deposit
                </Text>
              </YStack>
              <Separator vertical borderColor="$borderColor" opacity={0.5} />
              <YStack
                items="center"
                gap="$2"
                onPress={handleWithdraw}
                pressStyle={{ opacity: 0.7 }}
                flex={1}
              >
                <ArrowUpFromLine size={24} color="$color" />
                <Text fontSize="$3" fontWeight="600" color="$color">
                  Withdraw
                </Text>
              </YStack>
              <Separator vertical borderColor="$borderColor" opacity={0.5} />
              <YStack
                items="center"
                gap="$2"
                onPress={handleTransfer}
                pressStyle={{ opacity: 0.7 }}
                flex={1}
              >
                <ArrowRightLeft size={24} color="$color" />
                <Text fontSize="$3" fontWeight="600" color="$color">
                  Transfer
                </Text>
              </YStack>
            </XStack>

            {/* Mint information */}
            <MintReliabilityRow
              url={mintUrl}
              connection={connection}
              onRecheck={() => {
                void recheckConnection({ cancelRefetch: false });
              }}
            />

            {motd && (
              <YStack gap="$3">
                <Text color="$gray10" fontSize="$4" fontWeight="600">
                  Message from the mint
                </Text>
                <ListTable {...tableProps}>
                  <YStack px="$4" py="$3" gap="$2">
                    <Text theme="orange" lineHeight={22}>
                      {motd}
                    </Text>
                  </YStack>
                </ListTable>
              </YStack>
            )}
            {description && (
              <YStack gap="$3">
                <Text color="$gray10" fontSize="$4" fontWeight="600">
                  About
                </Text>
                <ListTable {...tableProps}>
                  <YStack px="$4" py="$3" gap="$2">
                    <Text lineHeight={22}>{description}</Text>
                  </YStack>
                </ListTable>
              </YStack>
            )}
            <YStack gap="$3">
              <Text color="$gray10" fontSize="$4" fontWeight="600">
                Mint Details
              </Text>
              <ListTable {...tableProps}>
                <ListTableRow label="URL" value={mintUrl} isCopyable copyValue={mintUrl} />
                {version && <ListTableRow label="Version" value={version} />}
                <ListTableRow label="Advertised NUTs" value={Object.keys(nuts).length} />
                <ListTableRow label="Units" value={units.join(', ') || 'Not provided'} />
                {mintText(info?.pubkey) && (
                  <ListTableRow label="Public key" value={mintText(info?.pubkey)} isCopyable />
                )}
                {mintText(info?.tos_url) && (
                  <ListTableRow
                    label="Terms of service"
                    value={mintText(info?.tos_url)}
                    isCopyable
                  />
                )}
              </ListTable>
            </YStack>
            <MintPreviewMethods info={info || {}} />
            <MintPreviewHealth
              url={mintUrl}
              connection={connection}
              connectionCheckedAt={Math.max(connectionCheckedAt, connectionErrorAt)}
              onRecheck={() => {
                void recheckConnection();
              }}
            />
            {contacts.length > 0 && (
              <YStack gap="$3">
                <Text color="$gray10" fontSize="$4" fontWeight="600">
                  Contact & Support
                </Text>
                <ListTable {...tableProps}>
                  {contacts.map((contact, index) => {
                    const method =
                      mintText(Array.isArray(contact) ? contact[0] : contact?.method) || 'Contact';
                    const value = mintText(Array.isArray(contact) ? contact[1] : contact?.info);
                    return value ? (
                      <ListTableRow
                        key={index}
                        label={method.charAt(0).toUpperCase() + method.slice(1)}
                        value={value}
                        isCopyable
                      />
                    ) : null;
                  })}
                </ListTable>
              </YStack>
            )}
          </YStack>
        </ScrollView>

        {/* Floating Action Buttons */}
        <XStack
          px="$4"
          pb={'$2'}
          pt="$3"
          bg="$background"
          borderTopWidth={1}
          borderColor="$borderColor"
          gap="$2.5"
        >
          <AppButton
            variant="branded"
            emphasis="secondary"
            size="medium"
            loading={isRestoring && restoringMintUrl === mintUrl}
            icon={<RefreshCw size={18} />}
            flex={1}
            onPress={handleRestoreProofs}
            disabled={isRestoring}
          >
            {isRestoring && restoringMintUrl === mintUrl ? 'Restoring...' : 'Restore'}
          </AppButton>

          <AppButton
            variant="branded"
            emphasis="secondary"
            size="medium"
            icon={<Trash2 strokeWidth={2.5} />}
            flex={1}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              removeMintSheetRef.current?.present();
            }}
          >
            Remove
          </AppButton>
        </XStack>
        {/* Remove Mint Confirmation Bottom Sheet */}
        <AppBottomSheet ref={removeMintSheetRef} snapPoints={balance > 0 ? ['60%'] : ['40%']}>
          <YStack p="$4" gap="$4">
            <View bg="$red3" p="$4" rounded="$4" borderWidth={1} borderColor="$red8">
              <XStack gap="$3">
                <AlertTriangle color="$red10" size={24} />
                <YStack flex={1}>
                  <Text color="$red10" fontWeight="700" fontSize="$5">
                    Remove Mint
                  </Text>
                  <Text color="$red10" fontSize="$3" mt="$1">
                    Are you sure you want to remove this mint? This action will remove the mint
                    configuration from your wallet.
                  </Text>
                </YStack>
              </XStack>
            </View>

            {balance > 0 && (
              <View bg="$orange3" p="$4" rounded="$4" borderWidth={1} borderColor="$orange8">
                <XStack gap="$3">
                  <AlertTriangle color="$orange10" size={24} />
                  <YStack flex={1}>
                    <Text color="$orange10" fontWeight="700" fontSize="$5">
                      Active Balance Warning
                    </Text>
                    <Text color="$orange10" fontSize="$3" mt="$1">
                      You currently have a balance of{' '}
                      <Text fontWeight="800">
                        {showBitcoinSymbol
                          ? `₿${balance.toLocaleString()}`
                          : `${balance.toLocaleString()} sat`}
                      </Text>{' '}
                      in this mint. If you remove it, you will lose access to these funds!
                    </Text>
                  </YStack>
                </XStack>
              </View>
            )}

            <YStack gap="$3" mt="$2">
              <AppButton
                variant="critical"
                emphasis="primary"
                size="large"
                onPress={handleRemoveMint}
              >
                Confirm Remove
              </AppButton>
              <AppButton
                variant="default"
                emphasis="secondary"
                size="large"
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
