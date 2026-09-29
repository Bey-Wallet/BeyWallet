import React, { useMemo, useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, YStack, XStack, H6, Image, styled, Button, Separator } from 'tamagui';
import { Plus, Landmark } from '@tamagui/lucide-icons';
import { RollingNumber } from '~/shared/ui/RollingNumber';
import { useRouter } from 'expo-router';
import { useWalletStore } from '~/state/walletStore';
import { useSettingsStore } from '~/state/settingsStore';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { currencyService, CurrencyCode } from '~/services/wallet/currencyService';
import { bitcoinService } from '~/services/api/bitcoinService';
import { mintRecommendationService } from '~/services/api/mintRecommendationService';
import AddMintModal, { type AddMintModalRef } from '~/shared/ui/AddMintModal';
import {
  getMintPlaceholders,
  type RecommendedMint,
} from '~/features/home/components/mintPlaceholders';

const RowContainer = styled(XStack, {
  items: 'center',
  justify: 'space-between',
  gap: '$2',
  p: '$2',
  rounded: '$4',
  theme: 'gray',
  hoverStyle: { bg: '$backgroundHover' },
  pressStyle: { opacity: 0.7, bg: '$backgroundPress' },
});

interface MintRowItemProps {
  mint: any;
  balance: number;
  isActive: boolean;
  hideBalance: boolean;
  displayAsSats: boolean;
  showBitcoinSymbol: boolean;
  btcPrice: number | undefined;
  secondaryCurrency: string;
  refreshCounter: number;
  onPress: (mintUrl: string) => void;
}

const MintRowItem = React.memo(
  ({
    mint,
    balance,
    isActive,
    hideBalance,
    displayAsSats,
    showBitcoinSymbol,
    btcPrice,
    secondaryCurrency,
    refreshCounter,
    onPress,
  }: MintRowItemProps) => {
    const displayName =
      mint.nickname ||
      mint.name ||
      (() => {
        try {
          return new URL(mint.mintUrl).hostname;
        } catch {
          return mint.mintUrl;
        }
      })();

    const hostname = useMemo(() => {
      try {
        return new URL(mint.mintUrl).hostname;
      } catch {
        return mint.mintUrl;
      }
    }, [mint.mintUrl]);

    const displayValue = useMemo(() => {
      if (hideBalance) return '****';
      if (!displayAsSats) {
        if (!btcPrice) return '...';
        const fiat = currencyService.convertSatsToCurrency(balance, btcPrice);
        return currencyService.formatValue(fiat, secondaryCurrency as CurrencyCode);
      }
      return balance;
    }, [hideBalance, displayAsSats, balance, btcPrice, secondaryCurrency]);

    const prefix = useMemo(() => {
      if (hideBalance || !displayAsSats) return '';
      return showBitcoinSymbol ? '₿' : '';
    }, [hideBalance, displayAsSats, showBitcoinSymbol]);

    const suffix = useMemo(() => {
      if (hideBalance || !displayAsSats) return '';
      return showBitcoinSymbol ? '' : ' SATS';
    }, [hideBalance, displayAsSats, showBitcoinSymbol]);

    const currentTrigger = `${refreshCounter}_${mint.mintUrl}_${hideBalance ? 'hidden' : 'visible'}_${displayAsSats ? 'SATS' : 'FIAT'}_${showBitcoinSymbol}`;

    return (
      <RowContainer onPress={() => onPress(mint.mintUrl)}>
        <XStack items="center" gap="$2.5" flex={1} mr="$2">
          {!mint.icon ? (
            <View width={40} height={40} justify="center" bg="$color5" rounded={8} items="center">
              <Landmark size={20} color={isActive ? '$acolor1' : '$color11'} />
            </View>
          ) : (
            <Image
              src={mint.icon}
              width={40}
              height={40}
              alt={displayName}
              borderRadius={8}
              borderColor={isActive ? '$green10' : '$borderColor'}
              borderWidth={isActive ? 2 : 1}
            />
          )}

          <YStack gap="$0.5" flex={1} theme="gray">
            <XStack items="center" gap="$1.5" flexWrap="wrap">
              <Text
                fontSize="$5"
                fontWeight="600"
                color="$color"
                numberOfLines={1}
                style={{ maxWidth: 140 }}
              >
                {displayName}
              </Text>
            </XStack>
          </YStack>
        </XStack>

        <XStack items="center" gap="$1.5" pr="$2" theme="gray">
          <YStack items="flex-end" justify="center">
            <RollingNumber
              fontSize={16}
              fontWeight="900"
              color="$color"
              decimalOpacity={0.4}
              showDecimals={!displayAsSats}
              prefix={prefix}
              suffix={suffix}
              trigger={currentTrigger}
            >
              {displayValue}
            </RollingNumber>
          </YStack>
        </XStack>
      </RowContainer>
    );
  },
);

interface MintPlaceholderItemProps {
  mint: RecommendedMint;
  onAdd: (mintUrl: string) => void;
}

