type StorageModule = typeof import('~/storage/sqlite/encryptedDatabase');
let storage: StorageModule;
let mockKey: string | null;
let mockWipe: string | null;
let mockCipher: boolean;
let mockFailure: string | null;
let mockBadCopy: boolean;
let mockDeleteFailure: string | null;
const mockFiles = new Set<string>();
const mockTables = new Map<string, Map<string, number>>();
const mockTrace: string[] = [];
const mockDeleteKey = jest.fn(async () => {
  mockKey = null;
});
const mockSetKey = jest.fn((_key: string, value: string) => {
  mockTrace.push('save-key');
  mockKey = value;
});
const basename = (path: string) => path.split('/').at(-1)!;
jest.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'device-only',
  getItem: (key: string) => (key === 'bey_wallet_database_wipe_v1' ? mockWipe : mockKey),
  setItem: (key: string, value: string) => {
    if (key === 'bey_wallet_database_wipe_v1') mockWipe = value;
    else mockSetKey(key, value);
  },
  deleteItemAsync: async (key: string) => {
    if (key === 'bey_wallet_database_wipe_v1') mockWipe = null;
    else await mockDeleteKey();
  },
}));
jest.mock('expo-crypto', () => ({ getRandomValues: (bytes: Uint8Array) => bytes.fill(7) }));
jest.mock('expo-file-system', () => ({
  File: class {
    uri: string;
    constructor(uri: string) {
      this.uri = uri;
    }
    get exists() {
      return mockFiles.has(basename(this.uri));
    }
    delete() {
      const name = basename(this.uri);
      if (name === mockDeleteFailure) throw new Error('failed deletion');
      mockTrace.push(`delete:${name}`);
      mockFiles.delete(name);
    }
    move(target: { uri: string }) {
      if (mockFailure === 'move') throw new Error('interrupted rename');
      const from = basename(this.uri),
        to = basename(target.uri);
      mockFiles.delete(from);
      mockFiles.add(to);
      mockTables.set(to, mockTables.get(from) ?? new Map());
      mockTrace.push(`install:${to}`);
    }
  },
}));
jest.mock('expo-sqlite', () => ({
  defaultDatabaseDirectory: '/wallet/SQLite',
  openDatabaseSync: jest.fn((name: string) => {
    let keyed = false;
    let attached: string;
    mockTrace.push(`open:${name}`);
    if (name !== ':memory:') mockFiles.add(name);
    return {
      execSync(sql: string) {
        if (sql.startsWith('PRAGMA key')) {
          keyed = true;
          mockTrace.push(`key:${name}`);
        }
        if (sql.includes('sqlcipher_export')) {
          if (mockFailure === 'export') throw new Error('SQL with synthetic private key');
          const tables = new Map(mockTables.get(name));
          if (mockBadCopy) tables.set('proofs', 0);
          mockTables.set(attached, tables);
          mockTrace.push('export');
        }
      },
      runSync(_sql: string, args: string[]) {
        attached = basename(args[0]);
        mockFiles.add(attached);
      },
      getFirstSync(sql: string) {
        if (sql === 'PRAGMA cipher_version') return mockCipher ? { cipher_version: '4.6' } : null;
        if (sql === 'PRAGMA quick_check') return { quick_check: 'ok' };
        if (sql === 'PRAGMA user_version') return { user_version: 9 };
        if (name.includes('_encrypted') && !keyed) throw new Error('read before key');
        if (mockFailure === 'read' && name.includes('_encrypted'))
          throw new Error('SQL with synthetic private key');
        if (sql.includes('AS total')) {
          const table = sql.match(/FROM "([^"]+)"/)![1];
          return { total: mockTables.get(name)?.get(table) ?? 0 };
        }
        mockTrace.push(`read:${name}`);
        return { count: 1 };
      },
      getAllSync(sql: string) {
        if (sql === 'PRAGMA cipher_integrity_check') return [];
        return [...(mockTables.get(name)?.keys() ?? [])].map((table) => ({ name: table }));
      },
      closeSync() {
        mockTrace.push(`close:${name}`);
      },
    };
  }),
}));

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  mockFiles.clear();
  mockTables.clear();
  mockTrace.length = 0;
  mockKey = null;
  mockWipe = null;
  mockCipher = true;
  mockFailure = null;
  mockBadCopy = false;
  mockDeleteFailure = null;
  storage = require('~/storage/sqlite/encryptedDatabase');
});

