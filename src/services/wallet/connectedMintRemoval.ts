import { ConnectedMintRemovalRepository } from '~/storage/sqlite/repositories/ConnectedMintRemovalRepository';
import type { MintRemovalBlock } from '~/storage/sqlite/repositories/ConnectedMintRemovalRepository';
import { recoveryCoordinator } from './recoveryCoordinator';

export const mintRemovalMessages: Record<MintRemovalBlock, string> = {
  funds: 'Transfer funds before removing',
  pending: 'Pending payments or requests',
  unclaimed: 'Unclaimed or unfinished ecash',
  recovery: 'Recovery or review needed',
  missing: 'Mint is no longer connected',
  unknown: 'Could not verify wallet state',
};

function repository() {
  const { initService } = require('./initService') as typeof import('./initService');
  return new ConnectedMintRemovalRepository(initService.getRepo().db);
}

export async function inspectConnectedMints(urls: string[], { allowFunds = false } = {}) {
  const repo = await repository();
  const result: Record<string, MintRemovalBlock | null> = {};
  for (const url of new Set(urls)) {
    try {
      result[url] = recoveryCoordinator.has(url) ? 'recovery' : await repo.inspect(url, allowFunds);
    } catch {
      result[url] = 'unknown';
    }
  }
  return result;
}

export async function removeConnectedMints(urls: string[]) {
  const release = recoveryCoordinator.beginLifecycle();
  const removed: string[] = [];
  const blocked: Record<string, MintRemovalBlock> = {};
  try {
    await recoveryCoordinator.drainBackground();
    const repo = await repository();
    const { getChangeServices } =
      require('./plugins/ChangePreparationPlugin') as typeof import('./plugins/ChangePreparationPlugin');
    const { eventBus } = getChangeServices();
    for (const url of new Set(urls)) {
      try {
        const reason = await repo.removeIfEmpty(url);
        if (reason) {
          blocked[url] = reason;
          continue;
        }
      } catch {
        blocked[url] = 'unknown';
        continue;
      }
      removed.push(url);
      try {
        await eventBus.emit('mint:untrusted', { mintUrl: url });
      } catch {
        console.warn('[MintRemoval] Connection removed; subscription cleanup needs refresh.');
      }
    }
    return { removed, blocked };
  } finally {
    release();
  }
}
