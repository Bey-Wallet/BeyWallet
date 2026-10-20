import { MintImage } from '~/shared/ui/RemoteImage';
import { AppIconButton } from '~/shared/ui/AppIconButton';
import { AppButton } from '~/shared/ui/AppButton';
import React, { useMemo, useCallback, useEffect, useState } from 'react';
import { View, Text, YStack, XStack, H6, styled, Separator } from 'tamagui';
import { Plus, Landmark, Zap, Bitcoin } from '@tamagui/lucide-icons';
import { RollingNumber } from '~/shared/ui/RollingNumber';
import { useRouter } from 'expo-router';
import { useWalletStore } from '~/state/walletStore';
import { useSettingsStore } from '~/state/settingsStore';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { currencyService, CurrencyCode } from '~/services/wallet/currencyService';
import { bitcoinService } from '~/services/api/bitcoinService';
import { useMintInfo } from '~/shared/hooks/useMintInfo';
import { supportsPaymentMethod } from '~/services/wallet/paymentMintPolicy';
import {
  getMintPlaceholders,
  type RecommendedMint,
} from '~/features/home/components/mintPlaceholders';

const RowContainer = styled(XStack, {
  items: 'center',
  justify: 'space-between',
  gap: '$2',
  py: '$2',
  rounded: '$4',
  theme: 'gray',
  hoverStyle: { bg: '$backgroundHover' },
  pressStyle: { opacity: 0.7, bg: '$backgroundPress' },
});

function MintPaymentBadges({ metadata }: { metadata?: Record<string, any> }) {
  const lightning =
    supportsPaymentMethod(metadata, 'mint-lightning') ||
    supportsPaymentMethod(metadata, 'melt-lightning');
  const onchain =
    supportsPaymentMethod(metadata, 'mint-onchain') ||
    supportsPaymentMethod(metadata, 'melt-onchain');
  if (!lightning && !onchain) return null;
  return (
    <XStack gap="$1.5" items="center">
      {lightning && (
        <View
          width={18}
          height={18}
          rounded={100}
          borderWidth={1}
          borderColor="$gray7"
          items="center"
          justify="center"
          accessible
          accessibilityRole="image"
          accessibilityLabel="Lightning supported"
        >
          <Zap size={10} color="$gray10" fill="gray" />
        </View>
      )}
      {onchain && (
        <View
          width={18}
          height={18}
          rounded={100}
          borderWidth={1}
          borderColor="$gray7"
          items="center"
          justify="center"
          accessible
          accessibilityRole="image"
          accessibilityLabel="On-chain supported"
        >
          <Bitcoin size={10} color="$gray10" />
        </View>
      )}
    </XStack>
  );
}

interface MintRowItemProps {
  mint: any;
  balance: number;
  hideBalance: boolean;
  displayAsSats: boolean;
  showBitcoinSymbol: boolean;
  btcPrice: number | undefined;
  secondaryCurrency: string;
  refreshCounter: number;
  loading: boolean;
  onPress: (mintUrl: string) => void;
}

