import { MemoryProofRepository, ProofService } from 'coco-cashu-core';
import type { CoreProof } from 'coco-cashu-core';

const mint = 'https://mint.example';

async function harness() {
  const repository = new MemoryProofRepository();
  const proofs = [
    { amount: 64, secret: 'synthetic-reserved' },
    { amount: 16, secret: 'synthetic-available' },
  ].map((proof) => ({
    ...proof,
    id: 'keyset',
    C: 'synthetic',
    mintUrl: mint,
    state: 'ready',
  })) as CoreProof[];
  await repository.saveProofs(mint, proofs);
  await repository.reserveProofs(mint, ['synthetic-reserved'], 'previous-operation');
  const select = jest.fn((available: CoreProof[], amount: number) => ({
    send: available.filter((proof) => proof.amount >= amount).slice(0, 1),
    keep: [],
  }));
  const service = new ProofService(
    {} as any,
    repository,
    { getWallet: async () => ({ selectProofsToSend: select }) } as any,
    {} as any,
    {} as any,
    {} as any,
  );
  return { repository, service, select };
}

it('selects and reserves available coins without touching another operation reservation', async () => {
  const { repository, service, select } = await harness();
  const selected = await service.selectProofsToSend(mint, 8, true);
  expect(selected.map((proof) => proof.secret)).toEqual(['synthetic-available']);
  expect(select).toHaveBeenCalledWith(
    [expect.objectContaining({ secret: 'synthetic-available' })],
    8,
    true,
  );
  await repository.reserveProofs(
    mint,
    selected.map((proof) => proof.secret),
    'new-operation',
  );
  expect((await repository.getProofBySecret(mint, 'synthetic-reserved'))?.usedByOperationId).toBe(
    'previous-operation',
  );
});

it('rejects an amount covered only by reserved funds before wallet selection', async () => {
  const { repository, service, select } = await harness();
  await expect(service.selectProofsToSend(mint, 32, false)).rejects.toThrow('Not enough proofs');
  expect(select).not.toHaveBeenCalled();
  expect((await repository.getProofBySecret(mint, 'synthetic-reserved'))?.usedByOperationId).toBe(
    'previous-operation',
  );
});
