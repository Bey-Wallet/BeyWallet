import { seedService } from '~/services/platform/seedService';

/** Reclaim through the existing receive boundary; a deadline adds a refund path. */
export async function reclaimPayment(
  token: string,
  metadata: { reclaimAt?: number; refundPubkey?: string } = {},
): Promise<'reclaimed' | 'claimed'> {
  const { walletService } = require('./walletService') as typeof import('./walletService');
  const { proofService } = require('./proofService') as typeof import('./proofService');
  const { decodeToken, cleanToken } = require('./tokenUtils') as typeof import('./tokenUtils');
  if (
    metadata.reclaimAt != null &&
    (!Number.isFinite(metadata.reclaimAt) || Date.now() < metadata.reclaimAt)
  )
    throw new Error('Reclaim deadline has not arrived');
  const states = await proofService.checkProofStates(token);
  if (!states.length || states.length !== decodeToken(cleanToken(token)).proofs.length)
    throw new Error('Could not verify all proofs');
  if (states.every((s) => s.state === 'SPENT')) return 'claimed';
  if (!states.every((s) => s.state === 'UNSPENT'))
    throw new Error('Some proofs are pending or spent. Refresh the payment status.');
  if (metadata.reclaimAt != null) {
    const mnemonic = await seedService.getMnemonic();
    if (!mnemonic) throw new Error('Wallet identity unavailable');
    const keys = await seedService.getNostrKeys(mnemonic);
    if (metadata.refundPubkey !== '02' + keys.pubkey)
      throw new Error('Refund key does not match this wallet');
    await walletService.receiveP2PK(token, keys.privkey);
  } else {
    await walletService.receive(token);
  }
  return 'reclaimed';
}
