import { nostrService } from './nostrService';
import { seedService } from '~/services/platform/seedService';
import { DEFAULT_MINT } from '~/state/constants';
import {
  recoveryCandidates,
  useRecoverySessionStore,
  updateRecoverySession,
} from '~/state/recoverySessionStore';

export function importRecoveryCandidates(file: string[], nostr: string[]) {
  const backedUp = recoveryCandidates([
    { urls: file, source: 'File backup' },
    { urls: nostr, source: 'Nostr backup' },
  ]);
  return backedUp.length
    ? backedUp
    : recoveryCandidates([
        { urls: [DEFAULT_MINT], source: 'Default' },
        { urls: ['https://mint.minibits.cash/Bitcoin'], source: 'Featured' },
      ]);
}

export async function retryRecoveryDiscovery() {
  const session = useRecoverySessionStore.getState().session;
  if (!session || session.phase !== 'review') return;
  try {
    const mnemonic = await seedService.getMnemonic();
    if (!mnemonic) throw new Error('Wallet unavailable');
    const { pubkey } = await seedService.getNostrKeys(mnemonic);
    if (pubkey !== session.walletId) return;
    const urls = await nostrService.fetchMintsFromNostr(pubkey, { throwOnFailure: true });
    if (useRecoverySessionStore.getState().session !== session) return;
    const candidates = importRecoveryCandidates(
      session.candidates.filter((c) => c.sources.includes('File backup')).map((c) => c.mintUrl),
      [
        ...session.candidates
          .filter((c) => c.sources.includes('Nostr backup'))
          .map((c) => c.mintUrl),
        ...urls,
      ],
    );
    updateRecoverySession({
      candidates,
      selected: candidates
        .filter(
          (c) =>
            session.selected.includes(c.mintUrl) ||
            !session.candidates.some((old) => old.mintUrl === c.mintUrl),
        )
        .map((c) => c.mintUrl),
      discoveryMessage: candidates.some((c) =>
        c.sources.some((source) => source.endsWith('backup')),
      )
        ? undefined
        : 'No backup found. Review the available mints.',
    });
  } catch {
    if (useRecoverySessionStore.getState().session === session)
      updateRecoverySession({ discoveryMessage: 'Backup discovery failed. You can retry.' });
  }
}