const MintPlaceholderItem = React.memo(({ mint, onAdd }: MintPlaceholderItemProps) => {
  const hostname = useMemo(() => new URL(mint.mintUrl).hostname, [mint.mintUrl]);
  const [iconFailed, setIconFailed] = useState(false);
  const { data: metadata } = useQuery({
    queryKey: ['mint-metadata', mint.mintUrl],
    queryFn: () => mintRecommendationService.fetchMintMetadata(mint.mintUrl),
    staleTime: 5 * 60 * 1000,
  });
  const iconUrl =
    metadata?.icon_url ||
    metadata?.picture ||
    metadata?.icon ||
    `${new URL(mint.mintUrl).origin}/favicon.ico`;

  useEffect(() => setIconFailed(false), [iconUrl]);

  return (
    <RowContainer>
      <XStack items="center" gap="$2.5" flex={1} mr="$2" opacity={0.48}>
        <View
          width={40}
          height={40}
          justify="center"
          bg="$color5"
          rounded={8}
          items="center"
          overflow="hidden"
        >
          {iconUrl && !iconFailed ? (
            <Image
              src={iconUrl}
              width={40}
              height={40}
              alt={`${mint.name} icon`}
              onError={() => setIconFailed(true)}
            />
          ) : (
            <Landmark size={20} color="$color11" />
          )}
        </View>
        <YStack gap="$0.5" flex={1} style={{ minWidth: 0 }}>
          <Text fontSize="$5" fontWeight="600" color="$color" numberOfLines={1}>
            {mint.name}
          </Text>
          <Text fontSize="$2" color="$gray10" numberOfLines={1}>
            {hostname}
          </Text>
        </YStack>
      </XStack>

      <Button
        size="$3"
        rounded="$10"
        theme="gray"
        icon={<Plus size={14} strokeWidth={3} />}
        onPress={() => onAdd(mint.mintUrl)}
        pressStyle={{ scale: 0.96, opacity: 0.8 }}
      >
        Add
      </Button>
    </RowContainer>
  );
});

MintPlaceholderItem.displayName = 'MintPlaceholderItem';

export const ConnectedMintsCard = () => {
  const router = useRouter();
  const addMintRef = useRef<AddMintModalRef>(null);
  const mints = useWalletStore((s) => s.mints);
  const balances = useWalletStore((s) => s.balances);
  const activeMintUrl = useWalletStore((s) => s.activeMintUrl);
  const refreshCounter = useWalletStore((s) => s.refreshCounter);
  const { primaryCurrency, secondaryCurrency, hideBalance, showBitcoinSymbol } = useSettingsStore();

  const isFiatEnabled = secondaryCurrency !== 'NONE';
  const displayAsSats = primaryCurrency === 'SATS' || !isFiatEnabled;

  const { data: btcData } = useQuery({
    queryKey: ['bitcoinPrice', secondaryCurrency],
    queryFn: () =>
      isFiatEnabled ? bitcoinService.fetchPrice(secondaryCurrency) : Promise.resolve({ price: 0 }),
    staleTime: 30000,
    enabled: isFiatEnabled,
  });

  const handleMintPress = useCallback(
    (mintUrl: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push({
        pathname: '/(modals)/mint-details',
        params: { mintUrl },
      });
    },
    [router],
  );

  const handleAddMint = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/(modals)/add-mint');
  }, [router]);

  const handleAddRecommendedMint = useCallback((mintUrl: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addMintRef.current?.present(mintUrl);
  }, []);

  const normalizedActiveUrl = activeMintUrl?.replace(/\/$/, '');
  const placeholders = useMemo(() => getMintPlaceholders(mints), [mints]);

  return (
    <>
      <YStack width="100%" gap="$3" p="$1.5" rounded="$6" bg="$color2">
        <YStack separator={<Separator borderColor="$borderColor" opacity={0.5} />}>
          {[
            ...mints.map((mint) => {
              const normalizedMintUrl = mint.mintUrl.replace(/\/$/, '');
              const balance = balances[mint.mintUrl] || 0;
              const isActive = normalizedMintUrl === normalizedActiveUrl;

              return (
                <MintRowItem
                  key={mint.mintUrl}
                  mint={mint}
                  balance={balance}
                  isActive={isActive}
                  hideBalance={hideBalance}
                  displayAsSats={displayAsSats}
                  showBitcoinSymbol={showBitcoinSymbol}
                  btcPrice={btcData?.price}
                  secondaryCurrency={secondaryCurrency}
                  refreshCounter={refreshCounter}
                  onPress={handleMintPress}
                />
              );
            }),
            ...placeholders.map((mint) => (
              <MintPlaceholderItem
                key={mint.mintUrl}
                mint={mint}
                onAdd={handleAddRecommendedMint}
              />
            )),
          ]}
        </YStack>
      </YStack>
      <XStack gap="$2">
        {/* Add Mint Button at bottom */}
        <Button
          size="$4"
          theme="gray"
          rounded="$10"
          onPress={handleAddMint}
          icon={<Plus strokeWidth={3} size={18} color="$accent2" />}
          pressStyle={{ scale: 0.98, opacity: 0.9 }}
        >
          <Text fontWeight="800" fontSize="$3" color="$accent2">
            Add Mint
          </Text>
        </Button>
      </XStack>
      <AddMintModal ref={addMintRef} />
    </>
  );
};

export default ConnectedMintsCard;
