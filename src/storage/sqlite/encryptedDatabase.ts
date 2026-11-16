import * as SQLite from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';
import { File } from 'expo-file-system';
import { getRandomValues } from 'expo-crypto';
import { Buffer } from 'buffer';

export const walletDatabaseNames = {
  active: 'coco_wallet_encrypted.db',
  original: 'bey_file_restore_original_encrypted.db',
  staged: 'bey_file_restore_staged_encrypted.db',
} as const;
const legacyNames = {
  [walletDatabaseNames.active]: 'coco_wallet.db',
  [walletDatabaseNames.original]: 'bey_file_restore_original.db',
  [walletDatabaseNames.staged]: 'bey_file_restore_staged.db',
} as const;
type WalletDatabaseName = (typeof walletDatabaseNames)[keyof typeof walletDatabaseNames];
const KEY = 'bey_wallet_database_key_v1';
const WIPE_KEY = 'bey_wallet_database_wipe_v1';
const keyOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };
const unavailable = 'Wallet storage could not be opened. Your wallet has not been reset.';
let cipherAvailable = false;
let verified = false;

export class DatabaseEncryptionUnavailableError extends Error {
  constructor() {
    super('This app build needs SQLCipher. Install a new development build to continue.');
  }
}

export class WalletDeletionPendingError extends Error {}

function file(name: string) {
  const path = `${SQLite.defaultDatabaseDirectory}/${name}`;
  return new File(path.startsWith('file://') ? path : `file://${path}`);
}

function removeFiles(name: string) {
  for (const suffix of ['', '-wal', '-shm', '-journal']) {
    const item = file(name + suffix);
    if (item.exists) item.delete();
  }
}

function familyExists(name: string) {
  return ['', '-wal', '-shm', '-journal'].some((suffix) => file(name + suffix).exists);
}

function requireCipher() {
  if (cipherAvailable) return;
  const probe = SQLite.openDatabaseSync(':memory:', { useNewConnection: true });
  try {
    const version = probe.getFirstSync<{ cipher_version: string }>('PRAGMA cipher_version');
    if (!version?.cipher_version) throw new DatabaseEncryptionUnavailableError();
    cipherAvailable = true;
  } finally {
    probe.closeSync();
  }
}

function deviceKey(): string {
  if (walletStorageDeletionPending()) throw new Error(unavailable);
  let key = SecureStore.getItem(KEY, keyOptions);
  if (key === null) {
    // Never replace a lost key while any encrypted database or interrupted copy exists.
    if (
      Object.values(walletDatabaseNames).some(
        (name) => familyExists(name) || familyExists(name + '.encrypting'),
      )
    )
      throw new Error(unavailable);
    key = Buffer.from(getRandomValues(new Uint8Array(32))).toString('hex');
    SecureStore.setItem(KEY, key, keyOptions);
    if (SecureStore.getItem(KEY, keyOptions) !== key) throw new Error(unavailable);
  }
  if (!/^[0-9a-f]{64}$/.test(key)) throw new Error(unavailable);
  return key;
}

function keyed(name: string, key: string): SQLite.SQLiteDatabase {
  const db = SQLite.openDatabaseSync(name, { useNewConnection: true });
  try {
    // Raw random key: no user password, no expensive password stretching on startup.
    db.execSync(`PRAGMA key = "x'${key}'";`);
    db.execSync('PRAGMA temp_store = MEMORY; PRAGMA busy_timeout = 3000;');
    db.getFirstSync('SELECT count(*) FROM sqlite_master');
    return db;
  } catch {
    try {
      db.closeSync();
    } catch {
      /* Do not expose native SQL diagnostics. */
    }
    throw new Error(unavailable);
  }
}

function verify(db: SQLite.SQLiteDatabase) {
  if (
    db.getFirstSync<{ quick_check: string }>('PRAGMA quick_check')?.quick_check !== 'ok' ||
    db.getAllSync('PRAGMA cipher_integrity_check').length !== 0
  )
    throw new Error(unavailable);
}

export async function verifyEncryptedDatabase(db: SQLite.SQLiteDatabase) {
  try {
    const integrity = await db.getFirstAsync<{ quick_check: string }>('PRAGMA quick_check');
    if (
      integrity?.quick_check !== 'ok' ||
      (await db.getAllAsync('PRAGMA cipher_integrity_check')).length !== 0
    )
      throw new Error(unavailable);
  } catch {
    throw new Error(unavailable);
  }
}

function counts(db: SQLite.SQLiteDatabase): Map<string, number> {
  const rows = db.getAllSync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  return new Map(
    rows.map(({ name }) => {
      const count = db.getFirstSync<{ total: number }>(
        `SELECT count(*) AS total FROM "${name.replace(/"/g, '""')}"`,
      );
      if (!count) throw new Error(unavailable);
      return [name, count.total];
    }),
  );
}

