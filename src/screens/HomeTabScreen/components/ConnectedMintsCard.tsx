import React, { useMemo, useCallback } from 'react';
import { View, Text, YStack, XStack, H6, Image, styled, Button, Separator } from 'tamagui';
import { Plus, Sprout, Globe, ChevronRight, Settings2 } from '@tamagui/lucide-icons';
import { RollingNumber } from '~/components/UI/RollingNumber';
import { useRouter } from 'expo-router';
import { useWalletStore } from '~/store/walletStore';
import { useSettingsStore } from '~/store/settingsStore';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { currencyService, CurrencyCode } from '~/services/currencyService';
import { bitcoinService } from '~/services/bitcoinService';

const RowContainer = styled(XStack, {
  items: 'center',
  justify: 'space-between',
  gap: '$2',
  p: '$2',
  rounded: '$4',
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
            <View width={40} height={40} justify="center" bg="$gray5" rounded="$3" items="center">
              <Sprout size={20} color={isActive ? '$green10' : '$gray11'} />
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

          <YStack gap="$0.5" flex={1}>
            <XStack items="center" gap="$1.5" flexWrap="wrap">
              <Text
                fontSize="$5"
                fontWeight="400"
                color="$accent3"
                numberOfLines={1}
                style={{ maxWidth: 140 }}
              >
                {displayName}
              </Text>
            </XStack>
          </YStack>
        </XStack>

        <XStack items="center" gap="$1.5" pr="$2">
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

export const ConnectedMintsCard = () => {
  const router = useRouter();
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

  const normalizedActiveUrl = activeMintUrl?.replace(/\/$/, '');

  return (
    <>
      <YStack width="100%" gap="$3" p="$1.5" rounded="$6" bg="$color2">
        {/* Mints List */}
        {mints.length === 0 ? (
          <YStack py="$6" items="center" justify="center" gap="$2" opacity={0.6}>
            <View p="$3" bg="$gray4" rounded="$10">
              <Globe size={24} color="$gray10" />
            </View>
            <Text fontWeight="700" fontSize="$3" color="$color">
              No mints connected
            </Text>
            <Text fontSize="$2" color="$gray10" text="center">
              Add a Cashu mint to start sending and receiving ecash.
            </Text>
          </YStack>
        ) : (
          <YStack separator={<Separator borderColor="$borderColor" opacity={0.5} />}>
            {mints.map((mint) => {
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
            })}
          </YStack>
        )}
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
        <Button
          size="$4"
          circular
          theme="gray"
          icon={<Settings2 strokeWidth={3} size={18} color="$accent2" />}
          onPress={() => router.push('/(modals)/connected-mints')}
        />
      </XStack>
    </>
  );
};

export default ConnectedMintsCard;
