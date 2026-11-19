import {
  clearDiagnosticFailures,
  getDiagnosticFailures,
  recordDiagnosticFailure,
  observeDiagnosticOperation,
} from '~/services/feedback/diagnosticFailures';

beforeEach(() => {
  clearDiagnosticFailures();
  jest.spyOn(Date, 'now').mockReturnValue(1700000000000);
});
afterEach(() => {
  jest.restoreAllMocks();
  clearDiagnosticFailures();
});

it('retains only operation, timing and allowlisted numeric fields without reading messages or getters', () => {
  const read = jest.fn(() => {
    throw new Error('Never read secrets');
  });
  const error = Object.defineProperties(
    {},
    {
      message: { get: read },
      stack: { get: read },
      proofs: { get: read },
      name: { value: 'private-name' },
      code: { value: 20006 },
      status: { value: 503 },
      invoice: { value: 'lnbc-private' },
    },
  );
  recordDiagnosticFailure('lightning_prepare', error, Date.now() - 500);
  expect(read).not.toHaveBeenCalled();
  expect(getDiagnosticFailures()).toEqual([
    {
      operation: 'lightning_prepare',
      at: Date.now(),
      durationMs: 500,
      type: 'Error',
      code: 20006,
      status: 503,
      count: 1,
    },
  ]);
  expect(JSON.stringify(getDiagnosticFailures())).not.toMatch(/lnbc|private/);
});

it('ignores unknown operations, getter-based codes and hostile proxies without interrupting the caller', () => {
  recordDiagnosticFailure('secret-operation' as any, {});
  expect(getDiagnosticFailures()).toHaveLength(0);
  const getter = jest.fn(() => 'secret');
  recordDiagnosticFailure('mint_quote', Object.defineProperty({}, 'code', { get: getter }));
  expect(getter).not.toHaveBeenCalled();
  expect(getDiagnosticFailures()[0].code).toBeUndefined();
  expect(() =>
    recordDiagnosticFailure(
      'mint_quote',
      new Proxy(
        {},
        {
          getOwnPropertyDescriptor() {
            throw new Error('hostile');
          },
        },
      ),
    ),
  ).not.toThrow();
});

it('uses fixed error classes without inspecting an error message', () => {
  recordDiagnosticFailure('lightning_prepare', new TypeError('nsec1-private'));
  expect(getDiagnosticFailures()[0].type).toBe('TypeError');
  expect(JSON.stringify(getDiagnosticFailures())).not.toContain('nsec1-private');
});

it('bounds session history, collapses repeated failures and returns detached snapshots', () => {
  for (let code = 0; code < 100; code++) recordDiagnosticFailure('mint_quote', { code });
  expect(getDiagnosticFailures()).toHaveLength(20);
  expect(getDiagnosticFailures()[0].code).toBe(80);
  recordDiagnosticFailure('mint_quote', { code: 99 });
  expect(getDiagnosticFailures().at(-1)?.count).toBe(2);
  const snapshot = getDiagnosticFailures();
  snapshot[0].operation = 'settings_action';
  expect(getDiagnosticFailures()[0].operation).toBe('mint_quote');
});

it('preserves results and the original error while dropping errors from work predating a reset', async () => {
  await expect(observeDiagnosticOperation('ecash_send', async () => 42)).resolves.toBe(42);
  const error = new Error('private-error');
  await expect(
    observeDiagnosticOperation('ecash_send', async () => {
      throw error;
    }),
  ).rejects.toBe(error);
  expect(getDiagnosticFailures()).toHaveLength(1);
  let reject!: (error: Error) => void;
  const pending = observeDiagnosticOperation(
    'ecash_send',
    () =>
      new Promise((_resolve, fail) => {
        reject = fail;
      }),
  );
  clearDiagnosticFailures();
  reject(error);
  await expect(pending).rejects.toBe(error);
  expect(getDiagnosticFailures()).toHaveLength(0);
});
