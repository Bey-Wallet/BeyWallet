import React from 'react';
import { Text } from 'tamagui';
import { PaymentStageLayout } from '~/shared/ui/PaymentStageLayout';
import { PaymentFlowHeader } from '~/shared/ui/PaymentFlowHeader';
import { PaymentQRFrame } from '~/shared/ui/PaymentQRFrame';
import QRCode from '~/shared/ui/PaymentQRCode';
import { PaymentAmount } from '~/shared/ui/PaymentAmount';
import { PaymentStatusIcon } from '~/shared/ui/PaymentStatusIcon';
import { PaymentStatusRow } from '~/shared/ui/PaymentStatusRow';
import { ListTable, ListTableRow } from '~/shared/ui/ListTable';
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
  headerRight,
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
  headerRight?: () => React.ReactNode;
  inset?: boolean;
  extraDetails?: React.ReactNode;
  transactionDetails?: React.ReactNode;
  navigationAction?: 'back' | 'close';
  offline?: boolean;
}) {
  const deposit = direction === 'deposit';
  const destination = normalizeBitcoinAddress(address);
  return (
    <>
      <PaymentFlowHeader
        navigationAction={navigationAction}
        title={deposit ? 'On-chain deposit' : 'On-chain payment'}
        onBack={onClose}
        headerRight={headerRight}
      />
      <PaymentStageLayout
        variant={deposit ? 'qr' : 'receipt'}
        inset={inset}
        hero={
          <>
            {!deposit && <PaymentStatusIcon status="pending" />}
            <Text fontSize={14} fontWeight="500" color="$gray10">
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
            onPress={onClose}
          >
            Done
          </AppButton>
        }
      >
        <Text fontFamily="$body" fontSize={12} color="$gray10">
          {deposit
            ? amount > 0
              ? 'Funds become available after the mint confirms the Bitcoin deposit.'
              : 'Send Bitcoin to this address, then check status for confirmation.'
            : 'The final outcome is not confirmed. Check status before sending another payment.'}
        </Text>
        <ListTable compact>
          <PaymentStatusRow
            status="pending"
            value={deposit ? (amount > 0 ? 'Payment detected' : 'Awaiting payment') : 'Pending'}
            checking={checking}
            onRefresh={onRefresh}
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
            isCopyable={!!destination}
            copyValue={destination}
          />
          {transactionDetails}
        </ListTable>
        <AppButton
          fullWidth
          emphasis="secondary"
          onPress={onRefresh}
          loading={checking}
          disabled={offline || checking}
        >
          {offline ? 'Check status when online' : 'Check status'}
        </AppButton>
        {extraDetails}
      </PaymentStageLayout>
    </>
  );
}
