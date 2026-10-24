import React from 'react';
import { H1, H2, Paragraph, Text, View, XStack, YStack, useTheme } from 'tamagui';
import { useWalletStore } from '~/state/walletStore';
import { RollingNumber } from '~/shared/ui/RollingNumber';
import { useSettingsStore } from '~/state/settingsStore';
import { currencyService, CurrencyCode } from '~/services/wallet/currencyService';
import { useQuery } from '@tanstack/react-query';
import { bitcoinService } from '~/services/api/bitcoinService';
import * as Haptics from 'expo-haptics';
import { appTypography } from '~/shared/theme/appearance';
import { useOfflineStatus } from '~/shared/hooks/useOfflineStatus';

export default function Balance() {
  const theme = useTheme();
  const hiddenBalanceBackground = String(theme.gray3.val);
  const balances = useWalletStore((s) => s.balances);
  const isRestoring = useWalletStore((s) => s.isRestoring);
  const isOffline = useOfflineStatus();
  const {
    primaryCurrency,
    setPrimaryCurrency,
    secondaryCurrency,
    hideBalance,
    setHideBalance,
    showBitcoinSymbol,
  } = useSettingsStore();

  const handlePrimaryCurrencyToggle = React.useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const nextVal = primaryCurrency === 'SATS' ? 'FIAT' : 'SATS';
    setPrimaryCurrency(nextVal);
  }, [primaryCurrency, setPrimaryCurrency]);

  const handleHideBalanceToggle = React.useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setHideBalance(!hideBalance);
  }, [hideBalance, setHideBalance]);
  const { data: btcData, isFetching: isFetchingPrice } = useQuery({
    queryKey: ['bitcoinPrice', secondaryCurrency],
    queryFn: () => bitcoinService.fetchPrice(secondaryCurrency),
    staleTime: 30000,
    enabled: secondaryCurrency !== 'NONE',
  });

  const currentBalance = React.useMemo(() => {
    return Object.values(balances).reduce((sum, val) => sum + (val || 0), 0);
  }, [balances]);

  const secondaryBalance = React.useMemo(() => {
    if (currentBalance === 0) return 0;
    if (!btcData?.price) return null;
    return currencyService.convertSatsToCurrency(currentBalance, btcData.price);
  }, [currentBalance, btcData?.price]);

  const isFiatEnabled = secondaryCurrency !== 'NONE';
  const displayAsSats = primaryCurrency === 'SATS' || !isFiatEnabled;
  const fiatText = !isFiatEnabled
    ? ''
    : secondaryBalance === null
      ? isFetchingPrice
        ? 'Loading…'
        : 'Unavailable'
      : currencyService.formatValue(secondaryBalance, secondaryCurrency as CurrencyCode);

  return (
    <YStack
      py="$2"
      gap="$3"
      z={1000}
      height={isFiatEnabled ? 200 : 160}
      justify="center"
      items="center"
      position="relative"
    >
      {/* Connection and sync status share the same space above the balance. */}
      {(isOffline || isRestoring) && (
        <XStack position="absolute" z={100} top={15} items="center" gap="$2" self="center">
          <View width={8} height={8} rounded="$10" bg="$gray10" animation="lazy" opacity={0.8} />
          <Text fontSize="$2" color="$gray10" fontWeight="600" accessibilityLiveRegion="polite">
            {isOffline ? 'Offline' : 'Syncing...'}
          </Text>
        </XStack>
      )}

      {/* Main Balance */}
      <YStack
        onPress={handleHideBalanceToggle}
        pressStyle={{ opacity: 0.7 }}
        items="center"
        justify="center"
        z={1000}
      >
        {displayAsSats ? (
          <RollingNumber
            value={hideBalance ? '****' : currentBalance}
            prefix={hideBalance ? '' : showBitcoinSymbol ? '₿' : ''}
            suffix={hideBalance ? '' : showBitcoinSymbol ? '' : ' sat'}
            trigger={`${hideBalance ? 'hidden' : 'visible_sats'}_${showBitcoinSymbol}`}

            fontSize={appTypography.display.fontSize}
            fontWeight={600}
            color="$color"

            decimalOpacity={0.4}
            showDecimals={false}
            style={
              hideBalance
                ? {
                    backgroundColor: hiddenBalanceBackground,
                    borderRadius: 120,
                    paddingHorizontal: 16,
                    paddingTop: 10,
                    alignItems: 'center',
                    justifyContent: 'center',
                    alignSelf: 'center',
                  }
                : undefined
            }
          />
        ) : (
          <RollingNumber
            value={hideBalance ? '****' : (secondaryBalance ?? undefined)}
            trigger={hideBalance ? 'hidden' : 'visible_fiat'}

            fontSize={appTypography.display.fontSize}
            fontWeight={600}
            color="$color"

            decimalOpacity={0.4}
            showDecimals={true}
            style={
              hideBalance
                ? {
                    backgroundColor: hiddenBalanceBackground,
                    borderRadius: 120,
                    paddingHorizontal: 16,
                    paddingTop: 10,
                    alignItems: 'center',
                    justifyContent: 'center',
                    alignSelf: 'center',
                  }
                : undefined
            }
          >
            {hideBalance ? undefined : fiatText}
          </RollingNumber>
        )}
      </YStack>

      {/* Secondary Balance */}
      {isFiatEnabled && (
        <RollingNumber
          value={
            hideBalance ? '****' : displayAsSats ? (secondaryBalance ?? undefined) : currentBalance
          }
          prefix={hideBalance ? '' : displayAsSats ? '' : showBitcoinSymbol ? '₿' : ''}
          suffix={hideBalance ? '' : displayAsSats ? '' : showBitcoinSymbol ? '' : ' sat'}
          trigger={
            (hideBalance ? '_hidden' : displayAsSats ? '_visible_fiat_sub' : '_visible_sats_sub') +
            `_${showBitcoinSymbol}`
          }
          fontSize={appTypography.body1.fontSize}
          fontWeight={500}
          color="$gray10"
          letterSpacing={appTypography.body1.letterSpacing}

          decimalOpacity={0.4}
          showDecimals={displayAsSats}
          style={{ marginTop: 4 }}
        >
          {!hideBalance && displayAsSats ? fiatText : undefined}
        </RollingNumber>
      )}
    </YStack>
  );
}
