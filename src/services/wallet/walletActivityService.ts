import { randomUUID } from 'expo-crypto';
import { getEncodedToken, type Token } from '@cashu/cashu-ts';
import {
  WalletActivityRepository,
  type WalletActivity,
} from '~/storage/sqlite/repositories/WalletActivityRepository';
import { feedbackCoordinator } from '~/services/feedback/feedbackCoordinator';
import type { RecoverySession } from '~/state/recoverySessionStore';

const listeners = new Set<() => void>();
export function subscribeWalletActivity(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
const notify = () =>
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {}
  });
function repositories() {
  const { initService } = require('./initService') as typeof import('./initService');
  return initService.getRepo();
}
function journal() {
  return new WalletActivityRepository(repositories().db);
}

export function createWalletActivity(
  kind: 'optimize' | 'recovery',
  mintUrl: string,
  id = `activity:${kind}:${randomUUID()}`,
): WalletActivity {
  return {
    id,
    kind,
    mintUrl,
    state: 'pending',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    inputAmount: null,
    fee: null,
    balanceDelta: null,
    beforeCount: null,
    afterCount: null,
    operationId: null,
    receiveHistoryId: null,
    completedCount: null,
    totalCount: null,
    observedBalance: null,
    mintUrls: mintUrl ? [mintUrl] : [],
    walletId: feedbackCoordinator.wallet,
  };
}
export async function saveWalletActivity(activity: WalletActivity) {
  if (activity.walletId && activity.walletId !== feedbackCoordinator.wallet) return;
  try {
    await journal().save({ ...activity, updatedAt: Date.now() });
    notify();
  } catch {
    console.warn('[WalletActivity] Could not save local activity summary.');
  }
}

/** Match the original token to an authoritative saved receive, never by time or amount alone. */
async function reconcile(activity: WalletActivity): Promise<WalletActivity> {
  activity = { ...activity, walletId: feedbackCoordinator.wallet };
  if (activity.kind === 'recovery') {
    const { useRecoverySessionStore } =
      require('~/state/recoverySessionStore') as typeof import('~/state/recoverySessionStore');
    const session = useRecoverySessionStore.getState().session;
    if (
      !session ||
      session.walletId !== feedbackCoordinator.wallet ||
      activity.id !== `activity:recovery:${session.feedbackId}`
    )
      return activity;
    const updated = recoverySnapshot(activity, session);
    if (
      updated.state !== activity.state ||
      updated.completedCount !== activity.completedCount ||
      updated.observedBalance !== activity.observedBalance
    ) {
      await saveWalletActivity(updated);
      return updated;
    }
    return activity;
  }
  if (
    activity.kind !== 'optimize' ||
    !activity.operationId ||
    (activity.receiveHistoryId && activity.state === 'completed')
  )
    return activity;
  try {
    const entry = await repositories().historyRepository.getSendHistoryEntry(
      activity.mintUrl,
      activity.operationId,
    );
    if (!entry) return activity;
    if (
      activity.state !== 'completed' &&
      ['rolledback', 'rolled_back', 'cancelled', 'canceled'].includes(
        String(entry.state).toLowerCase(),
      )
    ) {
      if (activity.state !== 'canceled') {
        const canceled = { ...activity, state: 'canceled' as const };
        await saveWalletActivity(canceled);
        return canceled;
      }
      return activity;
    }
    if (!entry.token) return activity;
    const token =
      typeof entry.token === 'string' ? entry.token : getEncodedToken(entry.token as Token);
    const { findTokenReceiveReceipt } =
      require('./nostrReceiptService') as typeof import('./nostrReceiptService');
    const receipt = await findTokenReceiveReceipt(token);
    if (!receipt) return activity;
    const completed = { ...activity, state: 'completed' as const, receiveHistoryId: receipt.id };
    await saveWalletActivity(completed);
    return completed;
  } catch {
    return activity;
  }
}

export async function getWalletActivities(limit = 200) {
  const records = await journal().list(limit);
  return Promise.all(records.map(reconcile));
}
export async function getWalletActivity(id: string) {
  const activity = await journal().get(id);
  return activity ? reconcile(activity) : undefined;
}
export async function hideWalletActivity(id: string) {
  await journal().hide(id);
  notify();
}
export async function getOptimizationLinks() {
  return journal().optimizationLinks();
}

export async function getOptimizationReceiptId(
  activity: WalletActivity,
): Promise<string | undefined> {
  if (activity.kind !== 'optimize' || !activity.operationId) return;
  const entry = await repositories().historyRepository.getSendHistoryEntry(
    activity.mintUrl,
    activity.operationId,
  );
  return entry?.id;
}

export function activityHistoryEntry(activity: WalletActivity) {
  return {
    id: activity.id,
    type: 'maintenance',
    amount: activity.inputAmount ?? 0,
    unit: 'sat',
    mintUrl: activity.mintUrl,
    state: activity.state,
    createdAt: activity.createdAt,
    metadata: { walletActivity: activity },
  };
}
export function mergeWalletActivity<
  T extends { id: string; type: string; mintUrl: string; operationId?: string },
>(
  payments: T[],
  activities: WalletActivity[],
  links: Pick<WalletActivity, 'mintUrl' | 'operationId' | 'receiveHistoryId'>[] = [],
) {
  const related = [...links, ...activities.filter((item) => item.kind === 'optimize')];
  const operationKey = (mint: string, id: string) => JSON.stringify([mint.replace(/\/+$/, ''), id]);
  const sends = new Set(
    related
      .filter((item) => item.operationId)
      .map((item) => operationKey(item.mintUrl, item.operationId!)),
  );
  const receives = new Set(
    related.filter((item) => item.receiveHistoryId).map((item) => item.receiveHistoryId),
  );
  const visiblePayments = payments.filter(
    (payment) =>
      !(
        payment.type === 'send' &&
        payment.operationId &&
        sends.has(operationKey(payment.mintUrl, payment.operationId))
      ) && !(payment.type === 'receive' && receives.has(payment.id)),
  );
  return [
    ...visiblePayments,
    ...activities.filter((item) => !item.hidden).map(activityHistoryEntry),
  ];
}

/** Recovery balances are observations, not incoming payments or newly recovered deltas. */
type RecoverySummary = Pick<RecoverySession, 'feedbackId' | 'selected' | 'phase' | 'results'> & {
  walletId?: string;
};
function recoverySnapshot(activity: WalletActivity, session: RecoverySummary): WalletActivity {
  const selected = [...new Set(session.selected)];
  const results = selected.map((url) => session.results.find((result) => result.mintUrl === url));
  const done = results.filter((result) => result?.status === 'done').length;
  const complete =
    session.phase !== 'recovering' && done === selected.length && selected.length > 0;
  return {
    ...activity,
    state: session.phase === 'recovering' ? 'pending' : complete ? 'completed' : 'review',
    mintUrls: selected,
    completedCount: done,
    totalCount: selected.length,
    observedBalance: results.reduce(
      (sum, result) =>
        sum +
        (result && Number.isSafeInteger(result.balance) && result.balance >= 0
          ? result.balance
          : 0),
      0,
    ),
  };
}
export async function recordRecoveryActivity(session: RecoverySummary) {
  if (!session.feedbackId) return;
  if (session.walletId && session.walletId !== feedbackCoordinator.wallet) return;
  const activity = createWalletActivity(
    'recovery',
    session.selected.length === 1 ? session.selected[0] : '',
    `activity:recovery:${session.feedbackId}`,
  );
  await saveWalletActivity(recoverySnapshot(activity, session));
}
