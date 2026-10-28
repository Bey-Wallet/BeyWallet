import { Wallet } from '@cashu/cashu-ts';
import { initService } from '~/services/wallet/initService';
import { proofService } from '~/services/wallet/proofService';
import { quotesService } from '~/services/wallet/quotesService';
import { decodeToken } from '~/services/wallet/tokenUtils';
import { useNostrRequestStore } from '~/state/nostrRequestStore';
import { getHistoryToken, getVerifiedTokenState } from './historyToken';
import { historyRail, type HistoryListEntry } from './historyList';

/** Refresh is observational: never redeem, execute, refund, or resubmit a payment. */
export async function checkHistoryStatus(entry: HistoryListEntry): Promise<string> {
  if (entry.type === 'receive-request') {
    await useNostrRequestStore.getState().loadPendingRequests();
    const request = useNostrRequestStore.getState().requests.find((item) => item.id === entry.id);
    if (!request) return 'Request unavailable';
    return request.state === 'received'
      ? 'Payment received'
      : request.state === 'pending'
        ? 'Request pending'
        : `Payment request ${request.state}`;
  }
  if (['send', 'receive'].includes(entry.type)) {
    const token = getHistoryToken(entry);
    if (!token) return 'Review payment details';
    const states = await proofService.checkProofStates(token);
    const state = getVerifiedTokenState(states, decodeToken(token).proofs.length);
    if (!state) throw new Error('Incomplete status response');
    if (entry.type === 'send' && state === 'claimed') {
      await initService.getRepo().historyRepository.updateHistoryEntryState(entry.id, 'claimed');
      return 'Ecash claimed';
    }
    if (state === 'claimed') return 'Ecash already spent';
    return state === 'unclaimed' ? 'Ecash not claimed' : 'Payment pending';
  }
  if (entry.quoteId && entry.mintUrl && ['mint', 'melt'].includes(entry.type)) {
    const onchain = historyRail(entry) === 'onchain';
    const wallet = onchain ? undefined : new Wallet(entry.mintUrl);
    const quote =
      entry.type === 'mint'
        ? onchain
          ? await quotesService.checkOnchainMintQuote(entry.mintUrl, entry.quoteId)
          : await wallet!.checkMintQuoteBolt11(entry.quoteId)
        : onchain
          ? await quotesService.checkOnchainMeltQuote(entry.mintUrl, entry.quoteId)
          : await wallet!.checkMeltQuoteBolt11(entry.quoteId);
    const state = typeof quote.state === 'string' ? quote.state.toLowerCase() : '';
    if (state === 'paid' || state === 'issued')
      return entry.type === 'mint'
        ? state === 'issued'
          ? 'Payment received'
          : 'Payment paid'
        : state === 'paid'
          ? 'Payment sent'
          : 'Review payment status';
    if (['unpaid', 'pending'].includes(state)) return 'Payment pending';
    throw new Error('Unknown quote state');
  }
  return 'Review payment details';
}
