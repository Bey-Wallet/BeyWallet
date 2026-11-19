import { formatDiagnosticReport, sanitizeSupportText } from '~/features/settings/diagnosticReport';
import {
  recordDiagnosticFailure,
  clearDiagnosticFailures,
  getDiagnosticFailures,
} from '~/services/feedback/diagnosticFailures';

const snapshot = { version: '1.2.3', build: '42', platform: 'android', relays: null };
beforeEach(() => {
  jest.spyOn(Date, 'now').mockReturnValue(1700000000000);
});
afterEach(() => {
  clearDiagnosticFailures();
  jest.restoreAllMocks();
});

it('includes useful allowlisted environment, health and failure fields without serializing extra data', () => {
  recordDiagnosticFailure(
    'lightning_prepare',
    Object.assign(new Error('private invoice and token'), { code: 20006 }),
    Date.now() - 1500,
  );
  const report = formatDiagnosticReport({
    ...snapshot,
    device: { model: 'SM-S908E', osVersion: '16', apiLevel: 36 },
    update: { runtime: '1.2.3', id: 'update-fixture', embedded: false, development: true },
    wallet: { initialization: 'ready', hasError: true },
    network: { connected: true, reachable: false, type: 'WIFI' },
    mints: { connected: 3, successful: 1, failed: 1, unchecked: 1, checkedAt: Date.now() },
    failures: getDiagnosticFailures(),
    secret: 'secret-fixture',
    balance: 999,
    mintUrl: 'https://private-mint',
  } as any);
  expect(report).toContain('Device model: SM-S908E');
  expect(report).toContain('Internet reachable: No');
  expect(report).toContain('1 successful, 1 failed, 1 unchecked');
  expect(report).toContain('Lightning payment preparation');
  expect(report).toContain('duration 1500 ms');
  expect(report).toContain('code 20006');
  expect(report).not.toMatch(/private invoice|secret-fixture|private-mint|999/);
});

it.each([
  `${'abandon '.repeat(11)}about`,
  `seed: ${'abandon '.repeat(11)}about`,
  `mnemonic: ${'abandon '.repeat(24)}`,
])('redacts recovery phrases before removing labeled fields', (phrase) => {
  expect(sanitizeSupportText(phrase)).not.toMatch(/abandon|about/);
});

it('redacts common bearer secrets and private metadata from optional issue descriptions', () => {
  const input = [
    'nsec1privatekey',
    'cashuBprivateToken',
    'lnbc1privateInvoice',
    'npub1privateIdentity',
    'a'.repeat(64),
    'https://private-mint.test',
    'wss://private-relay.test',
    'person@example.com',
    '1200 sat',
    '₹500',
    'secret: "private-proof-secret"',
  ].join('\n');
  const report = formatDiagnosticReport(snapshot, {
    happened: input,
    expected: 'Open the screen',
    steps: 'Tap Continue twice',
  });
  expect(report).toContain('Tap Continue twice');
  expect(report).not.toMatch(
    /nsec1|cashuB|lnbc1|npub1|private-mint|private-relay|person@|1200|₹500|private-proof-secret/,
  );
  expect(report).not.toContain('a'.repeat(64));
});

it('does not evaluate or serialize arbitrary extra snapshot properties', () => {
  const getter = jest.fn(() => {
    throw new Error('private-secret');
  });
  const data = Object.defineProperty({ ...snapshot }, 'rawErrors', { get: getter });
  expect(() => formatDiagnosticReport(data)).not.toThrow();
  expect(getter).not.toHaveBeenCalled();
});
