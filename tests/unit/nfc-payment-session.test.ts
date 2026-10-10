jest.mock('react-native-nfc-manager', () => ({
  __esModule: true,
  default: {
    requestTechnology: jest.fn(async () => {}),
    getTag: jest.fn(async () => ({ ndefMessage: [] })),
    cancelTechnologyRequest: jest.fn(async () => {}),
    ndefHandler: { writeNdefMessage: jest.fn(async () => {}) },
  },
  NfcTech: { Ndef: 'Ndef' },
  NfcEvents: {},
  Ndef: {
    TNF_WELL_KNOWN: 1,
    textRecord: (value: string) => value,
    encodeMessage: (records: unknown[]) => records,
    text: { decodePayload: jest.fn(() => 'cashu:cashuBtoken') },
    uri: { decodePayload: jest.fn(() => 'bitcoin:?creq=request') },
  },
}));
jest.mock('react-native-hce', () => ({}));
jest.mock('~/services/wallet', () => ({}));

import NfcManager, { Ndef, type TagEvent } from 'react-native-nfc-manager';
import { Platform } from 'react-native';
import {
  nfcService,
  decodePaymentNdef,
  assertSameNfcPaymentRequest,
} from '~/services/platform/nfcService';
import { PaymentRequest } from '@cashu/cashu-ts';
import { useAuthStore } from '~/state/authStore';

beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.getState().setLockDisabled(false);
});

it('keeps the same native session open for confirmation and write-back', async () => {
  const session = nfcService.openPaymentSession();
  await session.read();
  expect(useAuthStore.getState().isLockDisabled).toBe(true);
  expect(NfcManager.cancelTechnologyRequest).not.toHaveBeenCalled();
  await session.write('cashuBtoken');
  expect(NfcManager.requestTechnology).toHaveBeenCalledTimes(1);
  expect(NfcManager.requestTechnology).toHaveBeenCalledWith(
    'Ndef',
    Platform.OS === 'android' ? { isReaderModeEnabled: true, readerModeFlags: 0x103 } : undefined,
  );
  expect(NfcManager.ndefHandler.writeNdefMessage).toHaveBeenCalledTimes(1);
  expect(NfcManager.cancelTechnologyRequest).not.toHaveBeenCalled();
  await session.close();
  await session.close();
  expect(NfcManager.cancelTechnologyRequest).toHaveBeenCalledTimes(1);
  expect(useAuthStore.getState().isLockDisabled).toBe(false);
});
it('distinguishes an unwritable tag from contact loss without logging native data', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const session = nfcService.openPaymentSession();
  await session.read();
  jest
    .mocked(NfcManager.ndefHandler.writeNdefMessage)
    .mockRejectedValueOnce(new Error('tag not writable synthetic bearer data'));
  await expect(session.write('token')).rejects.toThrow('read_only');
  expect(warn).toHaveBeenCalledWith('[NfcPaymentSession] Write failed', {
    category: 'read_only',
  });
  expect(JSON.stringify(warn.mock.calls)).not.toContain('synthetic bearer');
  warn.mockRestore();
});
it('closes on contact loss and preserves prior lock behavior', async () => {
  useAuthStore.getState().setLockDisabled(true);
  const session = nfcService.openPaymentSession();
  await session.read();
  jest.mocked(NfcManager.ndefHandler.writeNdefMessage).mockRejectedValueOnce(new Error('tag lost'));
  await expect(session.write('token')).rejects.toThrow('contact lost');
  expect(useAuthStore.getState().isLockDisabled).toBe(true);
  await expect(session.write('token')).rejects.toThrow('contact lost');
});
it('cancels a pending read and restores app locking', async () => {
  const session = nfcService.openPaymentSession();
  await session.close();
  await expect(session.read()).rejects.toThrow('closed');
  expect(useAuthStore.getState().isLockDisabled).toBe(false);
});
it('decodes NDEF Text and URI with the native codecs', () => {
  const tag = (type: number) =>
    ({ ndefMessage: [{ tnf: 1, type: [type], payload: [0, 1], id: [] }] }) as TagEvent;
  expect(decodePaymentNdef(tag(0x54))).toBe('cashu:cashuBtoken');
  expect(decodePaymentNdef(tag(0x55))).toBe('bitcoin:?creq=request');
  expect(Ndef.text.decodePayload).toHaveBeenCalled();
  expect(Ndef.uri.decodePayload).toHaveBeenCalled();
});

it('rejects another merchant request on reconnection before a write', () => {
  const expected = new PaymentRequest([], 'same-request', 1, 'sat').toEncodedCreqA();
  const other = new PaymentRequest([], 'other-request', 1, 'sat').toEncodedCreqA();
  const tag = { ndefMessage: [{ tnf: 1, type: [0x54], payload: [0], id: [] }] } as TagEvent;
  jest.mocked(Ndef.text.decodePayload).mockReturnValueOnce(expected);
  expect(() => assertSameNfcPaymentRequest(tag, expected)).not.toThrow();
  jest.mocked(Ndef.text.decodePayload).mockReturnValueOnce(other);
  expect(() => assertSameNfcPaymentRequest(tag, expected)).toThrow('same payment request');
  expect(NfcManager.ndefHandler.writeNdefMessage).not.toHaveBeenCalled();
});
