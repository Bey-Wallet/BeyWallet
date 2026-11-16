import { openEncryptedDatabase } from '~/storage/sqlite/encryptedDatabase';
import * as SecureStore from 'expo-secure-store';
import { randomUUID } from 'expo-crypto';
import { Wallet, hashToCurve } from '@cashu/cashu-ts';
import { ExpoSqliteRepositories } from '~/storage/sqlite';
import { getDb } from '~/storage/sqlite/sqliteStorage';
import { fileRestoreJournal, fileRestoreDatabaseNames } from '~/storage/sqlite/fileRestoreStorage';
import { seedService } from '~/services/platform/seedService';
import { biometricService } from '~/services/platform/biometricService';
import { useFileRestoreStore, type FileRestorePreview } from '~/state/fileRestoreStore';
import { recoveryCoordinator } from './recoveryCoordinator';
import { parseWalletBackup, sameBackupIdentity, type WalletBackup } from './walletBackup';
import { backupService } from './backupService';
import { readFileRestorePreview } from './fileRestorePreview';

let releaseLifecycle: (() => void) | undefined;
let working = false;
const unavailable = 'Restore could not finish. Your previous wallet is preserved. Retry or cancel.';
const preparationFailures = {
  preflight: 'Could not prepare wallet restore. Wait for wallet operations to finish and retry.',
  cleanup: 'Could not pause wallet services. Close and reopen the app, then retry.',
  snapshot:
    'Could not save the wallet recovery snapshot. Check available device storage and retry.',
  open: 'Could not open the temporary restore database. Close and reopen the app, then retry.',
  schema:
    'Could not prepare the temporary restore database. Check available device storage and retry.',
  proofs: 'Could not verify backup funds with the mints. Check your connection and retry.',
  records: 'The backup records could not be imported. Check that this is a supported Bey backup.',
  integrity:
    'The restored backup could not pass its database checks. Choose another backup or retry.',
  ready: 'Could not save restore progress. Check available device storage and retry.',
} as const;

/** Only fresh proofs are checked; existing reserved/spent proofs must never be revived. */
export async function verifyBackupProofs(
  backup: WalletBackup,
  repo: ExpoSqliteRepositories,
  skipExisting = true,
) {
  const verified: WalletBackup['proofs'] = [];
  const groups = new Map<string, any[]>();
  for (const proof of backup.proofs) {
    if (
      skipExisting &&
      (await repo.db.get('SELECT 1 FROM coco_cashu_proofs WHERE mintUrl = ? AND secret = ?', [
        proof.mintUrl,
        proof.secret,
      ]))
    )
      continue;
    if (proof.state === 'spent') {
      verified.push(proof);
      continue;
    }
    const proofs = groups.get(proof.mintUrl) ?? [];
    proofs.push(proof);
    groups.set(proof.mintUrl, proofs);
  }
  for (const [mintUrl, proofs] of groups) {
    const wallet = new Wallet(mintUrl);
    for (let start = 0; start < proofs.length; start += 100) {
      const batch = proofs.slice(start, start + 100);
      const states = await wallet.checkProofsStates(batch);
      const byY = new Map(states.map((state) => [state.Y, state.state]));
      if (states.length !== batch.length || byY.size !== batch.length)
        throw new Error('Could not verify every restored proof. Reconnect and retry.');
      for (const proof of batch) {
        const state = byY.get(hashToCurve(new TextEncoder().encode(proof.secret)).toHex(true));
        if (!state || !['UNSPENT', 'SPENT', 'PENDING'].includes(state))
          throw new Error('Invalid restored proof state.');
        // A locally finalized input remains spent even if an old backup says ready.
        const completed =
          proof.usedByOperationId &&
          (await repo.db.get(
            `SELECT 1 FROM coco_cashu_send_operations WHERE id = ? AND state = 'finalized'
           UNION ALL SELECT 1 FROM coco_cashu_melt_operations WHERE id = ? AND state = 'finalized'`,
            [proof.usedByOperationId, proof.usedByOperationId],
          ));
        verified.push({
          ...proof,
          state:
            proof.state === 'spent' || state === 'SPENT' || completed
              ? 'spent'
              : state === 'PENDING' || proof.state === 'inflight' || proof.usedByOperationId
                ? 'inflight'
                : 'ready',
        });
      }
    }
  }
  return { ...backup, proofs: verified };
}

