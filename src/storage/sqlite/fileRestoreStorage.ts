import * as SQLite from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';
import { seedService } from '~/services/platform/seedService';
import { closeDb } from './sqliteStorage';
import { FileRestoreJournal, type FileRestoreRecord } from './fileRestoreJournal';
import {
  openEncryptedDatabase,
  verifyEncryptedDatabase,
  removeWalletDatabase,
  walletDatabaseExists,
  walletDatabaseNames,
} from './encryptedDatabase';

const JOURNAL_KEY = 'bey_file_restore_v1';
const ONBOARDING_KEY = 'bey_wallet_onboarded';
export const fileRestoreDatabaseNames = walletDatabaseNames;

export async function validateInstalledFileRestore(
  record: FileRestoreRecord,
  database: SQLite.SQLiteDatabase,
) {
  const installed = await database.getFirstAsync<{ value: string }>(
    "SELECT value FROM coco_cashu_settings WHERE key = 'fileRestoreId'",
  );
  if (installed?.value !== record.restoreId)
    throw new Error('The installed wallet does not match its recovery journal.');
  const integrity = await database.getFirstAsync<{ quick_check: string }>('PRAGMA quick_check');
  if (integrity?.quick_check !== 'ok')
    throw new Error('The installed wallet failed its integrity check.');
}

export const fileRestoreJournal = new FileRestoreJournal({
  async read() {
    const encoded = await SecureStore.getItemAsync(JOURNAL_KEY);
    if (!encoded) return null;
    try {
      const record: FileRestoreRecord = JSON.parse(encoded);
      if (
        !['preparing', 'ready', 'installing', 'installed', 'committed', 'rolledBack'].includes(
          record.phase,
        ) ||
        !['merge', 'replace', 'new'].includes(record.mode) ||
        typeof record.restoreId !== 'string' ||
        !record.restoreId ||
        typeof record.mnemonic !== 'string' ||
        !(record.previousMnemonic === null || typeof record.previousMnemonic === 'string') ||
        !(record.onboarded === null || typeof record.onboarded === 'string')
      )
        throw new Error();
      return record;
    } catch {
      throw new Error('Wallet restore recovery information is unavailable.');
    }
  },
  write: (record) => SecureStore.setItemAsync(JOURNAL_KEY, JSON.stringify(record)),
  removeJournal: () => SecureStore.deleteItemAsync(JOURNAL_KEY),
  async copy(source, target) {
    if (source === target) throw new Error('A restore cannot replace its own source.');
    closeDb(true);
    if (!walletDatabaseExists(fileRestoreDatabaseNames[source]))
      throw new Error('A wallet recovery database is missing.');
    const from = openEncryptedDatabase(fileRestoreDatabaseNames[source]);
    try {
      await verifyEncryptedDatabase(from);
      // The source is validated first. Recreate the destination so an interrupted,
      // unreadable install cannot prevent rollback from the preserved original.
      removeWalletDatabase(fileRestoreDatabaseNames[target]);
      const to = openEncryptedDatabase(fileRestoreDatabaseNames[target]);
      try {
        await SQLite.backupDatabaseAsync({ sourceDatabase: from, destDatabase: to });
      } finally {
        await to.closeAsync();
      }
    } finally {
      await from.closeAsync();
    }
  },
  async remove(database) {
    if (database === 'active') closeDb(true);
    removeWalletDatabase(fileRestoreDatabaseNames[database]);
  },
  saveMnemonic: (mnemonic) =>
    mnemonic === null ? seedService.clearWallet() : seedService.saveMnemonic(mnemonic),
  saveOnboarding: (value) =>
    value === null
      ? SecureStore.deleteItemAsync(ONBOARDING_KEY)
      : SecureStore.setItemAsync(ONBOARDING_KEY, value),
});
