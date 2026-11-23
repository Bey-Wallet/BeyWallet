import { createAppLogger, safeLogFields } from '~/shared/utils/appLogger';
import {
  clearDiagnosticFailures,
  getDiagnosticFailures,
} from '~/services/feedback/diagnosticFailures';

beforeEach(() => clearDiagnosticFailures());

it('keeps development checkpoints out of release output and rejects non-allowlisted messages', () => {
  const output = jest.fn();
  let development = false;
  const log = createAppLogger({ development: () => development, output });
  log.debug('[Coco] Wallet operation warning.');
  log.error('synthetic-private-bearer-material' as any);
  expect(output).not.toHaveBeenCalled();
  development = true;
  log.debug('[Coco] Wallet operation warning.');
  expect(output).toHaveBeenCalledWith('debug', '[Coco] Wallet operation warning.');
});

it('never forwards raw error messages, stacks, keys, tokens, proofs or custom serialization', () => {
  const secret = 'synthetic-private-bearer-material';
  const output = jest.fn();
  const log = createAppLogger({ development: () => false, output });
  const error = Object.assign(new Error(secret), {
    name: 'HttpResponseError',
    code: 20001,
    status: 503,
    durationMs: 123,
    mnemonic: secret,
    nsec: secret,
    proofs: [{ secret }],
    token: secret,
    cause: new Error(secret),
    toJSON: () => {
      throw new Error('must not serialize');
    },
  });
  log.error('[Coco] Wallet operation failed.', error, 'wallet_sdk');
  expect(output).toHaveBeenCalledWith('error', '[Coco] Wallet operation failed.', {
    type: 'HttpResponseError',
    code: 20001,
    status: 503,
    durationMs: 123,
  });
  expect(JSON.stringify(output.mock.calls)).not.toContain(secret);
  expect(JSON.stringify(getDiagnosticFailures())).not.toContain(secret);
});

it('does not invoke getters or arbitrary error names and rejects malformed numeric fields', () => {
  const get = jest.fn(() => {
    throw new Error('must not inspect');
  });
  const error = Object.defineProperties(
    {},
    Object.fromEntries(
      ['name', 'type', 'code', 'status', 'message', 'stack', 'durationMs', 'elapsedMs'].map(
        (key) => [key, { get }],
      ),
    ),
  );
  expect(safeLogFields(error)).toEqual({ type: 'Error' });
  expect(get).not.toHaveBeenCalled();
  expect(safeLogFields(new TypeError('synthetic-private'))).toEqual({ type: 'TypeError' });
  expect(safeLogFields(new RangeError('synthetic-private'))).toEqual({ type: 'RangeError' });
  expect(
    safeLogFields({ name: 'synthetic-secret', code: -1, status: 900, durationMs: Infinity }),
  ).toEqual({ type: 'Error' });
  expect(safeLogFields(new Proxy({}, { getOwnPropertyDescriptor: get }))).toEqual({
    type: 'Error',
  });
});

it('rate-limits repeated console failures while retaining diagnostic occurrences and resets with the wallet', () => {
  const output = jest.fn();
  let at = 100;
  const log = createAppLogger({ development: () => false, output, now: () => at });
  log.warn('[Coco] Wallet operation warning.', new Error('fixture'), 'wallet_sdk');
  log.warn('[Coco] Wallet operation warning.', new Error('fixture'), 'wallet_sdk');
  expect(output).toHaveBeenCalledTimes(1);
  expect(getDiagnosticFailures()[0].count).toBe(2);
  at += 30_000;
  log.warn('[Coco] Wallet operation warning.');
  expect(output).toHaveBeenCalledTimes(2);
  clearDiagnosticFailures();
  log.warn('[Coco] Wallet operation warning.');
  expect(output).toHaveBeenCalledTimes(3);
});

it('does not allow a broken logging transport to change operation behavior', () => {
  const log = createAppLogger({
    development: () => true,
    output: () => {
      throw new Error('transport failure');
    },
  });
  expect(() => log.error('[Coco] Wallet operation failed.')).not.toThrow();
  expect(() => log.debug('[Coco] Wallet operation warning.')).not.toThrow();
});

it('retains only fixed diagnostic hints and bounded timing in development metadata', () => {
  const output = jest.fn();
  const log = createAppLogger({ development: () => true, output });
  log.debug('[Coco] Wallet operation warning.', {
    hint: 'counter',
    durationMs: 42,
    token: 'synthetic-private',
  });
  expect(output).toHaveBeenCalledWith('debug', '[Coco] Wallet operation warning.', {
    type: 'Error',
    hint: 'counter',
    durationMs: 42,
  });
  expect(safeLogFields({ hint: 'synthetic-private' })).toEqual({ type: 'Error' });
  expect(JSON.stringify(output.mock.calls)).not.toContain('synthetic-private');
});
