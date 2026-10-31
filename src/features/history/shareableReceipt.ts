import { historyRail, type HistoryListEntry } from './historyList';
import {
  historyDisplayAmount,
  historyStatusLabel,
  historyMetadata,
} from './transactionPresentation';

/** Only these public, display-ready fields may cross the image export boundary. */
export type ShareableReceipt = {
  amount: string;
  sats: number;
  type: string;
  mint: string;
  qr?: string;
  method: 'Ecash' | 'Lightning' | 'Bitcoin' | 'Transfer';
  direction: 'Sent' | 'Received' | 'Sending' | 'Receiving' | 'Outgoing' | 'Incoming' | 'Transfer';
  status: 'Confirmed' | 'Pending' | 'Failed' | 'Cancelled' | 'Expired' | 'Refunded';
  date: string;
};

export function buildShareableReceipt(
  entry: HistoryListEntry,
  options: {
    transferState?: string;
    reclaimed?: boolean;
    bitcoinSymbol?: boolean;
    invoice?: string;
    request?: string;
    expired?: boolean;
    mintName?: string;
  } = {},
): ShareableReceipt | null {
  const amount = historyDisplayAmount(entry);
  if (
    entry.unit !== 'sat' ||
    !Number.isSafeInteger(amount) ||
    amount < 0 ||
    !Number.isFinite(entry.createdAt) ||
    entry.createdAt <= 0 ||
    !Number.isFinite(new Date(entry.createdAt).getTime())
  )
    return null;
  const rail = historyRail(entry);
  let mint = options.mintName?.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (!mint) {
    try {
      const url = new URL(entry.mintUrl);
      mint = ['https:', 'http:'].includes(url.protocol) ? url.origin : 'Unknown mint';
    } catch {
      mint = 'Unknown mint';
    }
  }
  const transfer = rail === 'transfer' || !!historyMetadata(entry).transferId;
  const label = options.reclaimed
    ? 'Refunded'
    : transfer
      ? options.transferState === 'completed'
        ? 'Confirmed'
        : options.transferState === 'failed'
          ? 'Failed'
          : 'Pending'
      : historyStatusLabel(entry);
  const status = (
    ['Confirmed', 'Claimed', 'Refunded', 'Expired', 'Cancelled', 'Failed'].includes(label)
      ? label === 'Claimed'
        ? 'Confirmed'
        : label
      : 'Pending'
  ) as ShareableReceipt['status'];
  const outgoing = ['send', 'melt'].includes(entry.type);
  const direction = transfer
    ? 'Transfer'
    : status === 'Confirmed'
      ? outgoing
        ? 'Sent'
        : 'Received'
      : status === 'Pending'
        ? outgoing
          ? 'Sending'
          : 'Receiving'
        : outgoing
          ? 'Outgoing'
          : 'Incoming';
  return {
    mint,
    sats: amount,
    type: transfer
      ? 'Transfer'
      : entry.type === 'receive-request'
        ? 'Ecash request'
        : entry.type === 'mint'
          ? rail === 'onchain'
            ? 'Bitcoin deposit'
            : 'Lightning top-up'
          : entry.type === 'melt'
            ? rail === 'onchain'
              ? 'Bitcoin payment'
              : 'Lightning payment'
            : status !== 'Confirmed'
              ? 'Ecash payment'
              : entry.type === 'receive'
                ? 'Ecash received'
                : 'Ecash sent',
    amount: `${options.bitcoinSymbol === false ? '' : '₿ '}${amount.toLocaleString('en-US')}${options.bitcoinSymbol === false ? ' sat' : ''}`,
    method: transfer
      ? 'Transfer'
      : rail === 'lightning'
        ? 'Lightning'
        : rail === 'onchain'
          ? 'Bitcoin'
          : 'Ecash',
    direction,
    status,
    date: new Date(entry.createdAt).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }),
    ...(status === 'Pending' &&
    !options.expired &&
    entry.type === 'mint' &&
    entry.state?.toLowerCase() === 'unpaid' &&
    /^ln(?:bc|tb|bcrt)[a-z0-9]+$/i.test(options.invoice || '')
      ? { qr: options.invoice }
      : {}),
    ...(status === 'Pending' &&
    entry.type === 'receive-request' &&
    entry.state === 'pending' &&
    /^creqA[A-Za-z0-9+/_=-]+$/.test(options.request || '')
      ? { qr: options.request }
      : {}),
  };
}
