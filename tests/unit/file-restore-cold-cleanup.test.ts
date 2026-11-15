import { initService } from '~/services/wallet/initService';
import { closeDb } from '~/storage/sqlite/sqliteStorage';

const mockRelease = jest.fn();
const mockDrain = jest.fn(async () => {});
jest.mock('~/services/wallet/recoveryCoordinator', () => ({
  recoveryCoordinator: {
    beginLifecycle: () => mockRelease,
    drainBackground: () => mockDrain(),
  },
}));
jest.mock('~/storage/sqlite/sqliteStorage', () => ({
  closeDb: jest.fn(),
  invalidateWalletSnapshot: jest.fn(),
}));
jest.mock('coco-cashu-core', () => ({ Manager: jest.fn() }));
jest.mock('~/storage/sqlite', () => ({ ExpoSqliteRepositories: jest.fn() }));
jest.mock('~/services/platform/seedService', () => ({ seedService: {} }));
jest.mock('~/services/wallet/nostrService', () => ({ nostrService: { stop: jest.fn() } }));
jest.mock('@cashu/cashu-ts', () => ({
  Keyset: class {
    verify() {
      return true;
    }
  },
}));
// First-run cleanup must not need these running-wallet integrations at all.
jest.mock('~/services/wallet/lightningAddressLifecycle', () => {
  throw new Error('Cold restore loaded network services');
});

beforeEach(() => jest.clearAllMocks());

it('drains and closes the first-run database without importing wallet network lifecycles', async () => {
  await initService.cleanup({ strict: true });
  expect(mockDrain).toHaveBeenCalledTimes(1);
  expect(closeDb).toHaveBeenCalledWith(true);
  expect(mockRelease).toHaveBeenCalledTimes(1);
});

it('releases the lifecycle lock and fails closed if the first-run database cannot close', async () => {
  jest.mocked(closeDb).mockImplementationOnce(() => {
    throw new Error('Busy database');
  });
  await expect(initService.cleanup({ strict: true })).rejects.toThrow('Busy database');
  expect(mockRelease).toHaveBeenCalledTimes(1);
});
