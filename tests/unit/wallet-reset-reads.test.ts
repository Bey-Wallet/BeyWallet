import { useWalletStore } from '~/state/walletStore';
import { useSettingsStore } from '~/state/settingsStore';
import { invalidateWalletStorageGeneration } from '~/storage/sqlite/walletStorageLifecycle';

const mockBalances = jest.fn();
const mockMints = jest.fn();
const mockSetting = jest.fn();
jest.mock('~/services/wallet', () => ({
  initService: {
    isInitialized: () => true,
    walletExists: async () => true,
    getRepo: () => ({ settingsRepository: { getSetting: mockSetting } }),
  },
  walletService: { getBalances: () => mockBalances() },
  mintManager: { getMintInfoList: () => mockMints() },
}));
jest.mock('~/services/platform/seedService', () => ({ seedService: {} }));
jest.mock('~/storage/sqlite/sqliteStorage', () => ({
  sqliteStorage: { getItem: () => null, setItem: jest.fn(), removeItem: jest.fn() },
}));
jest.mock('~/state/recoverySessionStore', () => ({}));
jest.mock('@cashu/cashu-ts', () => ({}));

beforeEach(() => {
  jest.clearAllMocks();
  useWalletStore.setState(useWalletStore.getInitialState());
  useSettingsStore.setState(useSettingsStore.getInitialState());
});

it('discards an old balance read and an old mint-list failure after a wallet reset', async () => {
  let finish!: (value: Record<string, number>) => void;
  mockBalances.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  useWalletStore.setState({ activeMintUrl: 'https://old.example' });
  const pending = useWalletStore.getState().refreshBalance();
  invalidateWalletStorageGeneration();
  useWalletStore.setState(useWalletStore.getInitialState());
  finish({ 'https://old.example': 123 });
  await pending;
  expect(useWalletStore.getState()).toMatchObject({ balance: 0, balances: {}, mints: [] });

  let reject!: (error: Error) => void;
  mockMints.mockReturnValueOnce(
    new Promise((_resolve, fail) => {
      reject = fail;
    }),
  );
  const loadingMints = useWalletStore.getState().refreshMintList();
  invalidateWalletStorageGeneration();
  useWalletStore.setState({ ...useWalletStore.getInitialState(), isRefreshing: true });
  reject(new Error('Old wallet closed'));
  await loadingMints;
  // The obsolete failure cannot overwrite the next wallet's refresh status.
  expect(useWalletStore.getState().isRefreshing).toBe(true);
});

it('does not restore an old private identity from an outstanding settings read', async () => {
  let finish!: (value: string) => void;
  mockSetting.mockImplementation(async (key: string) => {
    if (key === 'nsec')
      return new Promise<string>((resolve) => {
        finish = resolve;
      });
    return key === 'npub' ? 'fixture-old-public-key' : null;
  });
  const pending = useSettingsStore.getState().initialize();
  for (let i = 0; i < 8; i++) await Promise.resolve();
  expect(finish).toBeDefined();
  invalidateWalletStorageGeneration();
  useSettingsStore.setState(useSettingsStore.getInitialState());
  finish('fixture-old-secret-key');
  await pending;
  expect(useSettingsStore.getState()).toMatchObject({ nsec: null, npub: null, initialized: false });
});
