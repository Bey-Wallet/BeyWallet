import {
  importRecoveryCandidates,
  retryRecoveryDiscovery,
} from '~/services/wallet/recoveryDiscovery';
import { useRecoverySessionStore } from '~/state/recoverySessionStore';
import { nostrService } from '~/services/wallet/nostrService';
jest.mock('~/storage/sqlite/sqliteStorage', () => ({
  sqliteStorage: { getItem: () => null, setItem: jest.fn() },
}));
jest.mock('~/services/wallet/nostrService', () => ({
  nostrService: { fetchMintsFromNostr: jest.fn() },
}));
jest.mock('~/services/platform/seedService', () => ({
  seedService: {
    getMnemonic: async () => 'fixture',
    getNostrKeys: async () => ({ pubkey: 'public-id' }),
  },
}));
it('prefers backed-up mints and only falls back when none exist', () => {
  expect(
    importRecoveryCandidates(['https://a.test/'], ['https://a.test', 'https://b.test']),
  ).toEqual([
    { mintUrl: 'https://a.test', sources: ['File backup', 'Nostr backup'] },
    { mintUrl: 'https://b.test', sources: ['Nostr backup'] },
  ]);
  expect(importRecoveryCandidates([], []).flatMap((c) => c.sources)).toEqual([
    'Default',
    'Featured',
  ]);
});
it('retries discovery without losing deselection, adds new backed-up mints, and reports failures inline', async () => {
  useRecoverySessionStore.setState({
    session: {
      walletId: 'public-id',
      origin: 'import',
      phase: 'review',
      needsReview: true,
      results: [],
      candidates: importRecoveryCandidates(['https://a.test'], ['https://b.test']),
      selected: ['https://a.test'],
    },
  });
  jest
    .mocked(nostrService.fetchMintsFromNostr)
    .mockResolvedValueOnce(['https://b.test/', 'https://new.test']);
  await retryRecoveryDiscovery();
  expect(useRecoverySessionStore.getState().session?.selected).toEqual([
    'https://a.test',
    'https://new.test',
  ]);
  jest.mocked(nostrService.fetchMintsFromNostr).mockRejectedValueOnce(new Error('offline'));
  await retryRecoveryDiscovery();
  expect(useRecoverySessionStore.getState().session).toMatchObject({
    selected: ['https://a.test', 'https://new.test'],
    discoveryMessage: 'Backup discovery failed. You can retry.',
  });
});