it('creates new-user storage with a persisted random key before the first data read, without migration', () => {
  const active = storage.walletDatabaseNames.active;
  expect(storage.walletStorageIsEncrypted()).toBe(false);
  storage.openEncryptedDatabase(active).closeSync();
  expect(mockKey).toMatch(/^[0-9a-f]{64}$/);
  expect(mockTrace.indexOf('save-key')).toBeLessThan(mockTrace.indexOf(`open:${active}`));
  expect(mockTrace.indexOf(`key:${active}`)).toBeLessThan(mockTrace.indexOf(`read:${active}`));
  expect(mockTrace).not.toContain('export');
  expect(storage.walletStorageIsEncrypted()).toBe(true);
});

it('blocks an old dev client before creating keys or wallet files', () => {
  mockCipher = false;
  expect(() => storage.openEncryptedDatabase(storage.walletDatabaseNames.active)).toThrow(
    storage.DatabaseEncryptionUnavailableError,
  );
  expect(mockSetKey).not.toHaveBeenCalled();
  expect(mockFiles.size).toBe(0);
  expect(storage.walletStorageIsEncrypted()).toBe(false);
});

it('does not create a database if the new key cannot be saved and read back', () => {
  mockSetKey.mockImplementationOnce(() => {});
  expect(() => storage.openEncryptedDatabase(storage.walletDatabaseNames.active)).toThrow(
    'has not been reset',
  );
  expect(mockFiles.size).toBe(0);
});

it('rejects malformed stored keys before any wallet SQL can run', () => {
  mockKey = "invalid' SQL input";
  expect(() => storage.openEncryptedDatabase(storage.walletDatabaseNames.active)).toThrow(
    'has not been reset',
  );
  expect(mockFiles.size).toBe(0);
  expect(mockSetKey).not.toHaveBeenCalled();
});

it.each([
  'coco_wallet_encrypted.db',
  'bey_file_restore_original_encrypted.db',
  'coco_wallet_encrypted.db-wal',
  'coco_wallet_encrypted.db.encrypting',
])('never generates a replacement key when encrypted data remains: %s', (name) => {
  mockFiles.add(name);
  expect(() => storage.openEncryptedDatabase(storage.walletDatabaseNames.active)).toThrow(
    'has not been reset',
  );
  expect(mockFiles.has(name)).toBe(true);
  expect(mockSetKey).not.toHaveBeenCalled();
});

it('exports and verifies all legacy tables before installing and deleting plaintext and WAL files', () => {
  mockFiles.add('coco_wallet.db');
  mockFiles.add('coco_wallet.db-wal');
  mockTables.set(
    'coco_wallet.db',
    new Map([
      ['proofs', 12],
      ['pending_operations', 3],
      ['settings', 8],
    ]),
  );
  const active = storage.walletDatabaseNames.active;
  storage.openEncryptedDatabase(active).closeSync();
  expect(mockTables.get(active)).toEqual(mockTables.get('coco_wallet.db'));
  expect(mockTrace.indexOf(`install:${active}`)).toBeLessThan(
    mockTrace.indexOf('delete:coco_wallet.db'),
  );
  expect(mockFiles.has('coco_wallet.db')).toBe(false);
  expect(mockFiles.has('coco_wallet.db-wal')).toBe(false);
});

