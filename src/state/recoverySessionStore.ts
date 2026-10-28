import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { sqliteStorage } from '~/storage/sqlite/sqliteStorage';
import { recoveryCoordinator } from '~/services/wallet/recoveryCoordinator';
import { normalizeMintUrl } from '~/shared/utils/mintUrl';

export type RecoveryCandidate = { mintUrl: string; sources: string[] };
export type RecoveryResult = {
  mintUrl: string;
  status: 'done' | 'partial' | 'error' | 'interrupted';
  balance: number;
};
export type RecoverySession = {
  /** Presentation correlation only; never used for recovery or derivation. */
  feedbackId?: string;
  walletId: string;
  origin: 'import' | 'manual';
  candidates: RecoveryCandidate[];
  selected: string[];
  phase: 'review' | 'recovering' | 'results' | 'interrupted';
  results: RecoveryResult[];
  needsReview: boolean;
  discoveryMessage?: string;
};

let releasePause: (() => void) | undefined;
export function holdRecoveryPause() {
  releasePause ??= recoveryCoordinator.pause();
}
export function releaseRecoveryPause() {
  releasePause?.();
  releasePause = undefined;
}

export function recoveryCandidates(groups: { urls: string[]; source: string }[]) {
  const candidates = new Map<string, RecoveryCandidate>();
  for (const { urls, source } of groups) {
    for (const url of urls) {
      let mintUrl: string;
      try {
        mintUrl = normalizeMintUrl(url);
      } catch {
        continue;
      }
      const candidate = candidates.get(mintUrl) ?? { mintUrl, sources: [] };
      if (!candidate.sources.includes(source)) candidate.sources.push(source);
      candidates.set(mintUrl, candidate);
    }
  }
  return [...candidates.values()];
}

export const useRecoverySessionStore = create(
  persist<{ session: RecoverySession | null }>(() => ({ session: null }), {
    name: 'recovery-session',
    storage: createJSONStorage(() => sqliteStorage),
  }),
);

export function updateRecoverySession(change: Partial<RecoverySession>) {
  useRecoverySessionStore.setState(({ session }) => ({
    session: session ? { ...session, ...change } : null,
  }));
}

export function acknowledgeRecovery() {
  const session = useRecoverySessionStore.getState().session;
  if (session?.phase === 'recovering') return;
  updateRecoverySession({ needsReview: false });
  releaseRecoveryPause();
}

/** Called before startup listeners, using only the wallet's public identity. */
export async function prepareRecoverySession(walletId: string) {
  if (!useRecoverySessionStore.persist.hasHydrated())
    await useRecoverySessionStore.persist.rehydrate();
  const session = useRecoverySessionStore.getState().session;
  if (session && session.walletId !== walletId) {
    useRecoverySessionStore.setState({ session: null });
    releaseRecoveryPause();
    return;
  }
  if (session?.phase === 'recovering') {
    updateRecoverySession({
      phase: 'interrupted',
      needsReview: true,
      results: session.selected.map(
        (mintUrl) =>
          session.results.find((result) => result.mintUrl === mintUrl) ?? {
            mintUrl,
            status: 'interrupted',
            balance: 0,
          },
      ),
    });
  }
  if (session?.needsReview && session.origin === 'import' && session.phase === 'review')
    holdRecoveryPause();
  else releaseRecoveryPause();
}
