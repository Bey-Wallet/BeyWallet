import { useEffect, useCallback, useRef } from 'react';
import { initService, eventService } from '~/services/wallet';
import { useWalletStore } from '~/state/walletStore';
import { useQueryClient } from '@tanstack/react-query';
import { DeviceEventEmitter } from 'react-native';
import { subscribeMintTransfers } from '~/services/wallet/mintTransferService';
import { publishWalletFeedback, quoteFeedbackId } from '~/services/feedback/feedbackCoordinator';

const sessionStartedAt = Date.now();

/** Raw SDK events are refresh signals. Quote outcomes require a saved receipt. */
export function useCocoEvents() {
  const refreshBalance = useWalletStore((state) => state.refreshBalance);
  const queryClient = useQueryClient();
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refresh = useCallback(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      void refreshBalance();
      for (const key of ['history', 'history-volume', 'mintTransfer']) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
    }, 300);
  }, [refreshBalance, queryClient]);
  useEffect(() => subscribeMintTransfers(refresh), [refresh]);
  const ready = useWalletStore((state) => state.isInitializing);
  // Fast manager replacement refreshes this counter without re-running initialize().
  useWalletStore((state) => state.refreshCounter);
  const manager = !ready && initService.isInitialized() ? initService.getManager() : null;
  useEffect(() => {
    if (!manager) return;
    const quoteOutcome = async (type: 'mint' | 'melt', value: unknown) => {
      refresh();
      if (!value || typeof value !== 'object') return;
      const payload = value as { mintUrl?: string; quoteId?: string };
      if (typeof payload.mintUrl !== 'string' || typeof payload.quoteId !== 'string') return;
      try {
        const repo = initService.getRepo();
        // Transfer owns the aggregate result, including late completion.
        const leg = await repo.db.get(
          'SELECT id FROM bey_mint_transfers WHERE (mintQuoteId = ? AND targetMintUrl = ?) OR (meltQuoteId = ? AND sourceMintUrl = ?)',
          [payload.quoteId, payload.mintUrl, payload.quoteId, payload.mintUrl],
        );
        if (leg) return;
        const entry =
          type === 'mint'
            ? await repo.historyRepository.getMintHistoryEntry(payload.mintUrl, payload.quoteId)
            : await repo.historyRepository.getMeltHistoryEntry(payload.mintUrl, payload.quoteId);
        if (!entry || entry.state !== (type === 'mint' ? 'ISSUED' : 'PAID')) return;
        await publishWalletFeedback({
          entity: { type: 'quote', id: quoteFeedbackId(payload.mintUrl, payload.quoteId) },
          parentOperationId: payload.quoteId,
          kind: type === 'mint' ? 'received' : 'sent',
          state: 'completed',
          origin: entry.createdAt >= sessionStartedAt ? 'live' : 'catch-up',
          target: { type: 'transaction', id: String(entry.id) },
          details: { amount: entry.amount },
        });
      } catch {
        /* Unverified events never become payment alerts. */
      }
    };
    const unsubscribe = [
      eventService.on('mint-quote:redeemed', (payload) => void quoteOutcome('mint', payload)),
      eventService.on('melt-quote:paid', (payload) => void quoteOutcome('melt', payload)),
      ...(
        [
          'receive:created',
          'send:created',
          'proofs:saved',
          'proofs:state-changed',
          'history:updated',
        ] as const
      ).map((name) => eventService.on(name, refresh)),
    ];
    const native = ['nostr:received', 'lightning-address:received'].map((name) =>
      DeviceEventEmitter.addListener(name, refresh),
    );
    return () => {
      unsubscribe.forEach((stop) => stop());
      native.forEach((subscription) => subscription.remove());
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [manager, refresh]);
}
