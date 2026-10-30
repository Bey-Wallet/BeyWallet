import React, { useEffect, useRef, useState } from 'react';
import { Text, YStack } from 'tamagui';
import { quotesService, eventService } from '~/services/wallet';
import { networkService } from '~/services/platform/networkService';
import { useFeedbackOwner } from '~/shared/hooks/useFeedbackOwner';
import { PaymentStage } from '~/features/payments/mint/PaymentStage';
import { Spinner } from '~/shared/ui/Spinner';
import { AppButton } from '~/shared/ui/AppButton';

type Quote = Awaited<ReturnType<typeof quotesService.createMintQuote>>;

/** One saved invoice per sale, retained while the customer changes payment methods. */
export function MerchantLightningStage({
  amount,
  mintUrl,
  note,
  onReceived,
  onBusyChange,
  onClose,
}: {
  amount: number;
  mintUrl: string;
  note?: string;
  onReceived: () => void;
  onBusyChange: (busy: boolean) => void;
  onClose: () => void;
}) {
  const [quote, setQuote] = useState<Quote>();
  const [failed, setFailed] = useState(false);
  const [creating, setCreating] = useState(true);
  const [collecting, setCollecting] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const pendingQuote = useRef<Promise<Quote> | null>(null);
  const collectLock = useRef(false);
  useFeedbackOwner(quote?.quote);
  useEffect(() => onBusyChange(creating || collecting), [creating, collecting, onBusyChange]);
  useEffect(() => {
    let active = true;
    setCreating(true);
    setFailed(false);
    pendingQuote.current ??= (async () => {
      if (await networkService.isOffline()) throw new Error('Offline');
      return note
        ? quotesService.createMintQuote(mintUrl, amount, note)
        : quotesService.createMintQuote(mintUrl, amount);
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
    if (!quote) return;
    return eventService.on('mint-quote:redeemed', (payload: any) => {
      if (payload.quoteId === quote.quote && payload.mintUrl === mintUrl) onReceived();
    });
  }, [quote, mintUrl, onReceived]);
  const collect = async () => {
    if (!quote || collectLock.current) return;
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
      <YStack flex={1} items="center" justify="center" gap="$3">
        {creating && <Spinner size="large" />}
        {failed && (
          <>
            <Text fontFamily="$body" fontSize={14} color="$gray10" text="center">
              Could not create the invoice. Check your connection and try again.
            </Text>
            <AppButton
              emphasis="secondary"
              onPress={() => {
                pendingQuote.current = null;
                setAttempt((value) => value + 1);
              }}
            >
              Retry
            </AppButton>
          </>
        )}
      </YStack>
    );
  return (
    <PaymentStage
      amount={String(amount)}
      invoice={quote.request}
      quoteId={quote.quote}
      mintUrl={mintUrl}
      expiry={quote.expiry}
      onPaid={collect}
      onCancel={onClose}
    />
  );
}
