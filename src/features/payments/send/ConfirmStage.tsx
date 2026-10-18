import { PaymentStageLayout } from '~/shared/ui/PaymentStageLayout';
import { PaymentFlowHeader } from '~/shared/ui/PaymentFlowHeader';
import React from 'react';
import { Text } from 'tamagui';
import { Switch } from 'react-native';
import { AppButton } from '~/shared/ui/AppButton';
import { PaymentAmount } from '~/shared/ui/PaymentAmount';
import { PaymentMintRow } from '~/shared/ui/PaymentMintRow';
import { ListTable, ListTableRow } from '~/shared/ui/ListTable';
import { ReclaimSelector } from '~/shared/ui/ReclaimSelector';
import type { SendMode } from '~/shared/ui/SendMethodSelector';
import { currencyService } from '~/services/wallet/currencyService';

interface ConfirmStageProps {
  amount: string;
  mintUrl: string;
  estimatedFee: number | null;
  sendMode: SendMode;
  useP2PK: boolean;
  setUseP2PK: (value: boolean) => void;
  reclaimSupported: boolean;
  reclaimHours: number;
  setReclaimHours: (hours: number) => void;
  nostrRecipientNpub?: string;
  nostrRecipientUsername?: string;
  receiverPubkey?: string;
  isLoading?: boolean;
  ready: boolean;
  error?: string | null;
  onMintChange: (url: string) => void;
  onConfirm: () => void;
  onBack: () => void;
}

export function ConfirmStage(props: ConfirmStageProps) {
  const { amount, mintUrl, estimatedFee, sendMode, isLoading, onBack, onConfirm } = props;
  const recipient =
    sendMode === 'nostr'
      ? props.nostrRecipientUsername || props.nostrRecipientNpub
      : sendMode === 'p2pk'
        ? props.receiverPubkey
        : undefined;
  return (
    <>
      <PaymentFlowHeader title="Confirm send" onBack={onBack} disabled={isLoading} />
      <PaymentStageLayout
        disabled={isLoading}
        hero={<PaymentAmount amount={Number(amount)} label="You're sending" />}
        footer={
          <AppButton
            size="large"
            fullWidth
            loading={isLoading}
            loadingText="Creating ecash…"
            disabled={isLoading || !props.ready}
            onPress={onConfirm}
          >
            {sendMode === 'nostr' ? 'Send' : 'Create ecash'}
          </AppButton>
        }
      >
        <ListTable compact>
          <PaymentMintRow
            method={
              sendMode === 'p2pk' || (sendMode === 'nostr' && props.useP2PK) ? 'p2pk' : undefined
            }
            mintUrl={mintUrl}
            onSelect={props.onMintChange}
            disabled={isLoading}
          />
          <ListTableRow
            label="Method"
            value={
              sendMode === 'nostr'
                ? 'Nostr'
                : sendMode === 'p2pk'
                  ? 'P2PK'
                  : sendMode === 'link'
                    ? 'Ecash link'
                    : 'Ecash'
            }
          />
          <ListTableRow
            label="Creation fee"
            value={
              estimatedFee === null ? 'Calculating…' : currencyService.formatSats(estimatedFee)
            }
          />
          {recipient && (
            <ListTableRow
              label="Recipient"
              value={recipient}
              isCopyable
              copyValue={sendMode === 'nostr' ? props.nostrRecipientNpub : recipient}
            />
          )}
          {sendMode === 'nostr' && (
            <ListTableRow
              label="P2PK lock"
              rightContent={
                <Switch
                  accessibilityLabel="P2PK lock"
                  value={props.useP2PK}
                  disabled={isLoading}
                  onValueChange={props.setUseP2PK}
                />
              }
            />
          )}
          {props.reclaimSupported && (
            <ReclaimSelector
              hours={props.reclaimHours}
              onChange={props.setReclaimHours}
              disabled={isLoading}
            />
          )}
        </ListTable>
        {!!props.error && (
          <Text color="$red10" p="$3">
            {props.error}
          </Text>
        )}
      </PaymentStageLayout>
    </>
  );
}
