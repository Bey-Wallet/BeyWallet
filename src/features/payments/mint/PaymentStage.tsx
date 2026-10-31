import { interactionCopy } from '~/services/feedback/interactionCopy';
import { copyWithFeedback } from '~/shared/utils/copyWithFeedback';
import { PaymentQRFrame } from '~/shared/ui/PaymentQRFrame';
import { PaymentAmount } from '~/shared/ui/PaymentAmount';
import React, { useState, useEffect, useRef } from 'react';
import { usePendingPaymentPolling } from '~/shared/hooks/usePendingPaymentPolling';
import { useOfflineStatus } from '~/shared/hooks/useOfflineStatus';
import { PaymentStatusRow } from '~/shared/ui/PaymentStatusRow';
import { Text, YStack } from 'tamagui';
import { PaymentStageLayout } from '~/shared/ui/PaymentStageLayout';
import QRCode from '~/shared/ui/PaymentQRCode';
import * as Haptics from 'expo-haptics';

import { useAppToast } from '~/shared/hooks/useAppToast';
import { AppButton } from '~/shared/ui/AppButton';
import { ListTable, ListTableRow } from '~/shared/ui/ListTable';
import { useWalletStore } from '~/state/walletStore';
import { quotesService } from '~/services/wallet';
import { ReceiptImageShare } from '~/features/history/components/ReceiptImageShare';
import { buildShareableReceipt } from '~/features/history/shareableReceipt';

interface PaymentStageProps {
  appearance?: 'default' | 'pos';
  note?: string;
  amount: string;
  invoice: string;
  quoteId: string;
  mintUrl: string;
  expiry?: number;
  onPaid: () => Promise<void> | void;
  onCancel: () => void;
  listening?: boolean;
  requestDelivery?: {
    onSend: () => Promise<void>;
    onView: () => void;
    sending: boolean;
    queued: boolean;
    error: string;
  };
}

export function PaymentStage({
  appearance = 'default',
  note,
  amount,
  invoice,
  quoteId,
  mintUrl,
  expiry,
  onPaid,
  onCancel,
  listening = true,
  requestDelivery,
}: PaymentStageProps) {
  const sats = parseInt(amount, 10) || 0;
  const pos = appearance === 'pos';
  const toast = useAppToast();
  const [isChecking, setIsChecking] = useState(false);
  const checkLock = useRef(false);
  const offline = useOfflineStatus();
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const mints = useWalletStore((state) => state.mints);
  const mint = mints.find((item) => item.mintUrl.replace(/\/$/, '') === mintUrl.replace(/\/$/, ''));
  const mintDisplayName =
    mint?.nickname || mint?.name || mintUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const timeLeft = expiry == null ? null : Math.max(0, expiry - now);
  const isExpired = timeLeft === 0;
  const displayedAt = useRef(Date.now());
  const publicReceipt = buildShareableReceipt(
    {
      id: quoteId,
      type: 'mint',
      amount: sats,
      unit: 'sat',
      mintUrl,
      state: isExpired ? 'expired' : 'UNPAID',
      createdAt: displayedAt.current,
    },
    { invoice, expired: isExpired, mintName: mint?.name },
  );

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
      toast.showFeedback(interactionCopy.invoiceCopied);
    } catch {
      toast.showFeedback(interactionCopy.couldNotCopyInvoicePleaseTryAgain);
    }
  };

  const checkPayment = async (silent = false) => {
    if (checkLock.current || isExpired || offline || !listening) return;
    checkLock.current = true;
    if (!silent) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsChecking(true);
    try {
      const quote = await quotesService.checkMintQuote(mintUrl, quoteId);
      if (quote.state !== 'PAID') {
        if (!silent && quote.state !== 'ISSUED') throw new Error('Payment pending');
        return;
      }
      await onPaid();
    } catch {
      if (!silent) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        toast.showFeedback(interactionCopy.paymentNotReceivedYetTryAgainShortly);
      }
    } finally {
      setIsChecking(false);
      checkLock.current = false;
    }
  };
  usePendingPaymentPolling(() => checkPayment(true), listening && !isExpired && !offline);
  const paymentAction = (
    <AppButton
      size="large"
      fullWidth
      disabled={isChecking || requestDelivery?.sending}
      loading={requestDelivery?.sending}
      variant="default"
      emphasis={isExpired ? 'secondary' : 'primary'}
      onPress={
        requestDelivery?.queued
          ? requestDelivery.onView
          : isExpired
            ? onCancel
            : requestDelivery
              ? () => void requestDelivery.onSend()
              : handleCopy
      }
    >
      {requestDelivery?.queued
        ? 'View request'
        : isExpired
          ? 'Close invoice'
          : requestDelivery
            ? 'Send request'
            : 'Copy invoice'}
    </AppButton>
  );

  return (
    <PaymentStageLayout
      variant="qr"
      inset={false}
      hero={
        <>
          {pos && (
            <YStack items="center" gap="$2" width="100%">
              <PaymentAmount amount={sats} compact size="prominent" testID="mint-payment" />
              {!!note && (
                <Text fontSize={14} color="$color" textAlign="center">
                  {note}
                </Text>
              )}
              {!isExpired && (
                <Text fontSize={14} color="$color">
                  Scan to pay with Lightning
                </Text>
              )}
            </YStack>
          )}
          {isExpired && (
            <Text fontSize={14} fontWeight="500" color="$gray10">
              Invoice expired
            </Text>
          )}
          {!isExpired && (
            <PaymentQRFrame accessibilityLabel="Lightning invoice QR code">
              {(size) => (
                <QRCode value={invoice} size={size} backgroundColor="white" color="black" />
              )}
            </PaymentQRFrame>
          )}
          {!pos && <PaymentAmount amount={sats} compact testID="mint-payment" />}
        </>
      }
      footer={
        pos ? (
          <YStack rounded={999} overflow="hidden">
            {paymentAction}
          </YStack>
        ) : (
          paymentAction
        )
      }
    >
      {!!requestDelivery?.error && (
        <Text color="$red10" accessibilityRole="alert" fontSize={14}>
          {requestDelivery.error}
        </Text>
      )}
      <ListTable compact>
        <PaymentStatusRow
          status={isExpired ? 'cancelled' : 'pending'}
          value={isExpired ? 'Expired' : 'Awaiting payment'}
          onRefresh={() => checkPayment()}
          checking={isChecking}
          disabled={isExpired || offline}
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
      {!isExpired && !requestDelivery?.queued && (
        <AppButton
          variant="default"
          emphasis="text"
          fullWidth
          disabled={isChecking || requestDelivery?.sending}
          onPress={onCancel}
        >
          Cancel
        </AppButton>
      )}
      {publicReceipt && <ReceiptImageShare receipt={publicReceipt} disabled={isChecking} />}
    </PaymentStageLayout>
  );
}
