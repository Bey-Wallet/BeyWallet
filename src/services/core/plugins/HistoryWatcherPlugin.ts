import type { Plugin, HistoryEntry, Token } from 'coco-cashu-core';

/**
 * HistoryWatcherPlugin
 *
 * Watches the state of proofs for 'send' transactions.
 * When a recipient claims the tokens (proofs become SPENT at the mint),
 * this plugin automatically updates the history entry state to 'claimed'.
 */
export const HistoryWatcherPlugin: Plugin<
  ['historyService', 'subscriptions', 'eventBus', 'logger']
> = {
  name: 'history-watcher-plugin',
  required: ['historyService', 'subscriptions', 'eventBus', 'logger'] as const,
  onReady: async ({ services: { historyService, subscriptions, eventBus, logger } }) => {
    logger.info('[HistoryWatcherPlugin] Initializing sent proof watchers...');

    const activeWatches = new Map<string, () => void>();

    const watchEntry = async (entry: HistoryEntry) => {
      // Only watch pending send transactions
      if (entry.type !== 'send' || (entry as any).state !== 'pending') return;
      if (activeWatches.has(entry.id)) return;

      const token = (entry as any).token as Token;
      if (!token || !token.proofs || token.proofs.length === 0) return;

      // Get all secrets (Ys) or secrets from proofs
      const secrets = token.proofs.map((p: any) => p.secret);
      if (secrets.length === 0) return;

      try {
        logger.debug(
          `[HistoryWatcherPlugin] Subscribing to proof state for entry ${entry.id} (${secrets.length} proofs)`,
        );

        const { unsubscribe } = await subscriptions.subscribe(
          entry.mintUrl,
          'proof_state',
          secrets,
          async (payload: any) => {
            // payload: { secret, state } from mint
            if (payload.state === 'SPENT') {
              logger.info(
                `[HistoryWatcherPlugin] Proof spent for history ${entry.id}, marking as claimed`,
              );

              try {
                // Update the entry in the repository via historyService (or internal repo)
                const updatedEntry = { ...entry, state: 'claimed' };
                logger.debug(
                  `[HistoryWatcherPlugin] Updating history entry ${entry.id} to claimed`,
                );

                // Direct repo update if possible, otherwise use service
                if (
                  typeof (historyService as any).historyRepository?.updateHistoryEntry ===
                  'function'
                ) {
                  await (historyService as any).historyRepository.updateHistoryEntry(updatedEntry);
                } else {
                  // Fallback if private
                  await historyService.handleHistoryUpdated(entry.mintUrl, updatedEntry as any);
                }

                logger.debug(`[HistoryWatcherPlugin] Emitting history:updated for ${entry.id}`);
                // Emit event to notify UI listeners (like useCocoEvents)
                await eventBus.emit('history:updated', {
                  mintUrl: entry.mintUrl,
                  entry: updatedEntry as any,
                });

                // Success! Stop watching this one
                stopWatching(entry.id);
                logger.info(
                  `[HistoryWatcherPlugin] Successfully marked entry ${entry.id} as claimed and stopped watching`,
                );
              } catch (e) {
                logger.error(
                  `[HistoryWatcherPlugin] Failed to update history entry ${entry.id}:`,
                  e,
                );
              }
            }
          },
        );

        activeWatches.set(entry.id, unsubscribe);
        logger.debug(`[HistoryWatcherPlugin] Subscribed successfully to entry ${entry.id}`);
      } catch (err) {
        logger.warn(
          `[HistoryWatcherPlugin] Subscription failed for entry ${entry.id} (mint might not support NUT-17):`,
          err,
        );
      }
    };

    const stopWatching = (entryId: string) => {
      const unsub = activeWatches.get(entryId);
      if (unsub) {
        unsub();
        activeWatches.delete(entryId);
      }
    };

    // 1. Scan recent history for pending sends
    try {
      logger.debug('[HistoryWatcherPlugin] Scanning recent history for pending sends...');
      const recentHistory = await historyService.getPaginatedHistory(0, 50);
      const pendingSends = recentHistory.filter(
        (h) => h.type === 'send' && (h as any).state === 'pending',
      );
      logger.info(`[HistoryWatcherPlugin] Found ${pendingSends.length} pending sends to watch`);

      for (const entry of pendingSends) {
        await watchEntry(entry);
      }
    } catch (err) {
      logger.error('[HistoryWatcherPlugin] Initial scan failed:', err);
    }

    // 2. Listen for new send events to start watching them
    const offSend = eventBus.on('send:created', (payload) => {
      logger.debug(
        `[HistoryWatcherPlugin] New send created for mint ${payload.mintUrl}, starting watch timer`,
      );
      // The history entry is usually saved right after send:created event
      // We wait a moment to ensure it exists in the repo
      setTimeout(async () => {
        try {
          const history = await historyService.getPaginatedHistory(0, 10);
          // Find the most recent send for this mint
          const entry = history.find((h) => h.type === 'send' && h.mintUrl === payload.mintUrl);
          if (entry) {
            logger.debug(
              `[HistoryWatcherPlugin] Found matching history entry ${entry.id} for new send, starting watch`,
            );
            await watchEntry(entry);
          } else {
            logger.warn(
              `[HistoryWatcherPlugin] Could not find history entry for new send to ${payload.mintUrl}`,
            );
          }
        } catch (e) {
          logger.error('[HistoryWatcherPlugin] Error finding new send entry:', e);
        }
      }, 3000); // 3 seconds to be sure
    });

    // 3. Cleanup function
    return () => {
      logger.info('[HistoryWatcherPlugin] Disposing watchers');
      offSend();
      for (const unsub of activeWatches.values()) {
        unsub();
      }
      activeWatches.clear();
    };
  },
};
