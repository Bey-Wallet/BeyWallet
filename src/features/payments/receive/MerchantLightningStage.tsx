import React, { useEffect, useRef, useState } from 'react';
import { quotesService, eventService } from '~/services/wallet';
import { historyService } from '~/services/wallet/historyService';
import { networkService } from '~/services/platform/networkService';
import { useFeedbackOwner } from '~/shared/hooks/useFeedbackOwner';
import { PaymentStage } from '~/features/payments/mint/PaymentStage';
import { PaymentStageLayout } from '~/shared/ui/PaymentStageLayout';
import { PaymentAmount } from '~/shared/ui/PaymentAmount';
import { ListTable, ListTableRow } from '~/shared/ui/ListTable';
import { AppButton } from '~/shared/ui/AppButton';

type Quote = Awaited<ReturnType<typeof quotesService.createMintQuote>>;

/** One saved invoice per sale, retained while the customer changes payment methods. */
export function MerchantLightningStage({
  saleId,
  amount,
  mintUrl,
  note,
  onReceived,
  onBusyChange,
  onClose,
  listening = true,
  renderHeader,
}: {
  saleId?: string;
  amount: number;
  mintUrl: string;
  note?: string;
  onReceived: () => void;
  onBusyChange: (busy: boolean) => void;
  onClose: () => void;
  listening?: boolean;
  renderHeader?: (action: React.ReactNode) => React.ReactNode;
}) {
  const [quote, setQuote] = useState<Quote>();
  const [failed, setFailed] = useState(false);
  const [creating, setCreating] = useState(true);
  const [collecting, setCollecting] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const pendingQuote = useRef<Promise<Quote> | null>(null);
  const createdQuote = useRef<Quote | null>(null);
  const collectLock = useRef(false);
  useFeedbackOwner(quote?.quote);
  // An unused invoice may finish creating after ecash completes the sale.
  // Collection still blocks until its persisted wallet operation returns.
  useEffect(
    () => onBusyChange((listening && creating) || collecting),
    [creating, collecting, listening, onBusyChange],
  );
  useEffect(() => {
    let active = true;
    setCreating(true);
    setFailed(false);
    pendingQuote.current ??= (async () => {
      if (await networkService.isOffline()) throw new Error('Offline');
      const created =
        createdQuote.current ??
        (await (note
          ? quotesService.createMintQuote(mintUrl, amount, note)
          : quotesService.createMintQuote(mintUrl, amount)));
      createdQuote.current = created;
      await historyService.markPosOrigin({
        kind: 'quote',
        mintUrl,
        reference: created.quote,
        ...(saleId ? { saleId } : {}),
      });
      return created;
    })();
    void pendingQuote.current
      .then((created) => {
        if (active) setQuote(created);
      })
      .catch(() => {
        if (active) {
          setFailed(true);
        }
      })
      .finally(() => {
        if (active) setCreating(false);
      });
    return () => {
      active = false;
    };
  }, [amount, mintUrl, note, attempt]);
  useEffect(() => {
    if (!quote || !listening) return;
    return eventService.on('mint-quote:redeemed', (payload: any) => {
      if (payload.quoteId === quote.quote && payload.mintUrl === mintUrl) onReceived();
    });
  }, [quote, mintUrl, onReceived, listening]);
  const collect = async () => {
    if (!quote || !listening || collectLock.current) return;
    collectLock.current = true;
    setCollecting(true);
    try {
      if (await networkService.isOffline()) throw new Error('Offline');
      await quotesService.redeemMintQuote(mintUrl, quote.quote);
      onReceived();
    } finally {
      collectLock.current = false;
      setCollecting(false);
    }
  };
  if (!quote)
    return (
      <>
        {renderHeader?.(null)}
        <PaymentStageLayout
          inset={false}
          hero={<PaymentAmount amount={amount} size="prominent" compact />}
          footer={
            <AppButton
              size="large"
              fullWidth
              loading={creating}
              loadingText="Preparing invoice"
              disabled={creating}
              onPress={() => {
                pendingQuote.current = null;
                setAttempt((value) => value + 1);
              }}
            >
              Retry
            </AppButton>
          }
        >
          <ListTable compact>
            <ListTableRow
              label="Status"
              value={creating ? 'Preparing invoice' : 'Invoice unavailable'}
            />
            <ListTableRow label="Mint" value={mintUrl.replace(/^https?:\/\//, '')} />
            {failed && (
              <ListTableRow
                label="Details"
                value="Could not create the invoice. Check your connection and try again."
                multiline
              />
            )}
          </ListTable>
        </PaymentStageLayout>
      </>
    );
  return (
    <PaymentStage
      renderHeader={renderHeader}
      appearance="pos"
      note={note}
      amount={String(amount)}
      invoice={quote.request}
      quoteId={quote.quote}
      mintUrl={mintUrl}
      expiry={quote.expiry}
      onPaid={collect}
      onCancel={onClose}
      listening={listening}
    />
  );
}
