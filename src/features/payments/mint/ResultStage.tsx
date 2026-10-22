import { amountLabel } from '~/shared/ui/amountLabel';
import { appTypography } from '~/shared/theme/appearance';
import { PaymentStatusIcon } from '~/shared/ui/PaymentStatusIcon';
import { PaymentFlowHeader } from '~/shared/ui/PaymentFlowHeader';
import React, { useEffect, useMemo, useState } from 'react';
import { YStack, Text, ScrollView } from 'tamagui';

import * as Haptics from 'expo-haptics';
import { AppButton } from '~/shared/ui/AppButton';
import { ListTable, ListTableRow } from '~/shared/ui/ListTable';
import { currencyService, type CurrencyCode } from '~/services/wallet/currencyService';
import { useSettingsStore } from '~/state/settingsStore';
import { useWalletStore } from '~/state/walletStore';
import { useQuery } from '@tanstack/react-query';
import { bitcoinService } from '~/services/api/bitcoinService';

interface ResultStageProps {
  status: 'success' | 'error' | 'cancelled';
  amount: string;
  mintUrl?: string;
  /** Confirmed fee in sats, when available; never an estimate or keyset fee. */
  feeSats?: number;
  error?: string | null;
  onClose: () => void;
}

export function ResultStage({
  status,
  amount,
  mintUrl,
  feeSats,
  error,
  onClose,
}: ResultStageProps) {
  const isSuccess = status === 'success';
  const sats = parseInt(amount, 10) || 0;
  const [showDetails, setShowDetails] = useState(false);
  const [resultTime] = useState(() =>
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  );
  const hasFee = typeof feeSats === 'number' && Number.isFinite(feeSats) && feeSats > 0;
  const { mints } = useWalletStore();
  const { primaryCurrency, secondaryCurrency, showBitcoinSymbol } = useSettingsStore();
  const { data: btcData } = useQuery({
    queryKey: ['bitcoinPrice', secondaryCurrency],
    queryFn: () => bitcoinService.fetchPrice(secondaryCurrency),
    staleTime: 30000,
  });
  const fiatValue = btcData?.price
    ? currencyService.formatValue(
        currencyService.convertSatsToCurrency(sats, btcData.price),
        secondaryCurrency as CurrencyCode,
      )
    : '—';
  const formattedSats = sats.toLocaleString('en-US');
  const satsDisplay = showBitcoinSymbol ? `₿${formattedSats}` : `${formattedSats} sat`;
  const primaryAmount = primaryCurrency === 'FIAT' ? fiatValue : satsDisplay;
  const secondaryAmount = primaryCurrency === 'FIAT' ? satsDisplay : fiatValue;

  const mintDisplayName = useMemo(() => {
    if (!mintUrl) return 'Selected mint';
    const normalizeUrl = (url: string) => url.replace(/\/$/, '');
    const mint = mints.find((item) => normalizeUrl(item.mintUrl) === normalizeUrl(mintUrl));
    return mint?.nickname || mint?.name || mintUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  }, [mints, mintUrl]);

  useEffect(() => {
    if (isSuccess) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (status === 'error') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, [status, isSuccess]);

  const title = isSuccess
    ? 'Funds added'
    : status === 'cancelled'
      ? 'Top-up cancelled'
      : 'Top-up not completed';

  return (
    <YStack flex={1} bg="$background">
      <PaymentFlowHeader title={title} onBack={onClose} />
      <ScrollView
        flex={1}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
      >
        <YStack flex={1} gap="$6">
          <YStack flex={1} minHeight={280} gap="$3" py="$7" items="center" justify="center">
            <PaymentStatusIcon
              status={
                status === 'success' ? 'success' : status === 'cancelled' ? 'cancelled' : 'error'
              }
            />
            <Text
              accessibilityRole="header"
              fontSize={16}
              fontWeight="500"
              color="$color"
              textAlign="center"
            >
              {title}
            </Text>
            <Text
              testID="mint-result-primary-amount"
              {...appTypography.amount}
              color="$color"
              textAlign="center"
              maxWidth="100%"
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {amountLabel(primaryAmount, appTypography.amount.fontSize)}
            </Text>
            <Text
              testID="mint-result-secondary-amount"
              {...appTypography.body2}
              color="$gray10"
              textAlign="center"
            >
              {amountLabel(
                secondaryAmount === '—' ? 'Conversion unavailable' : `≈ ${secondaryAmount}`,
                appTypography.body2.fontSize,
              )}
            </Text>
            {/* <Text fontSize={14} lineHeight={21} color="$gray10" textAlign="center" px="$4">
              {isSuccess
                ? 'Ready to spend from your wallet.'
                : status === 'cancelled'
                  ? 'You can start a new top-up whenever you’re ready.'
                  : 'Check your wallet activity before starting another top-up.'}
            </Text> */}
            {status === 'error' && !!error && (
              <YStack gap="$2" width="100%" items="center">
                <AppButton
                  variant="default"
                  emphasis="text-only"
                  size="small"
                  accessibilityState={{ expanded: showDetails }}
                  onPress={() => setShowDetails((value) => !value)}
                >
                  {showDetails ? 'Hide details' : 'View details'}
                </AppButton>
                {showDetails && (
                  <Text fontSize={13} lineHeight={20} color="$gray10" textAlign="center" selectable>
                    {error}
                  </Text>
                )}
              </YStack>
            )}
          </YStack>
          {isSuccess && (
            <ListTable compact>
              {mintUrl && <ListTableRow label="Mint" value={mintDisplayName} />}
              <ListTableRow label="Time" value={resultTime} />
              {hasFee && <ListTableRow label="Fee" value={currencyService.formatSats(feeSats)} />}
            </ListTable>
          )}
        </YStack>
      </ScrollView>

      <YStack pt="$3" pb="$4" bg="$background">
        <AppButton
          variant="default"
          emphasis="secondary"
          size="large"
          fullWidth
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onClose();
          }}
        >
          Done
        </AppButton>
      </YStack>
    </YStack>
  );
}
