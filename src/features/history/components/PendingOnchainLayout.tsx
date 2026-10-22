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
  navigationAction = 'back',
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
  navigationAction?: 'back' | 'close';
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
        <ListTable compact>
          <ListTableRow label="Mint" value={mint} />
          <PaymentStatusRow
            value={deposit ? (amount > 0 ? 'Payment detected' : 'Awaiting payment') : 'Pending'}
            checking={checking}
            onRefresh={onRefresh}
          />
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
          {extraDetails}
        </ListTable>
      </PaymentStageLayout>
    </>
  );
}