function migrate(name: WalletDatabaseName, key: string) {
  const legacy = legacyNames[name];
  const temporary = name + '.encrypting';
  if (!file(legacy).exists || file(name).exists) return;
  // A partial export is disposable only while the untouched legacy source remains.
  removeFiles(temporary);
  const source = SQLite.openDatabaseSync(legacy, { useNewConnection: true });
  let expected: Map<string, number>;
  try {
    source.execSync('PRAGMA temp_store = MEMORY; PRAGMA busy_timeout = 3000;');
    if (source.getFirstSync<{ quick_check: string }>('PRAGMA quick_check')?.quick_check !== 'ok')
      throw new Error(unavailable);
    const version =
      source.getFirstSync<{ user_version: number }>('PRAGMA user_version')?.user_version ?? 0;
    if (!Number.isSafeInteger(version) || version < 0) throw new Error(unavailable);
    // sqlcipher_export is required for plaintext -> encrypted conversion; SQLite backup
    // cannot copy between a plaintext source and an encrypted destination.
    const destinationPath = decodeURIComponent(file(temporary).uri.replace(/^file:\/\//, ''));
    source.runSync('ATTACH DATABASE ? AS encrypted_copy KEY ?', [destinationPath, `x'${key}'`]);
    source.execSync('BEGIN IMMEDIATE;');
    try {
      expected = counts(source);
      source.execSync("SELECT sqlcipher_export('encrypted_copy');");
      source.execSync(`PRAGMA encrypted_copy.user_version = ${version}; COMMIT;`);
    } catch {
      source.execSync('ROLLBACK;');
      throw new Error(unavailable);
    }
    source.execSync('DETACH DATABASE encrypted_copy;');
  } finally {
    source.closeSync();
  }
  const copy = keyed(temporary, key);
  try {
    verify(copy);
    const actual = counts(copy);
    if (
      actual.size !== expected.size ||
      [...expected].some(([table, count]) => actual.get(table) !== count)
    )
      throw new Error(unavailable);
  } finally {
    copy.closeSync();
  }
  // Both files are on the same filesystem. The verified copy becomes authoritative;
  // after interruption, an existing encrypted file is never replaced by legacy data.
  file(temporary).move(file(name));
}

export function walletDatabaseExists(name: WalletDatabaseName): boolean {
  return file(name).exists || file(legacyNames[name]).exists;
}

/** Preflight must not open a damaged active database before journal rollback can repair it. */
export function assertEncryptedStorageAvailable() {
  try {
    requireCipher();
    deviceKey();
  } catch (error) {
    if (error instanceof DatabaseEncryptionUnavailableError) throw error;
    throw new Error(unavailable);
  }
}

/** Every wallet, staging and rollback handle must be keyed before its first data access. */
export function openEncryptedDatabase(name: WalletDatabaseName): SQLite.SQLiteDatabase {
  let db: SQLite.SQLiteDatabase | undefined;
  try {
    requireCipher();
    const key = deviceKey();
    if (
      !file(name).exists &&
      !file(legacyNames[name]).exists &&
      (familyExists(name) || familyExists(legacyNames[name]) || familyExists(name + '.encrypting'))
    )
      throw new Error(unavailable);
    migrate(name, key);
    db = keyed(name, key);
    if (familyExists(legacyNames[name])) {
      // Reopen and authenticate the finished file before removing the plaintext source.
      verify(db);
      removeFiles(legacyNames[name]);
    }
    if (name === walletDatabaseNames.active) verified = true;
    return db;
  } catch (error) {
    try {
      db?.closeSync();
    } catch {
      /* Keep the original failure secret-free. */
    }
    if (error instanceof DatabaseEncryptionUnavailableError) throw error;
    // Native SQL diagnostics can contain the raw PRAGMA key. Never propagate them.
    throw new Error(unavailable);
  }
}

export function prepareRecoveryDatabaseEncryption() {
  for (const name of [walletDatabaseNames.original, walletDatabaseNames.staged]) {
    if (walletDatabaseExists(name)) openEncryptedDatabase(name).closeSync();
  }
}

export function removeWalletDatabase(name: WalletDatabaseName) {
  for (const candidate of [name, name + '.encrypting', legacyNames[name]]) removeFiles(candidate);
}

/** Call only after the shared handle and wallet runtime have been closed. */
export async function destroyEncryptedWalletStorage() {
  try {
    // Persist deletion intent before removing files. A restart must never pair
    // the old phrase with a newly created empty database after an interrupted wipe.
    SecureStore.setItem(WIPE_KEY, '1', keyOptions);
    if (!walletStorageDeletionPending()) throw new Error(unavailable);
    for (const name of Object.values(walletDatabaseNames)) removeWalletDatabase(name);
    removeFiles('cashu_wallet_restore.db');
    await SecureStore.deleteItemAsync(KEY, keyOptions);
    verified = false;
  } catch {
    throw new Error('Wallet storage could not be deleted. Retry before resetting the wallet.');
  }
}

export function walletStorageDeletionPending(): boolean {
  return SecureStore.getItem(WIPE_KEY, keyOptions) !== null;
}

/** Clear only after the database, its key and the recovery phrase have been removed. */
export async function finishWalletStorageDeletion() {
  await SecureStore.deleteItemAsync(WIPE_KEY, keyOptions);
}

export function walletStorageIsEncrypted(): boolean {
  return verified;
}
