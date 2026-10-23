import { proofService } from '~/services/wallet/proofService';

const mockCheck = jest.fn();
jest.mock('@cashu/cashu-ts', () => ({
  Wallet: jest.fn().mockImplementation(() => ({ checkProofsStates: mockCheck })),
}));
jest.mock('~/services/wallet/initService', () => ({ initService: {} }));
jest.mock('~/services/wallet/tokenUtils', () => ({
  cleanToken: (value: string) => value.replace(/^cashu:/, ''),
  decodeToken: (value: string) => ({ mint: 'https://mint.test', proofs: [{ secret: value }] }),
}));

beforeEach(() => jest.clearAllMocks());

it('shares an in-flight poll with reclaim but never reuses a completed response', async () => {
  let resolve!: (value: unknown[]) => void;
  mockCheck.mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const poll = proofService.checkProofStates('synthetic');
  const reclaim = proofService.checkProofStates('cashu:synthetic');
  expect(poll).toBe(reclaim);
  expect(mockCheck).toHaveBeenCalledTimes(1);
  resolve([{ state: 'UNSPENT' }]);
  await expect(reclaim).resolves.toEqual([{ state: 'UNSPENT', secret: 'synthetic' }]);
  mockCheck.mockResolvedValueOnce([{ state: 'SPENT' }]);
  await expect(proofService.checkProofStates('synthetic')).resolves.toEqual([
    { state: 'SPENT', secret: 'synthetic' },
  ]);
  expect(mockCheck).toHaveBeenCalledTimes(2);
});

it('does not combine different tokens', async () => {
  mockCheck.mockResolvedValue([{ state: 'UNSPENT' }]);
  await Promise.all([
    proofService.checkProofStates('first'),
    proofService.checkProofStates('second'),
  ]);
  expect(mockCheck).toHaveBeenCalledTimes(2);
});

it('allows a fresh check after a failed network request', async () => {
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    mockCheck.mockRejectedValueOnce(new Error('Network unavailable'));
    await expect(proofService.checkProofStates('retry')).resolves.toEqual([]);
    mockCheck.mockResolvedValueOnce([{ state: 'UNSPENT' }]);
    await expect(proofService.checkProofStates('retry')).resolves.toHaveLength(1);
    expect(mockCheck).toHaveBeenCalledTimes(2);
  } finally {
    error.mockRestore();
  }
});
