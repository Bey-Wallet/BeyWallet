import { backupService } from '~/services/wallet/backupService';
import { walletFileService } from '~/services/platform/walletFileService';
import { parseChangeOperation } from '~/storage/sqlite/repositories/ChangeOperationRepository';

let mockContents = '';
const mockDb: any = {
  transaction: jest.fn(async (fn) => fn(mockDb)),
  all: jest.fn(async (sql) => (sql.includes('bey_change_operations') ? [record] : [])),
  run: jest.fn(),
};
jest.mock('~/services/wallet', () => ({ initService: { getRepo: () => ({ db: mockDb }) } }));
jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
jest.mock('~/state/settingsStore', () => ({ useSettingsStore: {} }));
jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: '/cache/',
  writeAsStringAsync: jest.fn(async (_path, data) => {
    mockContents = data;
  }),
  readAsStringAsync: jest.fn(async () => mockContents),
}));
jest.mock('expo-sharing', () => ({
  isAvailableAsync: async () => true,
  shareAsync: async () => {},
}));
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: async () => ({
    canceled: false,
    assets: [{ uri: '/backup', name: 'backup.json' }],
  }),
}));

const operation = {
  id: 'change-test',
  mintUrl: 'https://mint.test',
  state: 'prepared',
  inputAmount: 32,
  fee: 1,
  outputAmount: 31,
  inputSecrets: ['synthetic-input'],
  outputs: { keep: [], send: [] },
  createdAt: 1,
};
const record = {
  id: operation.id,
  mintUrl: operation.mintUrl,
  state: operation.state,
  data: JSON.stringify(operation),
  createdAt: 1,
};
const mnemonic =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

it('round-trips maintenance journals through the database snapshot and wallet backup file', async () => {
  const state = await backupService.exportState();
  expect(mockDb.transaction).toHaveBeenCalledTimes(1);
  expect(state.changeOperations).toEqual([record]);
  await walletFileService.exportWallet(mnemonic, {
    ...state,
    defaultMintUrl: '',
    secondaryCurrency: 'USD',
    theme: 'system',
  });
  const backup = await walletFileService.importWalletFromFile();
  expect(backup.changeOperations).toEqual([record]);
  await backupService.importState({ ...state, changeOperations: backup.changeOperations });
  expect(mockDb.run).toHaveBeenCalledWith(
    expect.stringContaining('INSERT INTO bey_change_operations'),
    [record.id, record.mintUrl, record.state, record.data, record.createdAt],
  );
  expect(parseChangeOperation(record)).toEqual(operation);
});

it('accepts older backups without a maintenance journal', async () => {
  mockContents = JSON.stringify({ mnemonic });
  expect((await walletFileService.importWalletFromFile()).changeOperations).toEqual([]);
});

it('rejects inconsistent journal amounts and mismatched operation identities', () => {
  expect(() => parseChangeOperation({ ...record, id: 'different' })).toThrow(
    'Invalid change operation',
  );
  expect(() =>
    parseChangeOperation({ ...record, data: JSON.stringify({ ...operation, outputAmount: 32 }) }),
  ).toThrow('Invalid change operation');
  expect(() =>
    parseChangeOperation({
      ...record,
      state: 'submitted',
      data: JSON.stringify({ ...operation, state: 'submitted' }),
    }),
  ).toThrow('Invalid change operation');
});
