import { fileRestoreService } from '~/services/wallet/fileRestoreService';
import { useFileRestoreStore } from '~/state/fileRestoreStore';
import { fileRestoreJournal } from '~/storage/sqlite/fileRestoreStorage';
import { biometricService } from '~/services/platform/biometricService';

const phrase = `${'abandon '.repeat(11)}about`;
const other = 'legal winner thank year wave sausage worth useful legal winner thank yellow';
let mockPrevious: string | null = phrase;
let mockRunning = false;
const mockCleanup = jest.fn();
const mockImport = jest.fn();
const mockState = () => ({
  mints: [],
  keysets: [],
  proofs: [],
  counters: [],
  history: [],
  mintQuotes: [],
  sendOperations: [],
  meltOperations: [],
});
const mockRaw = { closeAsync: jest.fn(), getFirstAsync: async () => ({ quick_check: 'ok' }) };
const mockDb: any = {
  all: async () => [],
  get: async () => (mockRunning ? {} : null),
  run: jest.fn(),
  transaction: async (fn: any) => fn(mockDb),
};
jest.mock('expo-sqlite', () => ({ openDatabaseAsync: async () => mockRaw }));
jest.mock('expo-secure-store', () => ({ getItemAsync: async () => 'true' }));
jest.mock('~/storage/sqlite/sqliteStorage', () => ({ getDb: jest.fn() }));
jest.mock('~/services/platform/seedService', () => ({
  seedService: { getMnemonic: async () => mockPrevious },
}));
jest.mock('~/services/platform/biometricService', () => ({
  biometricService: { authenticateAsync: jest.fn(async () => true) },
}));
jest.mock('~/services/wallet/initService', () => ({
  initService: {
    cleanup: (...args: unknown[]) => mockCleanup(...args),
    isInitialized: () => true,
    getRepo: () => ({ db: mockDb }),
  },
}));
jest.mock('~/state/walletStore', () => ({
  useWalletStore: { getState: () => ({ isRestoring: false }) },
}));
jest.mock('~/services/wallet/recoveryCoordinator', () => ({
  recoveryCoordinator: { beginLifecycle: () => jest.fn() },
}));
jest.mock('~/storage/sqlite', () => ({
  ExpoSqliteRepositories: jest.fn().mockImplementation(() => ({
    init: async () => {},
    db: mockDb,
    settingsRepository: { setSetting: jest.fn() },
  })),
}));
jest.mock('~/services/wallet/backupService', () => ({
  backupService: {
    importState: (...args: unknown[]) => mockImport(...args),
    exportState: async () => mockState(),
  },
}));
jest.mock('~/storage/sqlite/fileRestoreStorage', () => ({
  fileRestoreDatabaseNames: { staged: 'staged' },
  fileRestoreJournal: {
    begin: jest.fn(),
    ready: jest.fn(),
    install: jest.fn(),
    rollback: jest.fn(),
    recover: jest.fn(),
    io: { read: jest.fn() },
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockRunning = false;
  mockPrevious = phrase;
  useFileRestoreStore.setState({ phase: 'idle', mode: null, error: null });
  jest.mocked(fileRestoreJournal.io.read).mockResolvedValue(null);
  mockImport.mockResolvedValue(undefined);
  mockCleanup.mockResolvedValue(undefined);
  jest.mocked(biometricService.authenticateAsync).mockResolvedValue(true);
});

it.each([
  [phrase, 'merge'],
  [other, 'replace'],
  [null, 'new'],
])(
  'stages the correct identity mode without installing or replacing the active wallet',
  async (previous, mode) => {
    mockPrevious = previous;
    await fileRestoreService.prepare({ mnemonic: phrase });
    expect(fileRestoreJournal.begin).toHaveBeenCalledWith(
      expect.objectContaining({ mode, previousMnemonic: previous }),
    );
    expect(fileRestoreJournal.ready).toHaveBeenCalled();
    expect(fileRestoreJournal.install).not.toHaveBeenCalled();
    expect(useFileRestoreStore.getState()).toMatchObject({ phase: 'ready', mode });
  },
);

it('does not start a restore on top of an executing payment', async () => {
  mockRunning = true;
  await expect(fileRestoreService.prepare({ mnemonic: phrase })).rejects.toThrow(
    'Wait for wallet operations',
  );
  expect(mockCleanup).not.toHaveBeenCalled();
  expect(fileRestoreJournal.begin).not.toHaveBeenCalled();
  expect(fileRestoreJournal.install).not.toHaveBeenCalled();
});

it('discards a failed staged import without installing it', async () => {
  mockImport.mockRejectedValueOnce(new Error('Malformed record'));
  await fileRestoreService.prepare({ mnemonic: phrase });
  expect(fileRestoreJournal.rollback).toHaveBeenCalled();
  expect(fileRestoreJournal.install).not.toHaveBeenCalled();
  expect(useFileRestoreStore.getState().phase).toBe('restart');
  expect(useFileRestoreStore.getState().error).toContain('backup records could not be imported');
});

it('reports cold-start cleanup failure without losing the failure stage or installing a wallet', async () => {
  mockPrevious = null;
  const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    mockCleanup.mockRejectedValueOnce(new Error('synthetic-private-data-must-not-be-logged'));
    await fileRestoreService.prepare({ mnemonic: phrase });
    expect(useFileRestoreStore.getState()).toMatchObject({
      phase: 'restart',
      error: expect.stringContaining('Could not pause wallet services'),
    });
    expect(warning).toHaveBeenCalledWith('[FileRestore] Preparation failed at stage:', 'cleanup');
    expect(JSON.stringify(warning.mock.calls)).not.toContain('synthetic-private-data');
    expect(fileRestoreJournal.install).not.toHaveBeenCalled();
  } finally {
    warning.mockRestore();
  }
});

it('requires authentication again before completing a resumed existing-wallet restore', async () => {
  useFileRestoreStore.setState({ phase: 'ready', mode: 'replace' });
  jest.mocked(fileRestoreJournal.io.read).mockResolvedValue({
    restoreId: 'restore-fixture',
    phase: 'ready',
    mode: 'replace',
    previousMnemonic: other,
    mnemonic: phrase,
    onboarded: 'true',
  });
  jest.mocked(biometricService.authenticateAsync).mockResolvedValueOnce(false);
  await fileRestoreService.finish();
  expect(fileRestoreJournal.install).not.toHaveBeenCalled();
  expect(useFileRestoreStore.getState().phase).toBe('ready');
});

it('requires explicit completion and restarts to discard old identity caches', async () => {
  await fileRestoreService.prepare({ mnemonic: phrase });
  await fileRestoreService.finish();
  expect(fileRestoreJournal.install).toHaveBeenCalledTimes(1);
  expect(useFileRestoreStore.getState().phase).toBe('restart');
});

it('resumes staged confirmation after relaunch without enabling the normal wallet', async () => {
  jest.mocked(fileRestoreJournal.io.read).mockResolvedValue({
    restoreId: 'restore-fixture',
    phase: 'ready',
    mode: 'replace',
    previousMnemonic: other,
    mnemonic: phrase,
    onboarded: 'true',
  });
  await fileRestoreService.recoverOnStartup();
  expect(useFileRestoreStore.getState()).toMatchObject({ phase: 'ready', mode: 'replace' });
});

it('blocks use and requests a restart when startup rolls an interrupted installation back', async () => {
  jest.mocked(fileRestoreJournal.recover).mockResolvedValueOnce(true);
  await fileRestoreService.recoverOnStartup();
  expect(useFileRestoreStore.getState().phase).toBe('restart');
});