it.each(['export', 'move'])('preserves the original on interrupted %s and can retry', (failure) => {
  mockFiles.add('coco_wallet.db');
  mockTables.set('coco_wallet.db', new Map([['proofs', 12]]));
  mockFailure = failure;
  expect(() => storage.openEncryptedDatabase(storage.walletDatabaseNames.active)).toThrow(
    'has not been reset',
  );
  expect(mockFiles.has('coco_wallet.db')).toBe(true);
  mockFailure = null;
  storage.openEncryptedDatabase(storage.walletDatabaseNames.active).closeSync();
  expect(mockTables.get(storage.walletDatabaseNames.active)?.get('proofs')).toBe(12);
});

it('rejects an incomplete export without deleting the original or promoting the copy', () => {
  mockFiles.add('coco_wallet.db');
  mockTables.set('coco_wallet.db', new Map([['proofs', 12]]));
  mockBadCopy = true;
  expect(() => storage.openEncryptedDatabase(storage.walletDatabaseNames.active)).toThrow();
  expect(mockFiles.has('coco_wallet.db')).toBe(true);
  expect(mockFiles.has(storage.walletDatabaseNames.active)).toBe(false);
});

it('cleans up a leftover plaintext WAL after a previous source-file deletion was interrupted', () => {
  mockKey = '07'.repeat(32);
  mockFiles.add(storage.walletDatabaseNames.active);
  mockFiles.add('coco_wallet.db-wal');
  storage.openEncryptedDatabase(storage.walletDatabaseNames.active).closeSync();
  expect(mockFiles.has('coco_wallet.db-wal')).toBe(false);
});

it('refuses to create an empty wallet over orphaned recovery files', () => {
  mockKey = '07'.repeat(32);
  mockFiles.add('coco_wallet.db-wal');
  expect(() => storage.openEncryptedDatabase(storage.walletDatabaseNames.active)).toThrow(
    'has not been reset',
  );
  expect(mockFiles.has('coco_wallet.db-wal')).toBe(true);
  expect(mockFiles.has(storage.walletDatabaseNames.active)).toBe(false);
});

it('never falls back to a stale plaintext wallet when the encrypted wallet cannot open', () => {
  mockKey = '07'.repeat(32);
  mockFailure = 'read';
  mockFiles.add('coco_wallet.db');
  mockFiles.add(storage.walletDatabaseNames.active);
  expect(() => storage.openEncryptedDatabase(storage.walletDatabaseNames.active)).toThrow(
    'has not been reset',
  );
  expect(mockTrace).not.toContain('export');
  expect(mockFiles.has('coco_wallet.db')).toBe(true);
  expect(mockSetKey).not.toHaveBeenCalled();
});

it('migrates interrupted legacy recovery snapshots through the same encrypted boundary', () => {
  mockKey = '07'.repeat(32);
  for (const legacy of ['bey_file_restore_original.db', 'bey_file_restore_staged.db']) {
    mockFiles.add(legacy);
    mockTables.set(legacy, new Map([['proofs', 5]]));
  }
  storage.prepareRecoveryDatabaseEncryption();
  expect(mockTables.get(storage.walletDatabaseNames.original)?.get('proofs')).toBe(5);
  expect(mockTables.get(storage.walletDatabaseNames.staged)?.get('proofs')).toBe(5);
});

it('keeps the encryption key after a failed wipe, then removes it only after every copy is gone', async () => {
  mockKey = '07'.repeat(32);
  mockFiles.add(storage.walletDatabaseNames.active);
  mockFiles.add(storage.walletDatabaseNames.original);
  mockDeleteFailure = storage.walletDatabaseNames.original;
  await expect(storage.destroyEncryptedWalletStorage()).rejects.toThrow('could not be deleted');
  expect(mockDeleteKey).not.toHaveBeenCalled();
  expect(mockKey).not.toBeNull();
  mockDeleteFailure = null;
  await storage.destroyEncryptedWalletStorage();
  expect(mockFiles.size).toBe(0);
  expect(mockKey).toBeNull();
  expect(storage.walletStorageDeletionPending()).toBe(true);
  expect(() => storage.openEncryptedDatabase(storage.walletDatabaseNames.active)).toThrow();
  await storage.finishWalletStorageDeletion();
  expect(storage.walletStorageDeletionPending()).toBe(false);
});
