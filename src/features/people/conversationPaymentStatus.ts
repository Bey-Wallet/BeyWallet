import { checkHistoryStatus } from '~/features/history/checkHistoryStatus';
import { initService } from '~/services/wallet/initService';
import { quotesService } from '~/services/wallet/quotesService';
import { Wallet } from '@cashu/cashu-ts';
import type { ConversationActivity } from './conversationActivity';
import { parsePersonHistoryMetadata, type PersonHistoryEntry } from './personHistory';

/** Observation only: quote issuance and receiving remain owned by the wallet. */
export async function readConversationPaymentStatus(
  item: ConversationActivity,
  history: PersonHistoryEntry[],
): Promise<string | undefined> {
  const entry =
    item.history ||
    history.find(
      (entry) =>
        !!item.message?.paymentId &&
        parsePersonHistoryMetadata(entry.metadata).nostrEventId === item.message.paymentId,
    );
  if (entry?.mintUrl && ['send', 'melt'].includes(entry.type)) {
    const state = entry.state?.toLowerCase();
    if (['claimed', 'paid', 'completed', 'refunded', 'expired'].includes(state || ''))
      return state === 'refunded'
        ? 'Refunded'
        : state === 'expired'
          ? 'Expired'
          : entry.type === 'melt'
            ? 'Paid'
            : 'Claimed';
    const status = await checkHistoryStatus({
      ...entry,
      mintUrl: entry.mintUrl,
      unit: entry.unit || 'sat',
    });
    return status === 'Ecash claimed'
      ? 'Claimed'
      : status === 'Ecash not claimed'
        ? 'Awaiting claim'
        : status === 'Payment sent'
          ? 'Paid'
          : status === 'Payment pending'
            ? 'Pending'
            : undefined;
  }
  const input = item.paymentInput;
  if (input?.error || input?.route !== 'lightning' || !/^ln(?:bc|tb|bcrt)\d/i.test(input.value))
    return undefined;
  // Never send a stranger's invoice to a mint or assume it belongs to this wallet.
  const quote = await initService.getRepo().mintQuoteRepository.findByRequest(input.value);
  if (!quote) {
    const melt = await initService.getRepo().meltQuoteRepository.findByRequest(input.value);
    if (!melt) return undefined;
    const state =
      melt.state === 'PAID'
        ? melt.state
        : (await new Wallet(melt.mintUrl).checkMeltQuoteBolt11(melt.quote)).state;
    return state === 'PAID'
      ? 'Paid'
      : ['UNPAID', 'PENDING'].includes(state)
        ? 'Pending'
        : undefined;
  }
  const state =
    quote.state === 'ISSUED'
      ? quote.state
      : (await quotesService.checkMintQuote(quote.mintUrl, quote.quote)).state;
  if (state === 'ISSUED') return 'Received';
  if (state === 'PAID') return 'Paid';
  if (state === 'UNPAID')
    return quote.expiry && quote.expiry * 1000 <= Date.now() ? 'Expired' : 'Awaiting payment';
  return undefined;
}
