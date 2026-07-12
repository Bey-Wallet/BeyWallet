import React from "react";
import { H1, H2, Paragraph, Text, View, XStack, YStack } from "tamagui";
import { useWalletStore } from "../../../store/walletStore";
import { RollingNumber } from "../../../components/UI/RollingNumber";
import { useSettingsStore } from "../../../store/settingsStore";
import {
  currencyService,
  CurrencyCode,
} from "../../../services/currencyService";
import { useQuery } from "@tanstack/react-query";
import { bitcoinService } from "../../../services/bitcoinService";
import * as Haptics from "expo-haptics";

export default function Balance() {
  const balance = useWalletStore((s) => s.balance);
  const refreshCounter = useWalletStore((s) => s.refreshCounter);
  const isRestoring = useWalletStore((s) => s.isRestoring);
  const { primaryCurrency, setPrimaryCurrency, secondaryCurrency, hideBalance, setHideBalance, showBitcoinSymbol } = useSettingsStore();
  const [localTrigger, setLocalTrigger] = React.useState(0);

  const handlePrimaryCurrencyToggle = React.useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const nextVal = primaryCurrency === 'SATS' ? 'FIAT' : 'SATS';
    setPrimaryCurrency(nextVal);
  }, [primaryCurrency, setPrimaryCurrency]);

  const handleHideBalanceToggle = React.useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setHideBalance(!hideBalance);
  }, [hideBalance, setHideBalance]);
  const { data: btcData } = useQuery({
    queryKey: ["bitcoinPrice", secondaryCurrency],
    queryFn: () => bitcoinService.fetchPrice(secondaryCurrency),
    staleTime: 30000,
  });

  const currentBalance = balance;

  const secondaryBalance = React.useMemo(() => {
    if (!btcData?.price) return 0;
    return currencyService.convertSatsToCurrency(currentBalance, btcData.price);
  }, [currentBalance, btcData?.price]);

  return (
    <YStack py="$2" gap="$3" height={230} justify="center" items="center" position="relative">
      
      {/* Syncing Indicator at the top (absolute) */}
      {isRestoring && (
        <XStack position="absolute" top={15} items="center" gap="$2" self="center">
          <View
            width={8}
            height={8}
            rounded="$10"
            bg="$accent10"
            animation="lazy"
            opacity={0.8}
          />
          <Text fontSize="$2" color="$gray10" fontWeight="600">
            Syncing...
          </Text>
        </XStack>
      )}

      {/* Main Balance */}
      <YStack
        onPress={handlePrimaryCurrencyToggle}
        onLongPress={handleHideBalanceToggle}
        delayLongPress={200}
        pressStyle={{ opacity: 0.7 }}
        items="center"
        justify="center"
      >
        {primaryCurrency === 'SATS' ? (
          <RollingNumber
            value={hideBalance ? "****" : currentBalance}
            prefix={hideBalance ? "" : (showBitcoinSymbol ? "₿" : "")}
            suffix={hideBalance ? "" : (showBitcoinSymbol ? "" : " SATS")}
            trigger={refreshCounter + localTrigger + (hideBalance ? "_hidden" : "_visible_sats") + `_${showBitcoinSymbol}`}
            letterSpacing={-1}
            fontSize={36}
            fontWeight="800"
            color="$accent3"
            fontFamily="$oswald"
            decimalOpacity={0.4}
            showDecimals={false}
            style={hideBalance ? {
              backgroundColor: 'rgba(150, 150, 150, 0.15)',
              borderRadius: 120,
              paddingHorizontal: 16,
              paddingTop: 10,
              alignItems: 'center',
              justifyContent: 'center',
              alignSelf: 'center',
            } : undefined}
          />
        ) : (
          <RollingNumber
            value={hideBalance ? "****" : secondaryBalance}
            trigger={refreshCounter + localTrigger + (hideBalance ? "_hidden" : "_visible_fiat")}
            letterSpacing={-1}
            fontSize={36}
            fontWeight="800"
            color="$accent3"
            fontFamily="$oswald"
            decimalOpacity={0.4}
            showDecimals={true}
            style={hideBalance ? {
              backgroundColor: 'rgba(150, 150, 150, 0.15)',
              borderRadius: 120,
              paddingHorizontal: 16,
              paddingTop: 10,
              alignItems: 'center',
              justifyContent: 'center',
              alignSelf: 'center',
            } : undefined}
          >
            {hideBalance
              ? undefined
              : currencyService.formatValue(
                secondaryBalance,
                secondaryCurrency as CurrencyCode,
              )}
          </RollingNumber>
        )}
      </YStack>

      {/* Secondary Balance */}
      <RollingNumber
        value={hideBalance ? "****" : (primaryCurrency === 'SATS' ? secondaryBalance : currentBalance)}
        prefix={hideBalance ? "" : (primaryCurrency === 'SATS' ? "" : (showBitcoinSymbol ? "₿" : ""))}
        suffix={hideBalance ? "" : (primaryCurrency === 'SATS' ? "" : (showBitcoinSymbol ? "" : " SATS"))}
        trigger={refreshCounter + (hideBalance ? "_hidden" : (primaryCurrency === 'SATS' ? "_visible_fiat_sub" : "_visible_sats_sub")) + `_${showBitcoinSymbol}`}
        letterSpacing={-1}
        fontSize={20}
        fontWeight="800"
        color="$accent7"
        fontFamily="$oswald"
        decimalOpacity={0.4}
        showDecimals={primaryCurrency === 'SATS'}
        mt="$1"
      >
        {!hideBalance && primaryCurrency === 'SATS'
          ? currencyService.formatValue(
            secondaryBalance,
            secondaryCurrency as CurrencyCode,
          )
          : undefined}
      </RollingNumber>
    </YStack>
  );
}
