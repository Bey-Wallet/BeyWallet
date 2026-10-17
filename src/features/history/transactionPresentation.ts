import { normalizeBitcoinAddress } from '~/shared/utils/onchain';

interface PaymentHistory {
  type: string;
  state?: string;
  metadata?: unknown;
  paymentRequest?: string;
}

export function historyMetadata(entry: PaymentHistory): Record<string, any> {
  if (typeof entry.metadata === 'string') {
    try {
      return JSON.parse(entry.metadata) || {};
    } catch {
      return {};
    }
  }
  return entry.metadata && typeof entry.metadata === 'object' ? entry.metadata : {};
}

/** Classifies display only; address validation for spending stays in the payment flow. */
export function isOnchainHistory(entry: PaymentHistory): boolean {
  const metadata = historyMetadata(entry);
  if (metadata.via === 'onchain') return true;
  if (!['mint', 'melt'].includes(entry.type)) return false;
  const request = entry.paymentRequest || metadata.address;
  return (
    typeof request === 'string' &&
    /^(bc1|tb1|bcrt1|[13mn2])[a-zA-Z0-9]{25,95}$/i.test(normalizeBitcoinAddress(request))
  );
}

export function historyPaymentLayout(entry: PaymentHistory, invoice?: string | null) {
  const state = (entry.state || '').trim().toLowerCase();
  const onchain = isOnchainHistory(entry);
  if (onchain && ['pending', 'unpaid', 'prepared'].includes(state)) {
    if (entry.type === 'mint') return 'onchain-deposit';
    if (entry.type === 'melt') return 'onchain-withdrawal';
  }
  if (
    !onchain &&
    entry.type === 'mint' &&
    ['unpaid', 'paid', 'pending'].includes(state) &&
    invoice &&
    /^(lightning:)?ln(bc|tb|bcrt)/i.test(invoice)
  )
    return 'lightning-invoice';
  return 'receipt';
}

/** A successful POST can still return a pending or unsuccessful melt quote. */
export function onchainMeltOutcome(state?: string): 'paid' | 'failed' | 'pending' {
  const value = state?.trim().toLowerCase();
  if (['paid', 'completed', 'finalized', 'success'].includes(value || '')) return 'paid';
  if (['unpaid', 'failed', 'error', 'cancelled', 'canceled'].includes(value || '')) return 'failed';
  return 'pending';
}
