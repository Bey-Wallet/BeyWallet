import { useWalletStore } from '~/state/walletStore';
import { walletService, mintManager } from '~/services/wallet';
import { recoveryCoordinator } from '~/services/wallet/recoveryCoordinator';

jest.mock('~/storage/sqlite/sqliteStorage', () => ({
  sqliteStorage: { getItem: () => null, setItem: jest.fn(), removeItem: jest.fn() },
}));
jest.mock('~/state/settingsStore', () => ({ useSettingsStore: { getState: () => ({}) } }));
jest.mock('~/services/platform/seedService', () => ({ seedService: {} }));
jest.mock('@cashu/cashu-ts', () => ({}));
jest.mock('react-native', () => ({
  InteractionManager: { runAfterInteractions: (callback: () => void) => callback() },
  DeviceEventEmitter: { emit: jest.fn() },
}));
jest.mock('~/services/wallet', () => ({
  initService: { isInitialized: () => false, reinitFast: jest.fn() },
  nostrService: {},
  quotesService: {},
  mintManager: {
    addMint: jest.fn().mockResolvedValue(undefined),
    getMintInfoList: jest.fn().mockResolvedValue([]),
    getAllTrustedMints: jest.fn().mockResolvedValue([]),
  },
  walletService: {
    restore: jest.fn(),
    restoreInflightProofs: jest.fn().mockResolvedValue(0),
    getBalances: jest.fn().mockResolvedValue({}),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  useWalletStore.setState({
    isRestoring: false,
    restoringMintUrl: null,
    restoreQueue: [],
    mints: [],
    mintRestoreStatuses: [],
  });
});
afterEach(() => jest.useRealTimers());

it('starts after interactions without a fixed sheet delay and clears the timeout', async () => {
  jest.mocked(walletService.restore).mockResolvedValue({ partial: false });
  const result = useWalletStore.getState().restoreFromSeed('https://mint.test');
  await jest.advanceTimersByTimeAsync(0);
  expect(walletService.restore).toHaveBeenCalledWith('https://mint.test');
  expect(mintManager.addMint).toHaveBeenCalledWith('https://mint.test', { trusted: true });
  await jest.advanceTimersByTimeAsync(300);
  expect(await result).toBe('completed');
  expect(useWalletStore.getState().isRestoring).toBe(false);
  expect(jest.getTimerCount()).toBe(0);
});

it('reports scan failure instead of success and releases the queue', async () => {
  jest.mocked(walletService.restore).mockRejectedValueOnce(new Error('Offline'));
  const result = useWalletStore.getState().restoreFromSeed('https://mint.test');
  await jest.advanceTimersByTimeAsync(300);
  expect(await result).toBe('failed');
  expect(useWalletStore.getState().restoreQueue).toEqual([]);
  expect(useWalletStore.getState().isRestoring).toBe(false);
  expect(walletService.restoreInflightProofs).toHaveBeenCalledWith('https://mint.test');
  expect(jest.getTimerCount()).toBe(0);
});

it('does not duplicate a queued scan or claim it has already finished', async () => {
  useWalletStore.setState({ isRestoring: true, restoreQueue: ['https://mint.test'] });
  expect(await useWalletStore.getState().restoreFromSeed('https://mint.test')).toBe('queued');
  expect(walletService.restore).not.toHaveBeenCalled();
});

it('distinguishes partial recovery from a fully completed scan', async () => {
  jest.mocked(walletService.restore).mockResolvedValueOnce({ partial: true });
  const result = useWalletStore.getState().restoreFromSeed('https://mint.test');
  await jest.advanceTimersByTimeAsync(300);
  expect(await result).toBe('partial');
  expect(useWalletStore.getState().isRestoring).toBe(false);
  expect(useWalletStore.getState().mintRestoreStatuses[0].status).toBe('partial');
});

it('keeps slow scans active beyond both former timeouts and prevents overlapping entry points', async () => {
  let finish!: (value: { partial: boolean }) => void;
  jest.mocked(walletService.restore).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  jest.mocked(walletService.restore).mockResolvedValue({ partial: false });
  const first = useWalletStore.getState().restoreFromSeed('https://mint.test');
  await jest.advanceTimersByTimeAsync(0);
  const batch = useWalletStore.getState().restoreAllMints(['https://mint.test']);
  const addedBatch = useWalletStore.getState().restoreAllMints(['https://another-mint.test']);
  await jest.advanceTimersByTimeAsync(600_001);
  expect(walletService.restore).toHaveBeenCalledTimes(1);
  expect(useWalletStore.getState().isRestoring).toBe(true);
  expect(
    useWalletStore
      .getState()
      .mintRestoreStatuses.find((entry) => entry.mintUrl === 'https://mint.test'),
  ).toMatchObject({ status: 'scanning', slow: true });
  expect(() => recoveryCoordinator.beginLifecycle()).toThrow('recovery');
  finish({ partial: false });
  await jest.runAllTimersAsync();
  await Promise.all([first, batch, addedBatch]);
  expect(
    jest.mocked(walletService.restore).mock.calls.filter(([url]) => url === 'https://mint.test'),
  ).toHaveLength(1);
  expect(walletService.restore).toHaveBeenCalledWith('https://another-mint.test');
  expect(useWalletStore.getState().isRestoring).toBe(false);
  expect(recoveryCoordinator.paused).toBe(false);
});
