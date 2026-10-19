import { useMintBackupStore } from '~/state/mintBackupStore';
import { mintManager } from './mintManager';
import { walletService } from './walletService';
import { nostrService } from './nostrService';
import { seedService } from '~/services/platform/seedService';
import { networkService } from '~/services/platform/networkService';

export type MintBackupResult = 'published' | 'disabled' | 'offline' | 'empty' | 'failed';
let pending: Promise<MintBackupResult> | null = null;
let generation = 0;

export function resetMintBackup() {
  generation++;
  pending = null;
}

export function publishMintBackup(automatic = false): Promise<MintBackupResult> {
  if (automatic && !useMintBackupStore.getState().automatic) return Promise.resolve('disabled');
  if (pending) return pending;
  const current = generation;
  const publish = async (): Promise<MintBackupResult> => {
    try {
      if (await networkService.isOffline()) return 'offline';
      if (current !== generation) return 'failed';
      useMintBackupStore.setState({ publishing: true });
      const trusted = await mintManager.getAllTrustedMints();
      const balances = await walletService.getBalances();
      const urls = [
        ...new Set([
          ...trusted.map((mint) => mint.mintUrl),
          ...Object.entries(balances)
            .filter(([, amount]) => amount > 0)
            .map(([url]) => url),
        ]),
      ];
      if (!urls.length) return 'empty';
      const mnemonic = await seedService.getMnemonic();
      if (!mnemonic || current !== generation) return 'failed';
      const keys = await seedService.getNostrKeys(mnemonic);
      if (current !== generation) return 'failed';
      if (automatic && !useMintBackupStore.getState().automatic) return 'disabled';
      useMintBackupStore.setState({ lastAttemptAt: Date.now() });
      const acknowledged = await nostrService.backupMintsToNostr(urls, keys.privkey, keys.pubkey);
      if (current !== generation) return 'failed';
      if (!acknowledged) return 'failed';
      useMintBackupStore.setState({
        lastPublishedAt: Date.now(),
        lastPublishedMintCount: urls.length,
      });
      return 'published';
    } catch {
      return 'failed';
    } finally {
      if (current === generation) useMintBackupStore.setState({ publishing: false });
    }
  };
  const job = publish();
  pending = job;
  void job.finally(() => {
    if (pending === job) pending = null;
  });
  return job;
}
