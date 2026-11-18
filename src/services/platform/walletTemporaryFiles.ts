import * as FileSystem from 'expo-file-system/legacy';

const walletFile = /^(bey_wallet_backup_|bey_cashu_proofs_|bey-receipt-)/;

/** App-private temporary copies only. Never follow saved SAF/Downloads directory grants. */
export async function clearWalletTemporaryFiles(): Promise<void> {
  for (const root of [FileSystem.cacheDirectory, FileSystem.documentDirectory]) {
    if (!root) continue;
    if (!(await FileSystem.getInfoAsync(root)).exists) continue;
    const entries = await FileSystem.readDirectoryAsync(root);
    const targets = entries.filter(
      (name) =>
        walletFile.test(name) || (root === FileSystem.cacheDirectory && name === 'DocumentPicker'),
    );
    // Await every removal, including on failure, before callers release the deletion barrier.
    const results = await Promise.allSettled(
      targets.map((name) => {
        if (!name || name === '.' || name === '..' || /[\\/]/.test(name))
          throw new Error('Invalid temporary file path.');
        return FileSystem.deleteAsync(`${root}${name}`, { idempotent: true });
      }),
    );
    if (results.some((result) => result.status === 'rejected'))
      throw new Error('Temporary wallet files could not be removed. Retry deleting the wallet.');
  }
}