export const fileRestoreService = {
  async recoverOnStartup(): Promise<boolean> {
    try {
      if (await fileRestoreJournal.recover()) {
        useFileRestoreStore.setState({ phase: 'restart', error: null });
        return false;
      }
      const record = await fileRestoreJournal.io.read();
      let preview: FileRestorePreview | null = null;
      if (record?.phase === 'ready' || record?.phase === 'installed') {
        const raw = openEncryptedDatabase(fileRestoreDatabaseNames.staged);
        try {
          preview = await readFileRestorePreview(new ExpoSqliteRepositories({ database: raw }).db);
        } finally {
          await raw.closeAsync();
        }
      }
      if (record?.phase === 'ready') {
        releaseLifecycle ??= recoveryCoordinator.beginLifecycle();
        useFileRestoreStore.setState({ phase: 'ready', mode: record.mode, error: null, preview });
      } else useFileRestoreStore.setState({ phase: 'idle', mode: null, error: null, preview });
      // Installed-wallet initialization owns validation/rollback if its database cannot open.
      return record?.phase === 'installed';
    } catch {
      useFileRestoreStore.setState({
        phase: 'error',
        error: 'Wallet recovery could not be opened. Retry recovery before using your wallet.',
      });
      return false;
    }
  },

  async prepare(value: unknown) {
    if (working || useFileRestoreStore.getState().phase !== 'idle')
      throw new Error('Finish the current restore first.');
    const backup = parseWalletBackup(value);
    working = true;
    let stopped = false;
    let stage: keyof typeof preparationFailures = 'preflight';
    try {
      const previousMnemonic = await seedService.getMnemonic();
      const mode = previousMnemonic
        ? sameBackupIdentity(previousMnemonic, backup.mnemonic)
          ? 'merge'
          : 'replace'
        : 'new';
      const { useWalletStore } =
        require('~/state/walletStore') as typeof import('~/state/walletStore');
      if (useWalletStore.getState().isRestoring)
        throw new Error('Wait for wallet recovery to finish.');
      releaseLifecycle = recoveryCoordinator.beginLifecycle();
      const { initService } = require('./initService') as typeof import('./initService');
      if (initService.isInitialized()) {
        const active = initService.getRepo().db;
        const running =
          await active.get(`SELECT 1 FROM coco_cashu_send_operations WHERE state IN ('executing', 'rolling_back')
          UNION ALL SELECT 1 FROM coco_cashu_melt_operations WHERE state IN ('executing', 'rolling_back') LIMIT 1`);
        if (running) throw new Error('Wait for the active wallet payment to finish.');
      }
      useFileRestoreStore.setState({ phase: 'preparing', mode, error: null, preview: null });
      // Stop/drain the old runtime before taking its coherent snapshot.
      stopped = true;
      stage = 'cleanup';
      await initService.cleanup({ strict: true });
      stage = 'snapshot';
      getDb(); // A first-run restore also needs an empty original database for rollback.
      const restoreId = randomUUID();
      await fileRestoreJournal.begin({
        restoreId,
        mode,
        previousMnemonic,
        mnemonic: backup.mnemonic,
        onboarded: await SecureStore.getItemAsync('bey_wallet_onboarded'),
      });
      stage = 'open';
      const raw = openEncryptedDatabase(fileRestoreDatabaseNames.staged);
      let preview: FileRestorePreview | null = null;
      try {
        const repo = new ExpoSqliteRepositories({ database: raw });
        stage = 'schema';
        await repo.init();
        stage = 'proofs';
        const checked = await verifyBackupProofs(backup, repo);
        stage = 'records';
        await backupService.importState(checked, repo.db);
        const untrackedProof = await repo.db.get(`SELECT 1 FROM coco_cashu_proofs p
          LEFT JOIN coco_cashu_mints m ON m.mintUrl = p.mintUrl WHERE m.mintUrl IS NULL LIMIT 1`);
        if (untrackedProof) throw new Error('A restored proof has no mint record.');
        if (mode !== 'merge') {
          await repo.settingsRepository.setSetting('theme', backup.theme);
          await repo.settingsRepository.setSetting('secondaryCurrency', backup.secondaryCurrency);
        }
        await repo.settingsRepository.setSetting('fileRestoreId', restoreId);
        stage = 'integrity';
        const integrity = await raw.getFirstAsync<{ quick_check: string }>('PRAGMA quick_check');
        if (integrity?.quick_check !== 'ok') throw new Error('Backup database validation failed.');
        preview = await readFileRestorePreview(repo.db);
      } finally {
        await raw.closeAsync();
      }
      stage = 'ready';
      await fileRestoreJournal.ready();
      useFileRestoreStore.setState({ phase: 'ready', preview });
    } catch {
      // Fixed stage codes only: native exceptions can contain SQL values or bearer data.
      console.warn('[FileRestore] Preparation failed at stage:', stage);
      if (!stopped) {
        releaseLifecycle?.();
        releaseLifecycle = undefined;
        throw new Error('Wait for wallet operations to finish, then retry the backup restore.');
      }
      // Preparing never changes the active wallet. Retain the journal if cleanup fails.
      try {
        await fileRestoreJournal.rollback();
      } catch {
        useFileRestoreStore.setState({ phase: 'error', error: unavailable });
        return;
      }
      useFileRestoreStore.setState({
        phase: 'restart',
        error: `${preparationFailures[stage]} No wallet data was replaced.`,
      });
    } finally {
      working = false;
    }
  },

  async finish() {
    if (working || useFileRestoreStore.getState().phase !== 'ready') return;
    working = true;
    useFileRestoreStore.setState({ phase: 'installing', error: null });
    try {
      const record = await fileRestoreJournal.io.read();
      if (
        record?.previousMnemonic &&
        !(await biometricService.authenticateAsync('Authenticate to finish wallet restore'))
      ) {
        useFileRestoreStore.setState({ phase: 'ready' });
        return;
      }
      // A staged restore can survive for days. Recheck before activation, including on resume.
      const raw = openEncryptedDatabase(fileRestoreDatabaseNames.staged);
      try {
        const repo = new ExpoSqliteRepositories({ database: raw });
        const state = await backupService.exportState(repo.db);
        const checked = await verifyBackupProofs({ ...state } as WalletBackup, repo, false);
        await repo.db.transaction(async (db) => {
          for (const proof of checked.proofs)
            await db.run(
              'UPDATE coco_cashu_proofs SET state = ? WHERE mintUrl = ? AND secret = ?',
              [proof.state, proof.mintUrl, proof.secret],
            );
        });
      } finally {
        await raw.closeAsync();
      }
      await fileRestoreJournal.install();
      // Restart before opening the new identity: discard every query/store/runtime cache.
      useFileRestoreStore.setState({ phase: 'restart' });
    } catch {
      try {
        await fileRestoreJournal.rollback();
        useFileRestoreStore.setState({
          phase: 'restart',
          error: 'Restore was interrupted. Your previous wallet has been recovered.',
        });
      } catch {
        useFileRestoreStore.setState({ phase: 'error', error: unavailable });
      }
    } finally {
      working = false;
    }
  },

  async cancel() {
    if (working || useFileRestoreStore.getState().phase !== 'ready') return;
    working = true;
    try {
      await fileRestoreJournal.rollback();
      useFileRestoreStore.setState({ phase: 'restart', error: null });
    } catch {
      useFileRestoreStore.setState({ phase: 'error', error: unavailable });
    } finally {
      working = false;
    }
  },
};
