import { useWalletStore } from '~/state/walletStore';
import { initService, mintManager } from '~/services/wallet';

let mockMints: { mintUrl: string; trusted: boolean }[] = [];
jest.mock('~/storage/sqlite/sqliteStorage', () => ({
  sqliteStorage: { getItem: () => null, setItem: jest.fn(), removeItem: jest.fn() },
}));
jest.mock('~/services/feedback/feedbackCoordinator', () => ({}));
jest.mock('@cashu/cashu-ts', () => ({}));
jest.mock('react-native', () => ({
  InteractionManager: { runAfterInteractions: jest.fn() },
}));
jest.mock('~/services/wallet', () => ({
  initService: {
    walletExists: jest.fn(async () => true),
    isInitialized: () => true,
    init: async () => ({ mint: { getAllMints: async () => mockMints } }),
  },
  mintManager: {
    getMintInfoList: jest.fn(async () => mockMints),
    addMint: jest.fn(),
    trustMint: jest.fn(async (url: string) => {
      mockMints = mockMints.map((mint) =>
        mint.mintUrl === url ? { ...mint, trusted: true } : mint,
      );
    }),
    untrustMint: jest.fn(async (url: string) => {
      mockMints = mockMints.map((mint) =>
        mint.mintUrl === url ? { ...mint, trusted: false } : mint,
      );
    }),
    removeMint: jest.fn(async (url: string) => {
      mockMints = mockMints.filter((mint) => mint.mintUrl !== url);
    }),
  },
  walletService: { getBalances: async () => ({ 'https://one.test': 10, 'https://two.test': 20 }) },
  quotesService: {},
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockMints = [
    { mintUrl: 'https://one.test', trusted: false },
    { mintUrl: 'https://two.test', trusted: true },
  ];
  useWalletStore.setState(useWalletStore.getInitialState(), true);
});

it('selects an existing trusted mint without adding or trusting anything during startup', async () => {
  useWalletStore.setState({ activeMintUrl: 'https://one.test' });
  await useWalletStore.getState().initialize();
  expect(useWalletStore.getState()).toMatchObject({
    activeMintUrl: 'https://two.test',
    balance: 20,
  });
  expect(mintManager.addMint).not.toHaveBeenCalled();
  expect(mintManager.trustMint).not.toHaveBeenCalled();
});

it('keeps the current trusted selection and canonicalizes its URL', async () => {
  mockMints[0].trusted = true;
  useWalletStore.setState({ activeMintUrl: 'https://TWO.test/' });
  await useWalletStore.getState().initialize();
  expect(useWalletStore.getState().activeMintUrl).toBe('https://two.test');
});

it.each([{ mints: [] }, { mints: [{ mintUrl: 'https://one.test', trusted: false }] }])(
  'leaves selection empty when no mint is trusted (%j)',
  async ({ mints }) => {
    mockMints = mints;
    useWalletStore.setState({ activeMintUrl: 'https://removed.test' });
    await useWalletStore.getState().initialize();
    expect(useWalletStore.getState()).toMatchObject({ activeMintUrl: null, balance: 0 });
    expect(mintManager.addMint).not.toHaveBeenCalled();
    expect(mintManager.trustMint).not.toHaveBeenCalled();
  },
);

it('selects another trusted mint when the selected mint is removed, then clears the last selection', async () => {
  mockMints[0].trusted = true;
  useWalletStore.setState({ activeMintUrl: 'https://one.test' });
  await useWalletStore.getState().removeMint('https://one.test');
  expect(useWalletStore.getState().activeMintUrl).toBe('https://two.test');
  await useWalletStore.getState().removeMint('https://two.test');
  expect(useWalletStore.getState()).toMatchObject({ activeMintUrl: null, balance: 0 });
});

it('clears an untrusted selection while retaining balances and never re-trusts it on restart', async () => {
  useWalletStore.setState({ activeMintUrl: 'https://two.test' });
  await useWalletStore.getState().untrustMint('https://two.test');
  expect(useWalletStore.getState()).toMatchObject({ activeMintUrl: null, balance: 0 });
  await useWalletStore.getState().initialize();
  expect(useWalletStore.getState().balances).toEqual({
    'https://one.test': 10,
    'https://two.test': 20,
  });
  expect(useWalletStore.getState().activeMintUrl).toBeNull();
  expect(mintManager.trustMint).not.toHaveBeenCalled();
});

it('does not select untrusted or disconnected mints through an explicit selection', async () => {
  await useWalletStore.getState().initialize();
  useWalletStore.getState().setActiveMint('https://one.test');
  useWalletStore.getState().setActiveMint('https://unknown.test');
  expect(useWalletStore.getState().activeMintUrl).toBe('https://two.test');
});

it('selects an explicitly trusted mint when none was selected', async () => {
  mockMints[1].trusted = false;
  await useWalletStore.getState().initialize();
  await useWalletStore.getState().trustMint('https://one.test');
  expect(useWalletStore.getState()).toMatchObject({
    activeMintUrl: 'https://one.test',
    balance: 10,
  });
});

it('leaves a wallet without saved data empty', async () => {
  jest.mocked(initService.walletExists).mockResolvedValueOnce(false);
  await useWalletStore.getState().initialize();
  expect(useWalletStore.getState().activeMintUrl).toBeNull();
  expect(mintManager.getMintInfoList).not.toHaveBeenCalled();
});
