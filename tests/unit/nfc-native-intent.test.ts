jest.mock('~/features/nfc/nfcFlow', () => ({ nfcFlow: { openReader: jest.fn() } }));
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn() }));

import * as SecureStore from 'expo-secure-store';
import { nfcFlow } from '~/features/nfc/nfcFlow';
import { redirectNfcIntent } from '~/features/nfc/nativeIntent';

const id = '11111111-2222-4333-8444-555555555555';
const secondId = '11111111-2222-4333-8444-666666666666';
const base = 'bey-wallet:///(modals)/nfc-receive';
const link = `${base}?launchId=${id}`;
let consumed: string | null;

beforeEach(() => {
  jest.clearAllMocks();
  consumed = null;
  jest.mocked(SecureStore.getItemAsync).mockImplementation(async () => consumed);
  jest.mocked(SecureStore.setItemAsync).mockImplementation(async (_key, value) => {
    consumed = value;
  });
});

it('does not open the sheet for an ordinary startup or an unidentifiable old cold NFC URL', () => {
  expect(redirectNfcIntent({ path: '/', initial: true })).toBe('/');
  expect(redirectNfcIntent({ path: base, initial: true })).toBe('/(tabs)');
  expect(nfcFlow.openReader).not.toHaveBeenCalled();
  expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
});

it('preserves old-client warm taps without accepting payloads from their URL', () => {
  expect(redirectNfcIntent({ path: `${base}?token=synthetic-private`, initial: false })).toBe('');
  expect(nfcFlow.openReader).toHaveBeenCalledWith();
  expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
});

it('opens a fresh identified cold launch once and ignores replay after a JavaScript reload', async () => {
  expect(await redirectNfcIntent({ path: link, initial: true })).toBe('/(tabs)');
  expect(nfcFlow.openReader).toHaveBeenCalledTimes(1);
  // Native storage survives JS module reload; no module-local consumed flag is relied on.
  let reloaded!: typeof import('~/features/nfc/nativeIntent');
  jest.isolateModules(() => {
    reloaded = require('~/features/nfc/nativeIntent');
  });
  await reloaded.redirectNfcIntent({ path: link, initial: true });
  expect(nfcFlow.openReader).toHaveBeenCalledTimes(1);
  expect(SecureStore.getItemAsync).toHaveBeenCalledTimes(2);
});

it('serializes duplicate deliveries and still accepts the next fresh tap', async () => {
  await Promise.all([
    redirectNfcIntent({ path: link, initial: true }),
    redirectNfcIntent({ path: link, initial: false }),
  ]);
  expect(nfcFlow.openReader).toHaveBeenCalledTimes(1);
  expect(await redirectNfcIntent({ path: `${base}?launchId=${secondId}`, initial: false })).toBe(
    '',
  );
  expect(nfcFlow.openReader).toHaveBeenCalledTimes(2);
});

it('keeps startup closed if replay protection cannot be persisted', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.mocked(SecureStore.setItemAsync).mockRejectedValueOnce(new Error('synthetic-private'));
  expect(await redirectNfcIntent({ path: link, initial: true })).toBe('/(tabs)');
  expect(nfcFlow.openReader).not.toHaveBeenCalled();
  expect(JSON.stringify(warn.mock.calls)).not.toContain('synthetic-private');
  warn.mockRestore();
});

it('does not persist arbitrary data as a launch identifier', () => {
  expect(redirectNfcIntent({ path: `${base}?launchId=synthetic-private`, initial: true })).toBe(
    '/(tabs)',
  );
  expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  expect(nfcFlow.openReader).not.toHaveBeenCalled();
});
