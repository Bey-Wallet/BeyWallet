import {
  acknowledgeRecovery,
  holdRecoveryPause,
  prepareRecoverySession,
  recoveryCandidates,
  releaseRecoveryPause,
  useRecoverySessionStore,
} from '~/state/recoverySessionStore';
import { recoveryCoordinator } from '~/services/wallet/recoveryCoordinator';
jest.mock('~/storage/sqlite/sqliteStorage', () => ({
  sqliteStorage: { getItem: () => null, setItem: jest.fn() },
}));
beforeEach(() => {
  useRecoverySessionStore.setState({
    session: {
      walletId: 'public-id',
      origin: 'import',
      phase: 'review',
      needsReview: true,
      candidates: [{ mintUrl: 'https://a.test', sources: ['Nostr backup'] }],
      selected: ['https://a.test'],
      results: [],
    },
  });
});
afterEach(releaseRecoveryPause);
it('deduplicates canonical URLs while retaining discovery sources and case-sensitive paths', () => {
  expect(
    recoveryCandidates([
      { urls: ['https://A.test/Bitcoin/', 'https://a.test/Bitcoin'], source: 'File backup' },
      { urls: ['https://a.test/Bitcoin', 'https://a.test/bitcoin', 'bad'], source: 'Nostr backup' },
    ]),
  ).toEqual([
    { mintUrl: 'https://a.test/Bitcoin', sources: ['File backup', 'Nostr backup'] },
    { mintUrl: 'https://a.test/bitcoin', sources: ['Nostr backup'] },
  ]);
});
it('reestablishes review pause and preserves an empty selection on restart', async () => {
  useRecoverySessionStore.setState(({ session }) => ({ session: { ...session!, selected: [] } }));
  await prepareRecoverySession('public-id');
  expect(recoveryCoordinator.paused).toBe(true);
  expect(useRecoverySessionStore.getState().session?.selected).toEqual([]);
  acknowledgeRecovery();
  expect(recoveryCoordinator.paused).toBe(false);
  await prepareRecoverySession('public-id');
  expect(recoveryCoordinator.paused).toBe(false);
});
it('marks running work interrupted, preserving settled results without automatically scanning', async () => {
  useRecoverySessionStore.setState(({ session }) => ({
    session: {
      ...session!,
      phase: 'recovering',
      selected: ['https://a.test', 'https://b.test'],
      results: [{ mintUrl: 'https://a.test', status: 'done', balance: 123 }],
    },
  }));
  await prepareRecoverySession('public-id');
  expect(useRecoverySessionStore.getState().session).toMatchObject({
    phase: 'interrupted',
    results: [{ status: 'done', balance: 123 }, { status: 'interrupted' }],
  });
  expect(recoveryCoordinator.paused).toBe(false);
});
it('discards stale metadata and releases its pause when wallets change', async () => {
  holdRecoveryPause();
  await prepareRecoverySession('another-wallet');
  expect(useRecoverySessionStore.getState().session).toBeNull();
  expect(recoveryCoordinator.paused).toBe(false);
});
