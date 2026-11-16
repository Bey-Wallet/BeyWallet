import { safeMintErrorCode, walletLogger } from '~/services/wallet/walletLogger';

let warning: jest.SpyInstance;
let failure: jest.SpyInstance;
beforeEach(() => {
  warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
  failure = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

it('never forwards SDK messages, exceptions, nested metadata or stacks to console', () => {
  const secret = 'synthetic-private-bearer-material';
  const error = Object.assign(new Error(secret), { proof: { secret }, cause: new Error(secret) });
  const metadata = { mnemonic: secret, nsec: secret, token: secret, proofs: [{ secret }] };
  walletLogger.error(`SDK failure: ${secret}`, error, metadata);
  walletLogger.warn(`SDK warning: ${secret}`, metadata);
  expect(failure).toHaveBeenCalledWith('[Coco] Wallet operation failed.');
  expect(warning).toHaveBeenCalledWith('[Coco] Wallet operation warning.');
  expect(JSON.stringify([...failure.mock.calls, ...warning.mock.calls])).not.toContain(secret);
});

it('does not evaluate or serialize untrusted metadata', () => {
  const metadata = {
    get secret() {
      throw new Error('must not read');
    },
    toJSON() {
      throw new Error('must not serialize');
    },
  };
  expect(() => walletLogger.error('failure', metadata)).not.toThrow();
  expect(failure).toHaveBeenCalledWith('[Coco] Wallet operation failed.');
});

it('retains the existing suppression of expected background errors', () => {
  walletLogger.error('WS error', { secret: 'fixture' });
  walletLogger.error('Keyset restore failed', { secret: 'fixture' });
  walletLogger.warn('Polling task error', { secret: 'fixture' });
  expect(failure).not.toHaveBeenCalled();
  expect(warning).not.toHaveBeenCalled();
});

it('reports mint refresh failures without forwarding the supplied URL or metadata', () => {
  walletLogger.error('Failed to fetch mint info: fixture-private', {
    mintUrl: 'https://mint.test/fixture-private',
  });
  expect(warning).toHaveBeenCalledWith('[Coco] Mint info refresh unavailable.');
  expect(failure).not.toHaveBeenCalled();
});

it('reports only the numeric mint rejection code, without the supplied detail', () => {
  walletLogger.error('Mint operation error, not retrying', {
    code: 20001,
    detail: 'synthetic-private-proof',
  });
  expect(failure).toHaveBeenCalledWith(
    '[Coco] Mint rejected issuance; automatic retries stopped.',
    { code: 20001 },
  );
});

it('ignores arbitrary codes and never evaluates code getters', () => {
  expect(safeMintErrorCode({ code: 'synthetic-private-proof' })).toBeUndefined();
  expect(safeMintErrorCode({ code: Infinity })).toBeUndefined();
  expect(safeMintErrorCode({ code: -1 })).toBeUndefined();
  expect(
    safeMintErrorCode({
      get code() {
        throw new Error('must not read');
      },
    }),
  ).toBeUndefined();
});
