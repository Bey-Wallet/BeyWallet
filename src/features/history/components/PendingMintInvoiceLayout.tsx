import { interactionCopy } from '~/services/feedback/interactionCopy';
import { copyWithFeedback } from '~/shared/utils/copyWithFeedback';
import { PaymentStageLayout } from '~/shared/ui/PaymentStageLayout';
import { PaymentStatusRow } from '~/shared/ui/PaymentStatusRow';
import { PaymentQRFrame } from '~/shared/ui/PaymentQRFrame';
import { PaymentFlowHeader } from '~/shared/ui/PaymentFlowHeader';
import { PaymentAmount } from '~/shared/ui/PaymentAmount';
import { AppButton } from '~/shared/ui/AppButton';
import React, { useState, useRef } from 'react';
import { Text, YStack, useThemeName } from 'tamagui';
import { Share as RNShare } from 'react-native';
import { PaymentActionsMenu, type PaymentMenuAction } from '~/shared/ui/PaymentActionsMenu';
import { BUISheet, type BUISheetRef } from '~/shared/ui/BUI/BUISheet';
import QRCode from '~/shared/ui/PaymentQRCode';
import * as Haptics from 'expo-haptics';

import { useAppToast } from '~/shared/hooks/useAppToast';

import { BUIList as ListTable, BUIListItem as ListTableRow } from '~/shared/ui/BUI/BUIList';

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
  offline?: boolean;
  menuActions?: PaymentMenuAction[];
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
  offline = false,
  menuActions = [],
}: PendingMintInvoiceLayoutProps) {
  const toast = useAppToast();
  const detailsSheet = useRef<BUISheetRef>(null);
  const appearance = useThemeName().startsWith('light') ? 'light' : 'dark';
  const [copied, setCopied] = useState(false);
  const paid = entry.state?.trim().toLowerCase() === 'paid';

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
      <PaymentFlowHeader
        title="Pending top-up"
        disabled={isCheckingPaid}
        headerRight={() => (
          <PaymentActionsMenu
            busy={isCheckingPaid}
            actions={[
              {
                id: 'share',
                title: 'Share invoice',
                disabled: paid || timeLeft === 0,
                onPress: () => {
                  void RNShare.share({ message: savedInvoice }).catch(() =>
                    toast.showFeedback(interactionCopy.shareFailed),
                  );
                },
              },
              {
                id: 'refresh',
                title: paid ? 'Collect ecash' : 'Refresh status',
                disabled: offline,
                onPress: () => {
                  void onPaid();
                },
              },
              ...(!paid
                ? [
                    {
                      id: 'cancel',
                      title: 'Cancel invoice',
                      onPress: () => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        void onCancel();
                      },
                    },
                  ]
                : []),
              ...(extraDetails
                ? [
                    {
                      id: 'details',
                      title: 'Payment details',
                      onPress: () => detailsSheet.current?.present(),
                    },
                  ]
                : []),
              ...menuActions,
            ]}
          />
        )}
      />
      <PaymentStageLayout
        variant="qr"
        footer={
          <AppButton
            fullWidth
            size="large"
            emphasis="secondary"
            onPress={handleCopy}
            disabled={!savedInvoice}
          >
            {copied ? 'Copied' : 'Copy'}
          </AppButton>
        }
        hero={
          <>
            {(paid || timeLeft === 0) && (
              <Text fontSize={13} fontWeight="500" color="$gray10">
                {paid ? 'Payment received' : 'Invoice expired'}
              </Text>
            )}
            {!paid && timeLeft !== 0 && (
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
        <ListTable compact variant="filled">
          <PaymentStatusRow
            status={!paid && timeLeft === 0 ? 'cancelled' : 'pending'}
            value={paid ? 'Awaiting ecash' : timeLeft === 0 ? 'Expired' : 'Awaiting payment'}
            checking={isCheckingPaid}
            disabled={offline}
          />
          <ListTableRow
            label="Mint"
            value={entry.mintUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}
          />
          <ListTableRow
            label="Invoice"
            value={savedInvoice.slice(0, 12) + '…' + savedInvoice.slice(-8)}
          />
          {!paid && <ListTableRow label="Expires in" value={formatTime(timeLeft)} />}
        </ListTable>
      </PaymentStageLayout>
      <BUISheet
        ref={detailsSheet}
        title="Payment details"
        appearance={appearance}
        canDismiss={!isCheckingPaid}
      >
        <YStack>{extraDetails}</YStack>
      </BUISheet>
    </>
  );
}
