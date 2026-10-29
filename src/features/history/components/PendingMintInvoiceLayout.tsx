import { interactionCopy } from '~/services/feedback/interactionCopy';
import { copyWithFeedback } from '~/shared/utils/copyWithFeedback';
import { PaymentStageLayout } from '~/shared/ui/PaymentStageLayout';
import { PaymentStatusRow } from '~/shared/ui/PaymentStatusRow';
import { PaymentQRFrame } from '~/shared/ui/PaymentQRFrame';
import { PaymentFlowHeader } from '~/shared/ui/PaymentFlowHeader';
import { PaymentAmount } from '~/shared/ui/PaymentAmount';
import { AppButton } from '~/shared/ui/AppButton';
import React, { useState } from 'react';
import { Text } from 'tamagui';
import QRCode from '~/shared/ui/PaymentQRCode';
import * as Haptics from 'expo-haptics';

import { useAppToast } from '~/shared/hooks/useAppToast';

import { ListTable, ListTableRow } from '~/shared/ui/ListTable';

interface PendingMintInvoiceLayoutProps {
  savedInvoice: string;
  timeLeft: number | null;
  entry: {
    id: string;
    amount: number;
    unit: string;
    mintUrl: string;
    createdAt: number;
    state?: string;
  };
  formattedStatus: string;
  primaryCurrency: string;
  secondaryCurrency: string;
  fiatAmount: number;
  isCheckingPaid: boolean;
  onCancel: () => Promise<void> | void;
  onPaid: () => Promise<void> | void;
  extraDetails?: React.ReactNode;
}

export function PendingMintInvoiceLayout({
  savedInvoice,
  timeLeft,
  entry,
  formattedStatus,
  primaryCurrency,
  secondaryCurrency,
  fiatAmount,
  isCheckingPaid,
  onCancel,
  onPaid,
  extraDetails,
}: PendingMintInvoiceLayoutProps) {
  const toast = useAppToast();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!(await copyWithFeedback(savedInvoice, toast))) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    toast.showFeedback(interactionCopy.invoiceCopiedToClipboard);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatTime = (seconds: number | null) => {
    if (seconds === null) return 'Checking...';
    if (seconds <= 0) return 'Expired';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <>
      <PaymentFlowHeader title="Pending top-up" />
      <PaymentStageLayout
        variant="qr"
        hero={
          <>
            <Text fontSize={14} fontWeight="500" color="$gray10">
              {timeLeft === 0 ? 'Invoice expired' : 'Pay with Lightning'}
            </Text>
            {timeLeft !== 0 && (
              <PaymentQRFrame accessibilityLabel="Lightning invoice QR code">
                {(size) => (
                  <QRCode value={savedInvoice} size={size} backgroundColor="white" color="black" />
                )}
              </PaymentQRFrame>
            )}
            <PaymentAmount amount={entry.amount} compact />
          </>
        }
      >
        <ListTable compact>
          <PaymentStatusRow
            status={timeLeft === 0 ? 'cancelled' : 'pending'}
            value={timeLeft === 0 ? 'Expired' : 'Awaiting payment'}
            checking={isCheckingPaid}
            onRefresh={onPaid}
          />
          <ListTableRow
            label="Mint"
            value={entry.mintUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}
          />
          <ListTableRow
            label="Invoice"
            value={savedInvoice.slice(0, 12) + '…' + savedInvoice.slice(-8)}
            isCopyable
            copyValue={savedInvoice}
            onCopy={handleCopy}
          />
          <ListTableRow label="Expires in" value={formatTime(timeLeft)} />
        </ListTable>
        {extraDetails}
        <AppButton
          emphasis="text"
          disabled={isCheckingPaid}
          onPress={async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            await onCancel();
          }}
        >
          Cancel
        </AppButton>
      </PaymentStageLayout>
    </>
  );
}
