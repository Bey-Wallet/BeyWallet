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
  const activeMintUrl = useWalletStore((s) => s.activeMintUrl);
  const refreshCounter = useWalletStore((s) => s.refreshCounter);
  const mints = useWalletStore((s) => s.mints);
  const balances = useWalletStore((s) => s.balances);
  const isRestoring = useWalletStore((s) => s.isRestoring);
  const { primaryCurrency, setPrimaryCurrency, secondaryCurrency, hideBalance, setHideBalance } = useSettingsStore();
  const [showAllMints, setShowAllMints] = React.useState(false);
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

  // Normalize URLs for comparison
  const normalizeUrl = (url: string) => url.replace(/\/$/, "");

  const activeMint = mints.find(
    (m) =>
      activeMintUrl && normalizeUrl(m.mintUrl) === normalizeUrl(activeMintUrl),
  );

  // Determine display values based on toggle state
  const currentBalance = showAllMints
    ? Object.values(balances).reduce((acc, val) => acc + val, 0)
    : balance;

  const displayName = showAllMints
    ? "All Mints"
    : activeMint?.nickname ||
    activeMint?.name ||
    activeMintUrl?.replace(/^https?:\/\//, "").replace(/\/$/, "") ||
    "No Mint Selected";

  const secondaryBalance = React.useMemo(() => {
    if (!btcData?.price) return 0;
    return currencyService.convertSatsToCurrency(currentBalance, btcData.price);
  }, [currentBalance, btcData?.price]);

  return (
    <YStack py="$2" height={220} gap="$3" justify="center" items="center">
      <XStack width="100%" items="center" justify="center">
        <XStack items="center">
          <Paragraph
            color="$accent9"
            px="$2"
            py="$0.5"
            rounded="$2"
            bg="$gray5"
            fontSize="$2"
            fontWeight="600"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowAllMints((prev) => !prev);
            }}
            pressStyle={{ opacity: 0.7 }}
            suppressHighlighting
          >
            {displayName}
          </Paragraph>
          {isRestoring && (
            <XStack ml="$2" items="center" gap="$2">
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
        </XStack>
      </XStack>

      <XStack justify="center" py="$2" items="flex-end">
        <YStack
          onPress={handlePrimaryCurrencyToggle}
          onLongPress={handleHideBalanceToggle}
          delayLongPress={300}
          pressStyle={{ opacity: 0.7 }}
        >
          {primaryCurrency === 'SATS' ? (
            <RollingNumber
              value={hideBalance ? "****" : currentBalance}
              prefix={hideBalance ? "" : "₿"}
              trigger={refreshCounter + localTrigger + (hideBalance ? "_hidden" : "_visible_sats")}
              letterSpacing={-1}
              fontSize={36}
              fontWeight="900"
              color="$accent3"
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
              fontWeight="900"
              color="$accent3"
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
      </XStack>

      <RollingNumber
        value={hideBalance ? "****" : (primaryCurrency === 'SATS' ? secondaryBalance : currentBalance)}
        prefix={hideBalance ? "" : (primaryCurrency === 'SATS' ? "" : "₿")}
        trigger={refreshCounter + (hideBalance ? "_hidden" : (primaryCurrency === 'SATS' ? "_visible_fiat_sub" : "_visible_sats_sub"))}
        letterSpacing={-1}
        fontSize={20}
        fontWeight="900"
        color="$accent7"
        decimalOpacity={0.4}
        showDecimals={primaryCurrency === 'SATS'}
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
