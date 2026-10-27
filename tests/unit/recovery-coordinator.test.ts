import { RecoveryCoordinator } from '~/services/wallet/recoveryCoordinator';

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

it('keeps slow recovery exclusive, deduplicates jobs and rejects manager replacement', async () => {
  const coordinator = new RecoveryCoordinator();
  const scan = deferred<string>();
  const first = jest.fn(() => scan.promise);
  const second = jest.fn(async () => 'second');
  const a = coordinator.enqueue('mint-a', first);
  expect(coordinator.enqueue('mint-a', first)).toBe(a);
  const b = coordinator.enqueue('mint-b', second);
  await jest.advanceTimersByTimeAsync(600_001);
  expect(first).toHaveBeenCalledTimes(1);
  expect(second).not.toHaveBeenCalled();
  expect(coordinator.paused).toBe(true);
  expect(() => coordinator.beginLifecycle()).toThrow('recovery');
  scan.resolve('first');
  await expect(a).resolves.toBe('first');
  await expect(b).resolves.toBe('second');
  expect(coordinator.paused).toBe(false);
});

it('drains submitted background work before recovery and keeps an onboarding pause', async () => {
  const coordinator = new RecoveryCoordinator();
  const claim = deferred();
  coordinator.registerDrain(() => claim.promise);
  const releaseImport = coordinator.pause();
  const scan = jest.fn(async () => 'complete');
  const job = coordinator.enqueue('mint', scan);
  await jest.advanceTimersByTimeAsync(0);
  expect(scan).not.toHaveBeenCalled();
  claim.resolve();
  await job;
  expect(coordinator.paused).toBe(true);
  releaseImport();
  expect(coordinator.paused).toBe(false);
});

it('defers maintenance and coalesces overlapping triggers into a trailing check', async () => {
  const coordinator = new RecoveryCoordinator();
  const release = coordinator.pause();
  const first = deferred();
  const check = jest
    .fn()
    .mockImplementationOnce(() => first.promise)
    .mockResolvedValue(undefined);
  const maintenance = coordinator.maintenance('proofs:a', check);
  await jest.advanceTimersByTimeAsync(0);
  expect(check).not.toHaveBeenCalled();
  release();
  await jest.advanceTimersByTimeAsync(0);
  expect(check).toHaveBeenCalledTimes(1);
  coordinator.maintenance('proofs:a', check);
  coordinator.maintenance('proofs:a', check);
  first.resolve();
  await jest.runAllTimersAsync();
  await maintenance;
  expect(check).toHaveBeenCalledTimes(2);
});

it('waits for active maintenance and releases failed jobs for retry', async () => {
  const coordinator = new RecoveryCoordinator();
  const check = deferred();
  const maintenance = coordinator.maintenance('proofs:a', () => check.promise);
  await jest.advanceTimersByTimeAsync(0);
  const scan = jest.fn(async () => {
    throw new Error('mint offline');
  });
  const job = coordinator.enqueue('a', scan);
  const rejection = expect(job).rejects.toThrow('offline');
  await jest.advanceTimersByTimeAsync(0);
  expect(scan).not.toHaveBeenCalled();
  check.resolve();
  await jest.runAllTimersAsync();
  await Promise.all([maintenance, rejection]);
  expect(coordinator.paused).toBe(false);
  await expect(coordinator.enqueue('a', async () => 'retry')).resolves.toBe('retry');
});

it('invalidates deferred maintenance when the wallet changes and blocks new scans during replacement', async () => {
  const coordinator = new RecoveryCoordinator();
  const resume = coordinator.pause();
  const oldMaintenance = jest.fn(async () => undefined);
  const old = coordinator.maintenance('old-wallet', oldMaintenance);
  const releaseLifecycle = coordinator.beginLifecycle();
  await expect(coordinator.enqueue('new', async () => undefined)).rejects.toThrow('changing');
  releaseLifecycle();
  resume();
  await old;
  expect(oldMaintenance).not.toHaveBeenCalled();
});

it('retains new-wallet maintenance for the same mint while invalidating the old callback', async () => {
  const coordinator = new RecoveryCoordinator();
  const release = coordinator.beginLifecycle();
  const oldCheck = jest.fn(async () => undefined);
  const pending = coordinator.maintenance('proofs:same-mint', oldCheck);
  const releaseNext = coordinator.beginLifecycle();
  const newCheck = jest.fn(async () => undefined);
  coordinator.maintenance('proofs:same-mint', newCheck);
  releaseNext();
  release();
  await jest.runAllTimersAsync();
  await pending;
  expect(oldCheck).not.toHaveBeenCalled();
  expect(newCheck).toHaveBeenCalledTimes(1);
});
