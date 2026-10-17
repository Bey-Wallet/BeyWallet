import { AppButton } from '~/shared/ui/AppButton';
import { ListTable, ListTableRow } from '~/shared/ui/ListTable';
import React, { useMemo } from 'react';
import { YStack, Text, ScrollView } from 'tamagui';

import { useWalletStore } from '~/state/walletStore';
import { useSettingsStore } from '~/state/settingsStore';
import { useQuery } from '@tanstack/react-query';
import { bitcoinService } from '~/services/api/bitcoinService';
import { currencyService, type CurrencyCode } from '~/services/wallet/currencyService';
import * as Haptics from 'expo-haptics';

interface ConfirmStageProps {
  amount: string;
  mintUrl: string;
  isLoading?: boolean;
  onConfirm: () => void;
  onBack: () => void;
}

export function ConfirmStage({ amount, mintUrl, isLoading, onConfirm }: ConfirmStageProps) {
  const sats = parseInt(amount, 10) || 0;
  const { mints } = useWalletStore();
  const { primaryCurrency, secondaryCurrency, showBitcoinSymbol } = useSettingsStore();

  const { data: btcData } = useQuery({
    queryKey: ['bitcoinPrice', secondaryCurrency],
    queryFn: () => bitcoinService.fetchPrice(secondaryCurrency),
    staleTime: 30000,
  });

  const fiatValue = useMemo(() => {
    if (!btcData?.price) return '—';
    const fiat = currencyService.convertSatsToCurrency(sats, btcData.price);
    return currencyService.formatValue(fiat, secondaryCurrency as CurrencyCode);
  }, [sats, btcData?.price, secondaryCurrency]);

  const normalizeUrl = (url: string) => url.replace(/\/$/, '');

  const activeMint = useMemo(() => {
    if (!mintUrl) return null;
    return mints.find((m) => normalizeUrl(m.mintUrl) === normalizeUrl(mintUrl));
  }, [mints, mintUrl]);

  const mintDisplayName = useMemo(() => {
    if (!mintUrl) return 'Selected Mint';
    if (activeMint?.nickname) return activeMint.nickname;
    if (activeMint?.name) return activeMint.name;
    return mintUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  }, [activeMint, mintUrl]);

  const formattedSatsString = useMemo(() => {
    return sats.toLocaleString('en-US');
  }, [sats]);

  const satsDisplay = showBitcoinSymbol ? `₿${formattedSatsString}` : `${formattedSatsString} SATS`;
  const primaryAmount = primaryCurrency === 'FIAT' ? fiatValue : satsDisplay;
  const secondaryAmount = primaryCurrency === 'FIAT' ? satsDisplay : fiatValue;

  return (
    <YStack flex={1} bg="$background">
      <ScrollView
        flex={1}
        pointerEvents={isLoading ? 'none' : 'auto'}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <YStack flex={1} gap="$6">
          <YStack flex={1} minHeight={240} gap="$3" py="$7" items="center" justify="center">
            <Text fontSize={14} fontWeight="500" color="$gray10">
              You're adding
            </Text>
            <Text
              testID="mint-confirm-primary-amount"
              fontSize={44}
              fontWeight="500"
              color="$color"
              lineHeight={64}
              letterSpacing={-1.5}
              textAlign="center"
              maxWidth="100%"
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {primaryAmount}
            </Text>
            <Text
              testID="mint-confirm-secondary-amount"
              color="$gray10"
              fontWeight="400"
              fontSize={16}
              textAlign="center"
            >
              {secondaryAmount === '—' ? 'Conversion unavailable' : `≈ ${secondaryAmount}`}
            </Text>
          </YStack>

          <ListTable>
            <ListTableRow label="Mint" value={mintDisplayName} />
            <ListTableRow label="Method" value="Lightning" />
            <ListTableRow label="Lightning fee" value="Set by paying wallet" />
          </ListTable>
        </YStack>
      </ScrollView>

      <YStack gap="$3" pt="$3" pb="$4" bg="$background">
        <AppButton
          variant="branded"
          emphasis="primary"
          size="large"
          loading={isLoading}
          loadingText="Creating Lightning invoice…"
          fullWidth
          disabled={isLoading}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onConfirm();
          }}
        >
          Create invoice
        </AppButton>
      </YStack>
    </YStack>
  );
}
