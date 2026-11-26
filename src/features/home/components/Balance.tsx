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
import { hapticService } from '~/services/platform/hapticService';
import {
  appRadii,
  appSpacing,
  appTypography,
  getAmountLetterSpacing,
} from '~/shared/theme/appearance';
import { useOfflineStatus } from '~/shared/hooks/useOfflineStatus';
import { useReducedMotion } from '~/shared/hooks/useReducedMotion';

const balanceFontSize = 44;
const balanceLetterSpacing = getAmountLetterSpacing(balanceFontSize);

export default function Balance() {
  const theme = useTheme();
  const hiddenBalanceBackground = String(theme.gray3.val);
  const balances = useWalletStore((s) => s.balances);
  const hasBalanceSnapshot = useWalletStore((s) => s.hasBalanceSnapshot);
  const isInitializing = useWalletStore((s) => s.isInitializing);
  const isRestoring = useWalletStore((s) => s.isRestoring);
  const isRefreshing = useWalletStore((s) => s.isRefreshing);
  const refreshCounter = useWalletStore((s) => s.refreshCounter);
  const refreshError = useWalletStore((s) => s.error);
  const isOffline = useOfflineStatus();
  const reducedMotion = useReducedMotion();
  const [justUpdated, setJustUpdated] = React.useState(false);
  const lastRefresh = React.useRef(refreshCounter);
  const statusOpacity = React.useRef(new Animated.Value(1)).current;
  const shimmerOpacity = React.useRef(new Animated.Value(1)).current;
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
    hapticService.selection();
    const nextVal = current.primaryCurrency === 'SATS' ? 'FIAT' : 'SATS';
    void current.setPrimaryCurrency(nextVal);
  }, []);

  const handleHideBalanceToggle = React.useCallback(() => {
    hapticService.selection();
    const current = useSettingsStore.getState();
    void current.setHideBalance(!current.hideBalance);
  }, []);
  const { data: btcData, isFetching: isFetchingPrice } = useQuery({
    queryKey: ['bitcoinPrice', secondaryCurrency],
    queryFn: () => bitcoinService.fetchPrice(secondaryCurrency),
    staleTime: 30000,
    enabled: secondaryCurrency !== 'NONE',
  });

  const [currentBalance, hasBalance] = React.useMemo(() => {
    const amounts = Object.values(balances);
    return [
      amounts.reduce((sum, val) => sum + (val || 0), 0),
      hasBalanceSnapshot || amounts.length > 0,
    ] as const;
  }, [balances, hasBalanceSnapshot]);

  const secondaryBalance = React.useMemo(() => {
    if (!hasBalance) return null;
    if (currentBalance === 0) return 0;
    if (!btcData?.price || !Number.isFinite(btcData.price) || btcData.price <= 0) return null;
    return currencyService.convertSatsToCurrency(currentBalance, btcData.price);
  }, [currentBalance, hasBalance, btcData?.price]);

  const isFiatEnabled = secondaryCurrency !== 'NONE';
  const isUpdatingBalance = isInitializing || isRefreshing;
  const showBalanceShimmer = !hideBalance && !hasBalance && isUpdatingBalance;
  const showPriceShimmer =
    !hideBalance && isFiatEnabled && secondaryBalance === null && !!isFetchingPrice;
  const showShimmer = showBalanceShimmer || showPriceShimmer;

  React.useEffect(() => {
    shimmerOpacity.setValue(1);
    if (!showShimmer || reducedMotion) return;
    const shimmer = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerOpacity, {
          toValue: 0.45,
          duration: 650,
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(shimmerOpacity, {
          toValue: 1,
          duration: 650,
          useNativeDriver: true,
          isInteraction: false,
        }),
      ]),
    );
    shimmer.start();
    return () => shimmer.stop();
  }, [showShimmer, reducedMotion, shimmerOpacity]);

  const displayAsSats = primaryCurrency === 'SATS' || !isFiatEnabled || secondaryBalance === null;
  const fiatText =
    !isFiatEnabled || secondaryBalance === null
      ? ''
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
      {(isOffline || isRestoring || isUpdatingBalance || justUpdated) && (
        <XStack position="absolute" z={100} top={0} items="center" gap="$2" self="center">
          <Animated.View style={{ opacity: justUpdated && !isRefreshing ? statusOpacity : 1 }}>
            <Text fontSize="$2" color="$gray10" fontWeight="600" accessibilityLiveRegion="polite">
              {isOffline
                ? 'Offline'
                : isRestoring
                  ? 'Syncing...'
                  : isUpdatingBalance
                    ? isRefreshing
                      ? 'Refreshing...'
                      : 'Updating balance…'
                    : 'Updated just now'}
            </Text>
          </Animated.View>
        </XStack>
      )}

      {/* Main Balance */}
      <AppPressable
        onPress={(event) => {
          event?.stopPropagation();
          handleHideBalanceToggle();
        }}
        onLongPress={(event) => {
          event?.stopPropagation();
          handleHideBalanceToggle();
        }}
        accessibilityLabel={hideBalance ? 'Show balance' : 'Hide balance'}
        accessibilityHint="Tap or hold to toggle balance privacy"
        minHeight={48}
        pressStyle={{ opacity: 0.7 }}
        items="center"
        justify="center"
        z={1000}
      >
        {!hideBalance && !hasBalance ? (
          showBalanceShimmer ? (
            <Animated.View
              testID="home-balance-shimmer"
              accessibilityLabel="Loading balance"
              accessible
              style={{ opacity: shimmerOpacity }}
            >
              <YStack width={140} height={32} bg="$gray3" rounded="$6" />
            </Animated.View>
          ) : (
            <Text
              fontSize={balanceFontSize}
              color="$gray10"
              accessibilityLabel="Balance unavailable"
            >
              —
            </Text>
          )
        ) : (
          <RollingNumber
            animateChanges={!reducedMotion}
            value={hideBalance ? '****' : displayAsSats ? currentBalance : undefined}
            prefix={!hideBalance && displayAsSats && showBitcoinSymbol ? '₿' : ''}
            suffix={!hideBalance && displayAsSats && !showBitcoinSymbol ? ' sat' : ''}
            trigger={hideBalance ? 'hidden' : 'visible'}

            fontSize={balanceFontSize}
            fontWeight={500}
            letterSpacing={balanceLetterSpacing}
            color="$accent1"

            decimalOpacity={1}
            showDecimals={!displayAsSats}
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
            {!hideBalance && !displayAsSats ? fiatText : undefined}
          </RollingNumber>
        )}
      </AppPressable>

      {/* Secondary Balance */}
      {isFiatEnabled &&
        (hideBalance || secondaryBalance !== null ? (
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
            onPress={(event) => {
              event?.stopPropagation();
              handlePrimaryCurrencyToggle();
            }}
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
              animateChanges={!reducedMotion}
              value={
                hideBalance
                  ? '****'
                  : displayAsSats
                    ? (secondaryBalance ?? undefined)
                    : currentBalance
              }
              prefix={hideBalance ? '' : displayAsSats ? '' : showBitcoinSymbol ? '₿' : ''}
              suffix={hideBalance ? '' : displayAsSats ? '' : showBitcoinSymbol ? '' : ' sat'}
              trigger={hideBalance ? 'hidden' : 'visible'}
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
        ) : (
          <YStack mt={appSpacing.compact} minHeight={36} justify="center" items="center">
            {showPriceShimmer && (
              <Animated.View
                testID="home-price-shimmer"
                accessibilityLabel="Loading exchange rate"
                accessible
                style={{ opacity: shimmerOpacity }}
              >
                <YStack width={72} height={20} bg="$gray3" rounded={appRadii.pill} />
              </Animated.View>
            )}
          </YStack>
        ))}
    </YStack>
  );
}
