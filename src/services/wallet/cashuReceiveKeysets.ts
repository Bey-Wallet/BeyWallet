import type { KeysetRepository, Manager, WalletService } from 'coco-cashu-core';
import { getDecodedToken } from 'coco-cashu-core';

/** Reconcile rotation without deleting keys or proofs belonging to historical keysets. */
export async function refreshReceiveKeysets(
  manager: Manager,
  repository: KeysetRepository,
  mintUrl: string,
  token: string,
): Promise<void> {
  if (!(await manager.mint.isTrustedMint(mintUrl))) {
    throw new Error('Mint is not trusted. Please add and trust the mint first.');
  }
  const service = (manager as unknown as { walletService: WalletService }).walletService;
  const wallet = await service.getWallet(mintUrl);
  const { keysets } = await wallet.mint.getKeySets();
  if (
    !Array.isArray(keysets) ||
    !keysets.some((keyset) => keyset.active && keyset.unit === 'sat')
  ) {
    throw new Error('The mint has no active sat keyset. Try again after the mint is available.');
  }
  const current = new Map(keysets.map((keyset) => [keyset.id, keyset]));
  const cached = await repository.getKeysetsByMintUrl(mintUrl);
  for (const keyset of cached) {
    // Coco updates advertised IDs, but never deactivates entries absent from /v1/keysets.
    if (keyset.active && !current.has(keyset.id)) {
      await repository.updateKeyset({
        mintUrl: keyset.mintUrl,
        id: keyset.id,
        unit: keyset.unit,
        active: false,
        feePpk: keyset.feePpk,
      });
    }
  }
  // Refresh through Coco so key loading and cryptographic keyset validation still apply.
  await service.refreshWallet(mintUrl);
  // Resolve compact IDs only against the mint's advertised list, never historical cache rows.
  let decoded;
  try {
    decoded = getDecodedToken(
      token,
      keysets.map((keyset) => keyset.id),
    );
  } catch (error) {
    if (error instanceof Error && /map short|short keyset|ambiguous/i.test(error.message)) {
      throw new Error('Unknown Keyset: token keyset is not uniquely advertised by its mint');
    }
    throw error;
  }
  if (decoded.unit !== 'sat') throw new Error('Only sat-denominated tokens are supported.');
  if (decoded.proofs.some((proof) => !current.has(proof.id))) {
    throw new Error('Unknown Keyset: token keyset is not advertised by its mint');
  }
  if (decoded.proofs.some((proof) => current.get(proof.id)?.unit !== decoded.unit)) {
    throw new Error('Token proof keysets do not match its currency unit.');
  }
}
