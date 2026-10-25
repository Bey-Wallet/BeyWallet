import { MintImage } from '~/shared/ui/RemoteImage';
import { AppButton } from '~/shared/ui/AppButton';
import { AppPressable } from '~/shared/ui/AppPressable';
import React, { useMemo, useCallback, useEffect, useState } from 'react';
import { View, Text, YStack, XStack, styled } from 'tamagui';
import { Plus, Landmark, Zap, Bitcoin, CircleAlert, ChevronRight } from '@tamagui/lucide-icons';
import { RollingNumber } from '~/shared/ui/RollingNumber';
import { useRouter } from 'expo-router';
import { useWalletStore } from '~/state/walletStore';
import { useSettingsStore } from '~/state/settingsStore';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { currencyService, CurrencyCode } from '~/services/wallet/currencyService';
import { bitcoinService } from '~/services/api/bitcoinService';
import { useMintInfo } from '~/shared/hooks/useMintInfo';
import { useOfflineStatus } from '~/shared/hooks/useOfflineStatus';
import { supportsPaymentMethod } from '~/services/wallet/paymentMintPolicy';
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
  rounded: '$4',
  hoverStyle: { bg: '$buttonDefaultSecondaryHover' },
  pressStyle: { opacity: 0.7, bg: '$buttonDefaultSecondaryPress' },
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
  deviceOffline: boolean;
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
    deviceOffline,
    onPress,
  }: MintRowItemProps) => {
    const { data: metadata, error: connectionError } = useMintInfo(mint.mintUrl);
    const unavailable = !deviceOffline && !!connectionError;
    const textColor = unavailable ? '$red11' : '$color';
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
      <RowContainer
        onPress={() => onPress(mint.mintUrl)}
        accessibilityHint={unavailable ? 'Mint unreachable. Open details to recheck.' : undefined}
      >
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
              <Text {...appTypography.label1} color={textColor} numberOfLines={1} flexShrink={1}>
                {displayName}
              </Text>
              {unavailable ? (
                <View accessible accessibilityRole="image" accessibilityLabel="Mint unreachable">
                  <CircleAlert size={18} color="$red11" />
                </View>
              ) : (
                <MintPaymentBadges metadata={metadata} />
              )}
            </XStack>
          </YStack>
        </XStack>

        <XStack items="center" gap="$1.5">
          <YStack items="flex-end" justify="center">
            <RollingNumber
              fontSize={appTypography.label1.fontSize}
              fontWeight="600"
              color={textColor}
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
      <XStack items="center" gap="$2" flex={1} minWidth={0} mr="$2" opacity={0.48}>
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
            <Text {...appTypography.label1} color="$color" numberOfLines={1} flexShrink={1}>
              {mint.name}
            </Text>
            <MintPaymentBadges metadata={metadata} />
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
          minHeight={0}
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
            Mints
          </Text>
          <ChevronRight size={18} color="$gray10" aria-hidden />
        </AppPressable>
        <AppPressable
          minHeight={0}
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
                deviceOffline={deviceOffline}
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
