import React, { useRef, useState } from 'react';
import { ReceiptImageShare, type ReceiptImageShareAction } from './ReceiptImageShare';
import { buildShareableReceipt } from '../shareableReceipt';
import { Text, YStack, useThemeName } from 'tamagui';
import { Share as RNShare } from 'react-native';
import { PaymentActionsMenu, type PaymentMenuAction } from '~/shared/ui/PaymentActionsMenu';
import { BUISheet, type BUISheetRef } from '~/shared/ui/BUI/BUISheet';
import { copyWithFeedback } from '~/shared/utils/copyWithFeedback';
import { useAppToast } from '~/shared/hooks/useAppToast';
import { interactionCopy } from '~/services/feedback/interactionCopy';
import { PaymentStageLayout } from '~/shared/ui/PaymentStageLayout';
import { PaymentFlowHeader } from '~/shared/ui/PaymentFlowHeader';
import { PaymentQRFrame } from '~/shared/ui/PaymentQRFrame';
import QRCode from '~/shared/ui/PaymentQRCode';
import { PaymentAmount } from '~/shared/ui/PaymentAmount';
import { PaymentStatusIcon } from '~/shared/ui/PaymentStatusIcon';
import { PaymentStatusRow } from '~/shared/ui/PaymentStatusRow';
import { BUIList as ListTable, BUIListItem as ListTableRow } from '~/shared/ui/BUI/BUIList';
import { AppButton } from '~/shared/ui/AppButton';
import {
  onchainNetwork,
  onchainNetworkDisplay,
  normalizeBitcoinAddress,
} from '~/shared/utils/onchain';

export function PendingOnchainLayout({
  direction,
  amount,
  address,
  mint,
  onRefresh,
  checking,
  onClose,
  menuActions = [],
  inset = true,
  extraDetails,
  transactionDetails,
  navigationAction = 'back',
  offline = false,
}: {
  direction: 'deposit' | 'withdrawal';
  amount: number;
  address: string;
  mint: string;
  onRefresh: () => void | Promise<void>;
  checking?: boolean;
  onClose: () => void;
  menuActions?: PaymentMenuAction[];
  inset?: boolean;
  extraDetails?: React.ReactNode;
  transactionDetails?: React.ReactNode;
  navigationAction?: 'back' | 'close';
  offline?: boolean;
}) {
  const deposit = direction === 'deposit';
  const toast = useAppToast();
  const [copied, setCopied] = useState(false);
  const receiptAction = useRef<ReceiptImageShareAction>(null);
  const detailsSheet = useRef<BUISheetRef>(null);
  const appearance = useThemeName().startsWith('light') ? 'light' : 'dark';
  const destination = normalizeBitcoinAddress(address);
  const displayedAt = useRef(Date.now());
  const receipt = buildShareableReceipt(
    {
      id: 'pending-onchain',
      type: deposit ? 'mint' : 'melt',
      amount,
      unit: 'sat',
      mintUrl: '',
      createdAt: displayedAt.current,
      state: 'pending',
      metadata: { via: 'onchain' },
    },
    { mintName: mint },
  );
  return (
    <>
      <PaymentFlowHeader
        navigationAction={navigationAction}
        title={deposit ? 'On-chain deposit' : 'On-chain payment'}
        onBack={onClose}
        disabled={checking}
        headerRight={() => (
          <PaymentActionsMenu
            busy={checking}
            actions={[
              {
                id: 'refresh',
                title: 'Refresh status',
                disabled: offline,
                onPress: () => {
                  void onRefresh();
                },
              },
              {
                id: 'share',
                title: 'Share address',
                disabled: !destination,
                onPress: () => {
                  void RNShare.share({ message: destination }).catch(() =>
                    toast.showFeedback(interactionCopy.shareFailed),
                  );
                },
              },
              ...(!menuActions.some((action) => action.id === 'receipt-image') && receipt
                ? [
                    {
                      id: 'receipt-image',
                      title: 'Share receipt image',
                      onPress: () => receiptAction.current?.open(),
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
              { id: 'close', title: 'Close', onPress: onClose },
              ...menuActions,
            ]}
          />
        )}
      />
      <PaymentStageLayout
        variant={deposit ? 'qr' : 'receipt'}
        inset={inset}
        hero={
          <>
            {!deposit && <PaymentStatusIcon status="pending" />}
            <Text fontSize={13} fontWeight="500" color="$gray10">
              {deposit ? 'Pay with Bitcoin' : 'Payment pending'}
            </Text>
            {deposit && !!address && (
              <PaymentQRFrame accessibilityLabel="Bitcoin deposit QR code">
                {(size) => (
                  <QRCode value={address} size={size} backgroundColor="white" color="black" />
                )}
              </PaymentQRFrame>
            )}
            {(!deposit || amount > 0) && <PaymentAmount amount={amount} compact />}
          </>
        }
        footer={
          <AppButton
            variant="default"
            emphasis="secondary"
            size="large"
            fullWidth
            disabled={!destination}
            onPress={async () => {
              if (await copyWithFeedback(destination, toast)) setCopied(true);
            }}
          >
            {copied ? 'Copied' : 'Copy'}
          </AppButton>
        }
      >
        <ListTable compact variant="filled">
          <PaymentStatusRow
            status="pending"
            value={deposit ? (amount > 0 ? 'Payment detected' : 'Awaiting payment') : 'Pending'}
            checking={checking}
            disabled={offline}
          />
          <ListTableRow label="Mint" value={mint} />
          <ListTableRow
            label="Network"
            value={onchainNetworkDisplay(onchainNetwork(destination))}
          />
          <ListTableRow
            label={deposit ? 'Address' : 'Destination'}
            value={
              destination ? `${destination.slice(0, 12)}…${destination.slice(-8)}` : 'Unavailable'
            }
          />
          {transactionDetails}
        </ListTable>
      </PaymentStageLayout>
      {receipt && (
        <ReceiptImageShare
          receipt={receipt}
          disabled={checking}
          hideTrigger
          actionRef={receiptAction}
        />
      )}
      <BUISheet
        ref={detailsSheet}
        title="Payment details"
        appearance={appearance}
        canDismiss={!checking}
      >
        <YStack>{extraDetails}</YStack>
      </BUISheet>
    </>
  );
}
