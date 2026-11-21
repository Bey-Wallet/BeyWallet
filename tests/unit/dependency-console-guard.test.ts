import { installDependencyConsoleGuard } from '~/shared/utils/dependencyConsoleGuard';
import {
  clearDiagnosticFailures,
  getDiagnosticFailures,
} from '~/services/feedback/diagnosticFailures';

const original = { log: console.log, warn: console.warn, error: console.error };
const installed = Symbol.for('bey.dependencyConsoleGuard');
afterEach(() => {
  Object.assign(console, original);
  delete (console as any)[installed];
});

it('redacts both Cashu witness parser bypasses and avoids wrapping the console repeatedly', () => {
  clearDiagnosticFailures();
  const warn = jest.fn();
  const error = jest.fn();
  console.warn = warn;
  console.error = error;
  installDependencyConsoleGuard();
  const guarded = console.error;
  installDependencyConsoleGuard();
  expect(console.error).toBe(guarded);
  const secret = 'synthetic-private-witness';
  console.error('Failed to parse witness string:', new Error(secret));
  console.error('Failed to parse HTLC witness string:', new Error(secret));
  expect(error).not.toHaveBeenCalled();
  expect(warn).toHaveBeenCalledWith('[Cashu] Invalid witness data.');
  expect(JSON.stringify(warn.mock.calls)).not.toContain(secret);
  expect(getDiagnosticFailures()[0].count).toBe(2);
});

it('blocks known blinded/keyset dumps but preserves unrelated framework warnings', () => {
  clearDiagnosticFailures();
  const log = jest.fn();
  const warn = jest.fn();
  console.log = log;
  console.warn = warn;
  installDependencyConsoleGuard();
  console.log('amount.keep', ['synthetic-private']);
  console.log([{ blindedMessage: 'synthetic-private' }]);
  console.error('[CocoPatch] keysets for synthetic-private', { secret: 'synthetic-private' });
  console.warn(' - id: synthetic-private');
  console.warn('Framework layout warning');
  expect(log).not.toHaveBeenCalled();
  expect(warn).toHaveBeenCalledWith('[Cashu] Keysets unavailable.');
  expect(warn).toHaveBeenCalledWith('Framework layout warning');
  expect(JSON.stringify(warn.mock.calls)).not.toContain('synthetic-private');
});

it('does not crash logging or inspect an array getter supplied by a dependency', () => {
  const log = jest.fn();
  console.log = log;
  installDependencyConsoleGuard();
  const read = jest.fn(() => {
    throw new Error('must not read');
  });
  const payload: unknown[] = [];
  Object.defineProperty(payload, '0', { get: read });
  expect(() => console.log(payload)).not.toThrow();
  expect(read).not.toHaveBeenCalled();
  const { proxy, revoke } = Proxy.revocable([], {});
  revoke();
  expect(() => console.log(proxy)).not.toThrow();
});
