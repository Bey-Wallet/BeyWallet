import { PaymentStageLayout } from '~/shared/ui/PaymentStageLayout';
import { PaymentFlowHeader } from '~/shared/ui/PaymentFlowHeader';
import React from 'react';
import { Text, YStack } from 'tamagui';
import { AppSwitch } from '~/shared/ui/AppSwitch';
import { AppButton } from '~/shared/ui/AppButton';
import { PaymentAmount } from '~/shared/ui/PaymentAmount';
import { PaymentMintRow } from '~/shared/ui/PaymentMintRow';
import { ListTable, ListTableRow } from '~/shared/ui/ListTable';
import { ReclaimSelector } from '~/shared/ui/ReclaimSelector';
import type { SendMode } from '~/shared/ui/SendMethodSelector';
import { currencyService } from '~/services/wallet/currencyService';
import { P2PKLockCard } from './P2PKLockCard';
import { PaymentNote } from '~/shared/ui/PaymentNote';
import { FirstUseGuidance } from '~/shared/ui/FirstUseGuidance';
import { OFFLINE_CHANGE_REQUIRED, type OfflineAmounts } from '~/shared/utils/offlineSendUtils';

interface ConfirmStageProps {
  amount: string;
  note?: string;
  onNoteChange?: (value: string) => void;
  mintUrl: string;
  estimatedFee: number | null;
  offlineAmounts?: OfflineAmounts | null;
  onAmountSelect?: (amount: number) => void;
  onPrepareChange?: () => void;
  sendMode: SendMode;
  useP2PK: boolean;
  setUseP2PK: (value: boolean) => void;
  reclaimSupported: boolean;
  reclaimHours: number;
  setReclaimHours: (hours: number) => void;
  nostrRecipientNpub?: string;
  nostrRecipientUsername?: string;
  receiverPubkey?: string;
  lockEcash?: boolean;
  setLockEcash?: (enabled: boolean) => void;
  setReceiverPubkey?: (key: string) => void;
  isOffline?: boolean;
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
        hero={<PaymentAmount amount={Number(amount)} size="prominent" label="You're sending" />}
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
        {props.isOffline && <FirstUseGuidance topic="offlineTokens" />}
        {props.offlineAmounts && (
          <YStack gap="$2">
            <Text fontFamily="$body" fontSize={14} color="$gray10">
              {props.offlineAmounts.exact
                ? 'Available offline'
                : 'Exact amount needs online change'}
            </Text>
            {!props.offlineAmounts.exact && (
              <>
                <Text fontFamily="$body" fontSize={12} color="$gray10">
                  {props.offlineAmounts.lower !== null || props.offlineAmounts.higher !== null
                    ? 'Choose a nearby amount to send offline, or prepare change while online.'
                    : 'No offline amounts available. Prepare change while online.'}
                </Text>
                {(['lower', 'higher'] as const).map((direction) => {
                  const value = props.offlineAmounts?.[direction];
                  return value == null ? null : (
                    <AppButton
                      key={direction}
                      fullWidth
                      emphasis="secondary"
                      disabled={isLoading || !props.onAmountSelect}
                      onPress={() => props.onAmountSelect?.(value)}
                    >
                      {`${direction === 'lower' ? 'Lower' : 'Higher'}: ${currencyService.formatSats(value)}`}
                    </AppButton>
                  );
                })}
                <AppButton
                  fullWidth
                  emphasis="text"
                  disabled={isLoading || !props.onPrepareChange}
                  onPress={props.onPrepareChange}
                >
                  Prepare change
                </AppButton>
                {props.isOffline && (
                  <Text fontFamily="$body" fontSize={12} color="$gray10">
                    Reconnect to prepare change for the original amount.
                  </Text>
                )}
              </>
            )}
          </YStack>
        )}
        {sendMode === 'standard' && props.setLockEcash && props.setReceiverPubkey && (
          <P2PKLockCard
            enabled={!!props.lockEcash}
            onEnabledChange={props.setLockEcash}
            publicKey={props.receiverPubkey || ''}
            onKeyChange={props.setReceiverPubkey}
            disabled={isLoading}
            offline={props.isOffline}
          />
        )}
        <ListTable compact>
          <PaymentMintRow
            method={
              sendMode === 'p2pk' ||
              (sendMode === 'standard' && props.lockEcash) ||
              (sendMode === 'nostr' && props.useP2PK)
                ? 'p2pk'
                : undefined
            }
            mintUrl={mintUrl}
            onSelect={props.onMintChange}
            disabled={isLoading}
          />
          <ListTableRow
            label="Method"
            value={sendMode === 'nostr' ? 'Nostr' : sendMode === 'p2pk' ? 'P2PK' : 'Ecash'}
          />
          <ListTableRow
            label="Creation fee"
            value={
              estimatedFee === null
                ? props.isOffline && props.offlineAmounts?.exact === false
                  ? 'Unavailable'
                  : 'Calculating…'
                : currencyService.formatSats(estimatedFee)
            }
          />
          {props.onNoteChange && (
            <PaymentNote
              value={props.note || ''}
              onChange={props.onNoteChange}
              disabled={isLoading}
            />
          )}
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
                <AppSwitch
                  variant="branded"
                  accessibilityLabel="P2PK lock"
                  checked={props.useP2PK}
                  disabled={isLoading}
                  onCheckedChange={props.setUseP2PK}
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
        {!!props.error &&
          !(props.offlineAmounts?.exact === false && props.error === OFFLINE_CHANGE_REQUIRED) && (
            <Text color="$red10" p="$3">
              {props.error}
            </Text>
          )}
      </PaymentStageLayout>
    </>
  );
}
