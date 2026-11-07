import React from 'react';
import { Animated } from 'react-native';
import { Text, XStack, YStack, useTheme } from 'tamagui';
import { useWalletStore } from '~/state/walletStore';
import { RollingNumber } from '~/shared/ui/RollingNumber';
import { AppPressable } from '~/shared/ui/AppPressable';
import { useSettingsStore } from '~/state/settingsStore';
import { currencyService, CurrencyCode } from '~/services/wallet/currencyService';
import { useQuery } from '@tanstack/react-query';
import { bitcoinService } from '~/services/api/bitcoinService';
import * as Haptics from 'expo-haptics';
import { appRadii, appSpacing, appTypography } from '~/shared/theme/appearance';
import { useOfflineStatus } from '~/shared/hooks/useOfflineStatus';
import { useReducedMotion } from '~/shared/hooks/useReducedMotion';

export default function Balance() {
  const theme = useTheme();
  const hiddenBalanceBackground = String(theme.gray3.val);
  const balances = useWalletStore((s) => s.balances);
  const isRestoring = useWalletStore((s) => s.isRestoring);
  const isRefreshing = useWalletStore((s) => s.isRefreshing);
  const refreshCounter = useWalletStore((s) => s.refreshCounter);
  const refreshError = useWalletStore((s) => s.error);
  const isOffline = useOfflineStatus();
  const reducedMotion = useReducedMotion();
  const [justUpdated, setJustUpdated] = React.useState(false);
  const lastRefresh = React.useRef(refreshCounter);
  const statusOpacity = React.useRef(new Animated.Value(1)).current;
  const { primaryCurrency, secondaryCurrency, hideBalance, showBitcoinSymbol } = useSettingsStore();

  React.useEffect(() => {
    const changed = lastRefresh.current !== refreshCounter;
    lastRefresh.current = refreshCounter;
    statusOpacity.setValue(1);
    setJustUpdated(changed && !isOffline && !isRestoring && !refreshError);
    if (!changed || isOffline || isRestoring || refreshError) return;
    const timer = setTimeout(() => {
      if (reducedMotion) {
        setJustUpdated(false);
        return;
      }
      Animated.timing(statusOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setJustUpdated(false);
      });
    }, 2500);
    return () => {
      clearTimeout(timer);
      statusOpacity.stopAnimation();
    };
  }, [refreshCounter, isOffline, isRestoring, refreshError, reducedMotion, statusOpacity]);

  const handlePrimaryCurrencyToggle = React.useCallback(() => {
    const current = useSettingsStore.getState();
    if (current.hideBalance || current.secondaryCurrency === 'NONE') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const nextVal = current.primaryCurrency === 'SATS' ? 'FIAT' : 'SATS';
    void current.setPrimaryCurrency(nextVal);
  }, []);

  const handleHideBalanceToggle = React.useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const current = useSettingsStore.getState();
    void current.setHideBalance(!current.hideBalance);
  }, []);
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
      width="100%"
      py={appSpacing.group}
      gap={0}
      z={1000}
      minHeight={appSpacing.section * 6}
      justify="center"
      items="center"
      position="relative"
    >
      {/* Connection and sync status share the same space above the balance. */}
      {(isOffline || isRestoring || isRefreshing || justUpdated) && (
        <XStack position="absolute" z={100} top={0} items="center" gap="$2" self="center">
          <Animated.View style={{ opacity: justUpdated && !isRefreshing ? statusOpacity : 1 }}>
            <Text fontSize="$2" color="$gray10" fontWeight="600" accessibilityLiveRegion="polite">
              {isOffline
                ? 'Offline'
                : isRestoring
                  ? 'Syncing...'
                  : isRefreshing
                    ? 'Refreshing...'
                    : 'Updated just now'}
            </Text>
          </Animated.View>
        </XStack>
      )}

      {/* Main Balance */}
      <AppPressable
        onPress={handleHideBalanceToggle}
        onLongPress={handleHideBalanceToggle}
        accessibilityLabel={hideBalance ? 'Show balance' : 'Hide balance'}
        accessibilityHint="Tap or hold to toggle balance privacy"
        minHeight={48}
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
            letterSpacing={-1.5}
            color="$accent1"

            decimalOpacity={1}
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
            letterSpacing={-1.5}
            color="$accent1"

            decimalOpacity={1}
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
      </AppPressable>

      {/* Secondary Balance */}
      {isFiatEnabled && (
        <AppPressable
          testID="home-balance-currency-toggle"
          mt={appSpacing.compact}
          accessibilityLabel={
            hideBalance
              ? 'Show balance to switch currency'
              : `Display balance in ${displayAsSats ? secondaryCurrency : 'sats'}`
          }
          accessibilityHint="Swaps the primary and secondary balance amounts"
          disabled={hideBalance}
          onPress={handlePrimaryCurrencyToggle}
          minHeight={36}
          minWidth={64}
          hitSlop={{ top: 0, bottom: 12, left: 0, right: 0 }}
          px={appSpacing.compact}
          py={appSpacing.tiny}
          rounded={appRadii.pill}
          bg="$gray2"
          hoverStyle={{ bg: '$gray3' }}
          pressStyle={{ bg: '$gray4' }}
          items="center"
          justify="center"
          opacity={hideBalance ? 0.5 : 1}
        >
          <RollingNumber
            value={
              hideBalance
                ? '****'
                : displayAsSats
                  ? (secondaryBalance ?? undefined)
                  : currentBalance
            }
            prefix={hideBalance ? '' : displayAsSats ? '' : showBitcoinSymbol ? '₿' : ''}
            suffix={hideBalance ? '' : displayAsSats ? '' : showBitcoinSymbol ? '' : ' sat'}
            trigger={
              (hideBalance
                ? '_hidden'
                : displayAsSats
                  ? '_visible_fiat_sub'
                  : '_visible_sats_sub') + `_${showBitcoinSymbol}`
            }
            fontSize={appTypography.body1.fontSize}
            fontWeight={500}
            color="$gray10"
            letterSpacing={appTypography.body1.letterSpacing}

            decimalOpacity={0.4}
            showDecimals={displayAsSats}
          >
            {!hideBalance && displayAsSats ? fiatText : undefined}
          </RollingNumber>
        </AppPressable>
      )}
    </YStack>
  );
}