const MintRowItem = React.memo(
  ({
    mint,
    balance,
    hideBalance,
    displayAsSats,
    showBitcoinSymbol,
    btcPrice,
    secondaryCurrency,
    refreshCounter,
    loading,
    onPress,
  }: MintRowItemProps) => {
    const { data: metadata } = useMintInfo(mint.mintUrl);
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
        if (!btcPrice && balance !== 0) return loading ? 'Loading…' : 'Unavailable';
        const fiat = balance === 0 ? 0 : currencyService.convertSatsToCurrency(balance, btcPrice!);
        return currencyService.formatValue(fiat, secondaryCurrency as CurrencyCode);
      }
      return balance;
    }, [hideBalance, displayAsSats, balance, btcPrice, secondaryCurrency, loading]);

    const prefix = useMemo(() => {
      if (hideBalance || !displayAsSats) return '';
      return showBitcoinSymbol ? '₿' : '';
    }, [hideBalance, displayAsSats, showBitcoinSymbol]);

    const suffix = useMemo(() => {
      if (hideBalance || !displayAsSats) return '';
      return showBitcoinSymbol ? '' : ' sat';
    }, [hideBalance, displayAsSats, showBitcoinSymbol]);

    const currentTrigger = `${refreshCounter}_${mint.mintUrl}_${hideBalance ? 'hidden' : 'visible'}_${displayAsSats ? 'SATS' : 'FIAT'}_${showBitcoinSymbol}`;

    return (
      <RowContainer onPress={() => onPress(mint.mintUrl)}>
        <XStack items="center" gap="$2.5" flex={1} mr="$0">
          <MintImage
            mintUrl={mint.mintUrl}
            src={mint.icon}
            width={40}
            height={40}
            alt={displayName}
            borderRadius={8}
            borderColor="$borderColor"
            borderWidth={mint.icon ? 1 : 0}
            fallback={<Landmark size={20} color="$color11" />}
          />

          <YStack gap="$0.5" flex={1} theme="gray">
            <XStack items="center" gap="$1.5" flexWrap="wrap">
              <Text
                fontSize="$5"
                fontWeight="500"
                color="$color"
                numberOfLines={1}
                style={{ maxWidth: 140 }}
              >
                {displayName}
              </Text>
              <MintPaymentBadges metadata={metadata} />
            </XStack>
          </YStack>
        </XStack>

        <XStack items="center" gap="$1.5" pr="$2" theme="gray">
          <YStack items="flex-end" justify="center">
            <RollingNumber
              fontSize={16}
              fontWeight="500"
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
  const { data: metadata } = useMintInfo(mint.mintUrl);
  const iconUrl =
    metadata?.icon_url ||
    metadata?.picture ||
    metadata?.icon ||
    `${new URL(mint.mintUrl).origin}/favicon.ico`;

  useEffect(() => setIconFailed(false), [mint.mintUrl, iconUrl]);

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
            <MintImage
              mintUrl={mint.mintUrl}
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
          <XStack items="center" gap="$1.5" flexWrap="wrap">
            <Text fontSize="$5" fontWeight="500" color="$color" numberOfLines={1} flexShrink={1}>
              {mint.name}
            </Text>
            <MintPaymentBadges metadata={metadata} />
          </XStack>
          <Text fontSize="$2" color="$gray10" numberOfLines={1}>
            {hostname}
          </Text>
        </YStack>
      </XStack>

      <AppButton
        variant="default"
        emphasis="secondary"
        size="xsmall"
        icon={<Plus size={14} strokeWidth={3} />}
        onPress={() => onAdd(mint.mintUrl)}
      >
        Add
      </AppButton>
    </RowContainer>
  );
});

MintPlaceholderItem.displayName = 'MintPlaceholderItem';

export const ConnectedMintsCard = () => {
  const router = useRouter();
  const mints = useWalletStore((s) => s.mints);
  const balances = useWalletStore((s) => s.balances);
  const refreshCounter = useWalletStore((s) => s.refreshCounter);
  const { primaryCurrency, secondaryCurrency, hideBalance, showBitcoinSymbol } = useSettingsStore();

  const isFiatEnabled = secondaryCurrency !== 'NONE';
  const displayAsSats = primaryCurrency === 'SATS' || !isFiatEnabled;

  const { data: btcData, isFetching: isFetchingPrice } = useQuery({
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

  const handleAddRecommendedMint = useCallback(
    (mintUrl: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push({ pathname: '/(modals)/mint-profile', params: { url: mintUrl } });
    },
    [router],
  );

  const placeholders = useMemo(() => getMintPlaceholders(mints), [mints]);

  return (
    <>
      <YStack width="100%" gap="$3" p="$0" rounded="$6">
        <XStack items="center" my="$-2" justify="space-between">
          <H6 fontWeight="800" fontSize="$4" color="$color10">
            Mints
          </H6>
          <AppIconButton
            variant="default"
            emphasis="tertiary"
            size="xxsmall"

            shape="circular"
            accessibilityLabel="Add mint"
            icon={<Plus strokeWidth={3} size={18} color="$accent2" />}
            onPress={handleAddMint}
          />
        </XStack>
        <YStack>
          {[
            ...mints.map((mint) => {
              const balance = balances[mint.mintUrl] || 0;

              return (
                <MintRowItem
                  key={mint.mintUrl}
                  mint={mint}
                  balance={balance}
                  hideBalance={hideBalance}
                  displayAsSats={displayAsSats}
                  showBitcoinSymbol={showBitcoinSymbol}
                  btcPrice={btcData?.price}
                  secondaryCurrency={secondaryCurrency}
                  refreshCounter={refreshCounter}
                  loading={!displayAsSats && isFetchingPrice}
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
        <AppButton
          variant="default"
          emphasis="secondary"
          size="medium"
          icon={<Plus strokeWidth={3} size={18} color="$accent2" />}
          onPress={handleAddMint}
        >
          Add Mint
        </AppButton>
      </XStack>
    </>
  );
};

export default ConnectedMintsCard;
