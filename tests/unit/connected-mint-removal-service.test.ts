import { removeConnectedMints } from '~/services/wallet/connectedMintRemoval';

const mockRemove = jest.fn();
const mockRelease = jest.fn();
const mockDrain = jest.fn();
const mockEmit = jest.fn();
jest.mock('~/storage/sqlite/repositories/ConnectedMintRemovalRepository', () => ({
  ConnectedMintRemovalRepository: jest.fn(() => ({ removeIfEmpty: mockRemove })),
}));
jest.mock('~/services/wallet/initService', () => ({
  initService: { getRepo: () => ({ db: {} }) },
}));
jest.mock('~/services/wallet/recoveryCoordinator', () => ({
  recoveryCoordinator: { beginLifecycle: () => mockRelease, drainBackground: () => mockDrain() },
}));
jest.mock('~/services/wallet/plugins/ChangePreparationPlugin', () => ({
  getChangeServices: () => ({ eventBus: { emit: (...args: unknown[]) => mockEmit(...args) } }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockRemove.mockReset().mockResolvedValue(null);
  mockDrain.mockReset().mockResolvedValue(undefined);
  mockEmit.mockReset().mockResolvedValue(undefined);
});

it('removes each selected connection once and releases the lifecycle guard', async () => {
  expect(await removeConnectedMints(['https://one.example', 'https://one.example'])).toEqual({
    removed: ['https://one.example'],
    blocked: {},
  });
  expect(mockDrain).toHaveBeenCalledTimes(1);
  expect(mockRemove).toHaveBeenCalledTimes(1);
  expect(mockEmit).toHaveBeenCalledWith('mint:untrusted', { mintUrl: 'https://one.example' });
  expect(mockRelease).toHaveBeenCalledTimes(1);
});

it('keeps newly funded mints while removing other eligible selections', async () => {
  mockRemove.mockResolvedValueOnce('funds').mockResolvedValueOnce(null);
  expect(await removeConnectedMints(['https://funded.example', 'https://empty.example'])).toEqual({
    removed: ['https://empty.example'],
    blocked: { 'https://funded.example': 'funds' },
  });
  expect(mockEmit).toHaveBeenCalledTimes(1);
  expect(mockEmit).toHaveBeenCalledWith('mint:untrusted', { mintUrl: 'https://empty.example' });
});

it('keeps connections whose state cannot be verified', async () => {
  mockRemove.mockRejectedValueOnce(new Error('Database unavailable'));
  expect(await removeConnectedMints(['https://unknown.example'])).toEqual({
    removed: [],
    blocked: { 'https://unknown.example': 'unknown' },
  });
  expect(mockEmit).not.toHaveBeenCalled();
  expect(mockRelease).toHaveBeenCalledTimes(1);
});

it('does not mutate connections if background work cannot be drained', async () => {
  mockDrain.mockRejectedValueOnce(new Error('Busy'));
  await expect(removeConnectedMints(['https://one.example'])).rejects.toThrow('Busy');
  expect(mockRemove).not.toHaveBeenCalled();
  expect(mockRelease).toHaveBeenCalledTimes(1);
});
