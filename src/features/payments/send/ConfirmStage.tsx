import { PaymentStageLayout } from '~/shared/ui/PaymentStageLayout';
import { PaymentInfoHeader } from '~/shared/ui/PaymentInfoHeader';
import React from 'react';
import { hapticService } from '~/services/platform/hapticService';
import { Text, XStack, YStack } from 'tamagui';
import { AppSwitch } from '~/shared/ui/AppSwitch';
import { AppButton } from '~/shared/ui/AppButton';
import { AppPressable } from '~/shared/ui/AppPressable';
import { PaymentAmount } from '~/shared/ui/PaymentAmount';
import { PaymentMintRow } from '~/shared/ui/PaymentMintRow';
import { ListTable, ListTableRow } from '~/shared/ui/ListTable';
import { ReclaimSelector } from '~/shared/ui/ReclaimSelector';
import type { SendMode } from '~/shared/ui/SendMethodSelector';
import { currencyService } from '~/services/wallet/currencyService';
import { P2PKLockCard } from './P2PKLockCard';
import { PaymentNote } from '~/shared/ui/PaymentNote';
import { OFFLINE_CHANGE_REQUIRED, type OfflineAmounts } from '~/shared/utils/offlineSendUtils';
import { EcashPaymentStatus } from './EcashPaymentStatus';
import { appTypography } from '~/shared/theme/appearance';

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
  if (isLoading)
    return (
      <EcashPaymentStatus
        status="processing"
        amount={Number(amount)}
        mintUrl={mintUrl}
        fee={estimatedFee}
        recipient={recipient}
        method={sendMode === 'nostr' ? 'Nostr' : sendMode === 'p2pk' ? 'P2PK' : 'Ecash'}
        onClose={onBack}
      />
    );
  return (
    <>
      <PaymentInfoHeader
        infoTopic="ecash-send"
        title="Confirm send"
        onBack={onBack}
        disabled={isLoading}
      />
      <PaymentStageLayout
        disabled={isLoading}
        hero={
          <PaymentAmount amount={Number(amount)} size="prominent" compact label="You're sending" />
        }
        footer={
          <AppButton
            haptic
            size="large"
            fullWidth
            loading={isLoading}
            loadingText="Creating ecash…"
            disabled={isLoading || !props.ready}
            onPress={onConfirm}
          >
            {`${sendMode === 'nostr' ? 'Send' : 'Create'} ${currencyService.formatSats(Number(amount))}`}
          </AppButton>
        }
      >
        {props.isOffline && props.offlineAmounts && (
          <YStack gap="$2">
            <Text fontFamily="$body" fontSize={13} color="$gray10">
              {props.offlineAmounts.exact
                ? 'Available offline'
                : 'Exact amount needs online change'}
            </Text>
            {!props.offlineAmounts.exact && (
              <>
                <XStack gap="$3" width="100%">
                  {(['lower', 'higher'] as const).map((direction) => {
                    const value = props.offlineAmounts?.[direction];
                    if (value == null) return null;
                    const label = direction === 'lower' ? 'Lower' : 'Higher';
                    const formattedAmount = currencyService.formatSats(value);
                    const disabled = isLoading || !props.onAmountSelect;
                    return (
                      <AppPressable
                        key={direction}
                        flex={1}
                        minWidth={0}
                        minHeight={100}
                        rounded="$6"
                        px="$3"
                        py="$4"
                        gap="$1"
                        items="center"
                        justify="center"
                        bg={direction === 'lower' ? '$offlineAmountLower' : '$offlineAmountHigher'}
                        opacity={disabled ? 0.5 : 1}
                        disabled={disabled}
                        accessibilityLabel={`${label}: ${formattedAmount}`}
                        onPress={() => props.onAmountSelect?.(value)}
                      >
                        <Text fontFamily="$body" fontSize={11} color="$offlineAmountForeground">
                          {label}
                        </Text>
                        <Text
                          fontFamily="$display"
                          fontSize={22}
                          fontWeight="600"
                          color="$offlineAmountForeground"
                          text="center"
                          maxWidth="100%"
                          numberOfLines={1}
                          adjustsFontSizeToFit
                        >
                          {formattedAmount}
                        </Text>
                      </AppPressable>
                    );
                  })}
                </XStack>
                <AppButton
                  haptic
                  emphasis="text"
                  labelFontSize={12}
                  alignSelf="center"
                  disabled={isLoading || !props.onPrepareChange}
                  onPress={props.onPrepareChange}
                >
                  Prepare change
                </AppButton>
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
          {recipient && (
            <ListTableRow
              label="To"
              value={recipient}
              multiline
              expandValue
              isCopyable
              copyValue={sendMode === 'nostr' ? props.nostrRecipientNpub : recipient}
            />
          )}
          <PaymentMintRow
            label="Pay from"
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
          <ListTableRow
            label="Total"
            value={
              <Text {...appTypography.label1} color="$color">
                {estimatedFee === null
                  ? props.isOffline && props.offlineAmounts?.exact === false
                    ? 'Unavailable'
                    : 'Calculating…'
                  : currencyService.formatSats(Number(amount) + estimatedFee)}
              </Text>
            }
          />
          {props.onNoteChange && (
            <PaymentNote
              value={props.note || ''}
              onChange={props.onNoteChange}
              disabled={isLoading}
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
                  onCheckedChange={(next) => {
                    if (next !== props.useP2PK) hapticService.selection();
                    props.setUseP2PK(next);
                  }}
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
