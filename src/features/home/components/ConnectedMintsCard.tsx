import { MintImage } from '~/shared/ui/RemoteImage';
import { AppButton } from '~/shared/ui/AppButton';
import { AppPressable } from '~/shared/ui/AppPressable';
import React, { useMemo, useCallback, useEffect, useState } from 'react';
import { View, Text, YStack, XStack, styled } from 'tamagui';
import { Plus, Landmark, RefreshCw, ChevronRight } from '@tamagui/lucide-icons';
import { RollingNumber } from '~/shared/ui/RollingNumber';
import { useRouter } from 'expo-router';
import { useWalletStore } from '~/state/walletStore';
import { useSettingsStore } from '~/state/settingsStore';
import { useQueries, useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { currencyService, CurrencyCode } from '~/services/wallet/currencyService';
import { bitcoinService } from '~/services/api/bitcoinService';
import { mintInfoQueryOptions, useMintInfo } from '~/shared/hooks/useMintInfo';
import { useOfflineStatus } from '~/shared/hooks/useOfflineStatus';
import { appTypography } from '~/shared/theme/appearance';
import { rememberSettingsOrigin } from '~/features/settings/settingsNavigation';
import {
  getMintPlaceholders,
  type RecommendedMint,
} from '~/features/home/components/mintPlaceholders';

const RowContainer = styled(XStack, {
  items: 'center',
  justify: 'space-between',
  gap: '$2',
  py: '$1',
  minHeight: 56,
});

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
  unavailable: boolean;
  checking: boolean;
  onRecheck: () => void;
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
    unavailable,
    checking,
    onRecheck,
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
      <XStack items="center">
        <AppPressable
          flex={1}
          minWidth={0}
          opacity={unavailable ? 0.5 : 1}
          minHeight={56}
          rounded="$6"
          hoverStyle={{ opacity: 0.85 }}
          pressStyle={{ opacity: 0.7 }}
          onPress={() => onPress(mint.mintUrl)}
          accessibilityLabel={`Open ${displayName} mint details`}
          accessibilityHint={
            unavailable ? 'Mint unreachable. Use the refresh button to recheck.' : undefined
          }
        >
          <RowContainer>
            <XStack items="center" gap="$2" flex={1} minWidth={0}>
              <MintImage
                mintUrl={mint.mintUrl}
                src={mint.icon}
                width={44}
                height={44}
                alt={displayName}
                borderRadius={12}
                borderColor="$borderColor"
                borderWidth={mint.icon ? 1 : 0}
                fallback={<Landmark size={22} color="$iconSecondary" />}
              />

              <YStack gap="$0.5" flex={1} minWidth={0}>
                <XStack items="center" gap="$1.5">
                  <Text
                    {...appTypography.label1}
                    fontWeight="500"
                    color="$color"
                    numberOfLines={1}
                    flexShrink={1}
                  >
                    {displayName}
                  </Text>
                </XStack>
              </YStack>
            </XStack>

            <XStack items="center" gap="$1.5">
              <YStack items="flex-end" justify="center">
                <RollingNumber
                  fontSize={appTypography.label1.fontSize}
                  lineHeight={appTypography.label1.lineHeight}
                  fontWeight="600"
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
        </AppPressable>
        {unavailable && (
          <AppButton
            iconOnly
            emphasis="text"
            icon={RefreshCw}
            iconSize={22}
            textColor="$gray10"
            accessibilityLabel={`Recheck ${displayName} connection`}
            loading={checking}
            onPress={onRecheck}
          />
        )}
      </XStack>
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
      <XStack items="center" gap="$2" flex={1} minWidth={0} mr="$2">
        <View
          width={44}
          height={44}
          justify="center"
          bg="$gray3"
          rounded={12}
          items="center"
          overflow="hidden"
        >
          {iconUrl && !iconFailed ? (
            <MintImage
              mintUrl={mint.mintUrl}
              src={iconUrl}
              width={44}
              height={44}
              alt={`${mint.name} icon`}
              onError={() => setIconFailed(true)}
            />
          ) : (
            <Landmark size={22} color="$iconSecondary" />
          )}
        </View>
        <YStack gap="$0.5" flex={1} style={{ minWidth: 0 }}>
          <XStack items="center" gap="$1.5">
            <Text
              {...appTypography.label1}
              fontWeight="500"
              color="$color"
              numberOfLines={1}
              flexShrink={1}
            >
              {mint.name}
            </Text>
          </XStack>
          <Text {...appTypography.body3} color="$gray10" numberOfLines={1}>
            {hostname}
          </Text>
        </YStack>
      </XStack>

      <AppButton
        variant="default"
        emphasis="secondary"
        rounded={1000}
        size="xsmall"
        icon={Plus}
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
  const deviceOffline = useOfflineStatus();
  const mintConnections = useQueries({
    queries: mints.map((mint) => {
      const options = mintInfoQueryOptions(mint.mintUrl);
      return { ...options, enabled: options.enabled && !deviceOffline };
    }),
  });
  const unavailableConnections = deviceOffline
    ? []
    : mintConnections.filter((query) => query.error);
  const recheckUnavailable = () => {
    void Promise.all(
      unavailableConnections.map((query) => query.refetch({ cancelRefetch: false })),
    );
  };
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

  const handleManageMints = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    rememberSettingsOrigin('index');
    router.push('/(tabs)/settings/mints');
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
    <YStack width="100%" gap="$2" p="$0" rounded="$6">
      <XStack items="center" justify="space-between" gap="$3">
        <AppPressable
          minHeight={48}
          flexDirection="row"
          items="center"
          gap="$1"
          bg="transparent"
          hoverStyle={{ opacity: 0.85 }}
          pressStyle={{ opacity: 0.6 }}
          accessibilityLabel="Manage connected mints"
          onPress={handleManageMints}
        >
          <Text color="$gray10" fontSize="$4" fontWeight="600" accessibilityRole="header">
            {mints.length === 0 ? 'Suggested mints' : 'Mints'}
          </Text>
          <ChevronRight size={18} color="$gray10" aria-hidden />
        </AppPressable>
        <XStack items="center">
          {unavailableConnections.length > 1 && (
            <AppButton
              iconOnly
              emphasis="text"
              icon={RefreshCw}
              iconSize={22}
              textColor="$gray10"
              accessibilityLabel="Recheck unreachable mints"
              loading={unavailableConnections.some((query) => query.isFetching)}
              onPress={recheckUnavailable}
            />
          )}
          <AppPressable
            minHeight={48}
            minWidth={48}
            flexDirection="row"
            items="center"
            justify="center"
            gap="$1"
            bg="transparent"
            hoverStyle={{ opacity: 0.85 }}
            pressStyle={{ opacity: 0.6 }}
            accessibilityLabel="Add mint"
            onPress={handleAddMint}
          >
            <Plus size={20} color="$gray10" aria-hidden />
            <Text fontSize="$3" fontWeight="600" color="$gray10">
              Add
            </Text>
          </AppPressable>
        </XStack>
      </XStack>
      <YStack>
        {[
          ...mints.map((mint, index) => {
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
                unavailable={!deviceOffline && !!mintConnections[index].error}
                checking={mintConnections[index].isFetching}
                onRecheck={() => {
                  void mintConnections[index].refetch({ cancelRefetch: false });
                }}
                onPress={handleMintPress}
              />
            );
          }),
          ...placeholders.map((mint) => (
            <MintPlaceholderItem key={mint.mintUrl} mint={mint} onAdd={handleAddRecommendedMint} />
          )),
        ]}
      </YStack>
    </YStack>
  );
};

export default ConnectedMintsCard;
