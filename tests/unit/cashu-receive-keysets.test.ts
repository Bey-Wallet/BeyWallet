import { getEncodedTokenV3, getEncodedTokenV4 } from '@cashu/cashu-ts';
import { refreshReceiveKeysets } from '~/services/wallet/cashuReceiveKeysets';

const fullId = '01' + 'ab'.repeat(32);
const previousId = '01' + 'cd'.repeat(32);
const makeToken = (id = fullId) => ({
  mint: 'https://mint.example',
  unit: 'sat',
  proofs: [{ id, amount: 1, secret: 'synthetic-only', C: '02' + '11'.repeat(32) }],
});

function harness() {
  const current = { id: fullId, unit: 'sat', active: true };
  const historical = {
    mintUrl: 'https://mint.example',
    id: previousId,
    unit: 'sat',
    active: true,
    feePpk: 0,
  };
  const getKeySets = jest.fn(async () => ({ keysets: [current] }));
  const refreshWallet = jest.fn(async () => ({}));
  const repository = {
    getKeysetsByMintUrl: jest.fn(async () => [historical]),
    updateKeyset: jest.fn(async () => {}),
  };
  const manager = {
    mint: { isTrustedMint: jest.fn(async () => true) },
    walletService: { getWallet: jest.fn(async () => ({ mint: { getKeySets } })), refreshWallet },
  };
  const refresh = (token = getEncodedTokenV4(makeToken())) =>
    refreshReceiveKeysets(manager as any, repository as any, 'https://mint.example', token);
  return { manager, repository, getKeySets, refreshWallet, refresh, current, historical };
}

it('deactivates removed cached output keysets and resolves V4 against the current full ID', async () => {
  const { refresh, repository, historical, refreshWallet } = harness();
  await refresh();
  expect(repository.updateKeyset).toHaveBeenCalledWith({ ...historical, active: false });
  expect(refreshWallet).toHaveBeenCalledWith('https://mint.example');
});

it('allows inactive but still advertised input keysets', async () => {
  const { refresh, getKeySets, repository, current } = harness();
  getKeySets.mockResolvedValue({
    keysets: [current, { id: previousId, unit: 'sat', active: false }],
  });
  await refresh(getEncodedTokenV4(makeToken(previousId)));
  expect(repository.updateKeyset).not.toHaveBeenCalled();
});

it('rejects obsolete V3 and V4 input keysets even if they remain cached', async () => {
  const { refresh } = harness();
  await expect(refresh(getEncodedTokenV4(makeToken(previousId)))).rejects.toThrow('Unknown Keyset');
  await expect(refresh(getEncodedTokenV3(makeToken(previousId)))).rejects.toThrow('Unknown Keyset');
});

it('never contacts an untrusted mint', async () => {
  const { refresh, manager, getKeySets } = harness();
  manager.mint.isTrustedMint.mockResolvedValue(false);
  await expect(refresh()).rejects.toThrow('not trusted');
  expect(getKeySets).not.toHaveBeenCalled();
});

it('does not alter cache metadata if the authoritative list fails or is unusable', async () => {
  const { refresh, getKeySets, repository } = harness();
  getKeySets.mockRejectedValueOnce(new Error('network unavailable'));
  await expect(refresh()).rejects.toThrow('network unavailable');
  getKeySets.mockResolvedValueOnce({ keysets: [] });
  await expect(refresh()).rejects.toThrow('no active sat');
  expect(repository.updateKeyset).not.toHaveBeenCalled();
});

it('rejects ambiguous compact IDs instead of choosing a cached match', async () => {
  const { refresh, getKeySets, current } = harness();
  getKeySets.mockResolvedValue({
    keysets: [current, { ...current, id: fullId.slice(0, 16) + 'ef'.repeat(25) }],
  });
  await expect(refresh()).rejects.toThrow('not uniquely advertised');
});

it('preserves Coco keyset verification failures', async () => {
  const { refresh, refreshWallet } = harness();
  refreshWallet.mockRejectedValueOnce(new Error('Keyset verification failed'));
  await expect(refresh()).rejects.toThrow('Keyset verification failed');
});
