import { interactionCopy } from '~/services/feedback/interactionCopy';
import { copyWithFeedback } from '~/shared/utils/copyWithFeedback';
import { PaymentQRFrame } from '~/shared/ui/PaymentQRFrame';
import { PaymentAmount } from '~/shared/ui/PaymentAmount';
import React, { useState, useEffect } from 'react';
import { PaymentStatusRow } from '~/shared/ui/PaymentStatusRow';
import { Text } from 'tamagui';
import { PaymentStageLayout } from '~/shared/ui/PaymentStageLayout';
import QRCode from '~/shared/ui/PaymentQRCode';
import * as Haptics from 'expo-haptics';

import { useToastController } from '@tamagui/toast';
import { AppButton } from '~/shared/ui/AppButton';
import { ListTable, ListTableRow } from '~/shared/ui/ListTable';
import { useWalletStore } from '~/state/walletStore';

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
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const mints = useWalletStore((state) => state.mints);
  const mint = mints.find((item) => item.mintUrl.replace(/\/$/, '') === mintUrl.replace(/\/$/, ''));
  const mintDisplayName =
    mint?.nickname || mint?.name || mintUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const timeLeft = expiry == null ? null : Math.max(0, expiry - now);
  const isExpired = timeLeft === 0;

  useEffect(() => {
    if (expiry == null) return;
    setNow(Math.floor(Date.now() / 1000));
    const timer = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(timer);
  }, [expiry]);

  const handleCopy = async () => {
    if (isExpired) return;
    try {
      if (!(await copyWithFeedback(invoice, toast))) return;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.show(interactionCopy.invoiceCopied.title, {
        kind: interactionCopy.invoiceCopied.severity,
      });
    } catch {
      toast.show(interactionCopy.couldNotCopyInvoicePleaseTryAgain.title, {
        kind: interactionCopy.couldNotCopyInvoicePleaseTryAgain.severity,
      });
    }
  };

  const handleCheckPayment = async () => {
    if (isChecking || isExpired) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsChecking(true);
    try {
      await onPaid();
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      toast.show(interactionCopy.paymentNotReceivedYetTryAgainShortly.title, {
        kind: interactionCopy.paymentNotReceivedYetTryAgainShortly.severity,
      });
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <PaymentStageLayout
      variant="qr"
      inset={false}
      hero={
        <>
          <Text fontSize={14} fontWeight="500" color="$gray10">
            {isExpired ? 'Invoice expired' : 'Pay with Lightning'}
          </Text>
          {!isExpired && (
            <PaymentQRFrame accessibilityLabel="Lightning invoice QR code">
              {(size) => (
                <QRCode value={invoice} size={size} backgroundColor="white" color="black" />
              )}
            </PaymentQRFrame>
          )}
          <PaymentAmount amount={sats} compact testID="mint-payment" />
        </>
      }
      footer={
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
      }
    >
      <ListTable compact>
        <PaymentStatusRow
          status={isExpired ? 'cancelled' : 'pending'}
          value={isExpired ? 'Expired' : 'Awaiting payment'}
          onRefresh={handleCheckPayment}
          checking={isChecking}
          disabled={isExpired}
        />
        <ListTableRow label="Mint" value={mintDisplayName} />
        <ListTableRow
          label="Invoice"
          value={invoice.length > 24 ? `${invoice.slice(0, 12)}…${invoice.slice(-8)}` : invoice}
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
    </PaymentStageLayout>
  );
}
