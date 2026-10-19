import { amountLabel } from '~/shared/ui/amountLabel';
import React, { useState, useEffect } from 'react';
import { PaymentStatusRow } from '~/shared/ui/PaymentStatusRow';
import { YStack, Text, ScrollView } from 'tamagui';
import QRCode from '~/shared/ui/PaymentQRCode';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { useToastController } from '@tamagui/toast';
import { useQuery } from '@tanstack/react-query';
import { AppButton } from '~/shared/ui/AppButton';
import { ListTable, ListTableRow } from '~/shared/ui/ListTable';
import { useSettingsStore } from '~/state/settingsStore';
import { useWalletStore } from '~/state/walletStore';
import { bitcoinService } from '~/services/api/bitcoinService';
import { currencyService, type CurrencyCode } from '~/services/wallet/currencyService';

interface PaymentStageProps {
  amount: string;
  invoice: string;
  quoteId: string;
  mintUrl: string;
  expiry?: number;
  onPaid: () => Promise<void> | void;
  onCancel: () => void;
}

export function PaymentStage({
  amount,
  invoice,
  mintUrl,
  expiry,
  onPaid,
  onCancel,
}: PaymentStageProps) {
  const sats = parseInt(amount, 10) || 0;
  const toast = useToastController();
  const [isChecking, setIsChecking] = useState(false);
  const [qrWidth, setQrWidth] = useState(0);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const { primaryCurrency, secondaryCurrency, showBitcoinSymbol } = useSettingsStore();
  const mints = useWalletStore((state) => state.mints);
  const mint = mints.find((item) => item.mintUrl.replace(/\/$/, '') === mintUrl.replace(/\/$/, ''));
  const mintDisplayName =
    mint?.nickname || mint?.name || mintUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
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
  const satsDisplay = showBitcoinSymbol ? `₿${formattedSats}` : `${formattedSats} sats`;
  const primaryAmount = primaryCurrency === 'FIAT' ? fiatValue : satsDisplay;
  const secondaryAmount = primaryCurrency === 'FIAT' ? satsDisplay : fiatValue;
  const timeLeft = expiry == null ? null : Math.max(0, expiry - now);
  const isExpired = timeLeft === 0;
  const qrSize = Math.max(0, Math.min(280, qrWidth - 40));

  useEffect(() => {
    if (expiry == null) return;
    setNow(Math.floor(Date.now() / 1000));
    const timer = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(timer);
  }, [expiry]);

  const handleCopy = async () => {
    if (isExpired) return;
    try {
      await Clipboard.setStringAsync(invoice);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.show('Invoice copied', { kind: 'success' });
    } catch {
      toast.show('Could not copy invoice. Please try again.', { kind: 'error' });
    }
  };

  const handleCheckPayment = async () => {
    if (isChecking || isExpired) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsChecking(true);
    try {
      await onPaid();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      toast.show('Payment not received yet. Try again shortly.', { kind: 'info' });
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <YStack flex={1} bg="$background">
      <ScrollView
        flex={1}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
      >
        <YStack flex={1} items="center" gap="$4" py="$4">
          <YStack gap="$2" items="center" width="100%">
            <Text fontSize={14} fontWeight="500" color="$gray10">
              {isExpired ? 'Invoice expired' : 'Pay with Lightning'}
            </Text>
          </YStack>

          {!isExpired && (
            <YStack
              width="100%"
              items="center"
              gap="$3"
              onLayout={(event) => setQrWidth(event.nativeEvent.layout.width)}
              accessibilityLabel="Lightning invoice QR code"
            >
              {qrSize > 0 && (
                <YStack bg="white" p={20} rounded="$6">
                  <QRCode value={invoice} size={qrSize} backgroundColor="white" color="black" />
                </YStack>
              )}
            </YStack>
          )}
          <YStack gap="$2" items="center" width="100%">
            <Text
              testID="mint-payment-primary-amount"
              fontSize={44}
              lineHeight={56}
              fontWeight="500"
              letterSpacing={-1.5}
              color="$color"
              textAlign="center"
              maxWidth="100%"
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {amountLabel(primaryAmount, 44)}
            </Text>
            <Text
              testID="mint-payment-secondary-amount"
              fontSize={16}
              color="$gray10"
              textAlign="center"
            >
              {amountLabel(
                secondaryAmount === '—' ? 'Conversion unavailable' : `≈ ${secondaryAmount}`,
                16,
              )}
            </Text>
          </YStack>

          <YStack width="100%" gap="$2">
            <ListTable compact>
              <ListTableRow label="Mint" value={mintDisplayName} />
              <PaymentStatusRow
                value={isExpired ? 'Expired' : 'Awaiting payment'}
                onRefresh={handleCheckPayment}
                checking={isChecking}
                disabled={isExpired}
              />
              <ListTableRow
                label="Invoice"
                value={
                  invoice.length > 24 ? `${invoice.slice(0, 12)}…${invoice.slice(-8)}` : invoice
                }
                isCopyable
                copyValue={invoice}
                onCopy={handleCopy}
                disabled={isChecking || isExpired}
              />
              <ListTableRow
                label="Expires in"
                value={
                  isExpired
                    ? 'Expired'
                    : timeLeft === null
                      ? 'Not provided'
                      : `${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, '0')}`
                }
              />
            </ListTable>
            {!isExpired && (
              <AppButton
                variant="default"
                emphasis="text-only"
                fullWidth
                disabled={isChecking}
                onPress={onCancel}
              >
                Cancel
              </AppButton>
            )}
          </YStack>
        </YStack>
      </ScrollView>

      <YStack gap="$2" pt="$3" pb="$4" bg="$background">
        <AppButton
          size="large"
          fullWidth
          disabled={isChecking}
          variant={isExpired ? 'default' : 'branded'}
          emphasis={isExpired ? 'secondary' : 'primary'}
          onPress={isExpired ? onCancel : handleCopy}
        >
          {isExpired ? 'Close invoice' : 'Copy invoice'}
        </AppButton>
      </YStack>
    </YStack>
  );
}
