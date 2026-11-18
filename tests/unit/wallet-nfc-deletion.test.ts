import { NativeModules, Platform } from 'react-native';
import { nfcService } from '~/services/platform/nfcService';

jest.mock('react-native-nfc-manager', () => ({
  __esModule: true,
  default: {},
  NfcTech: {},
  Ndef: {},
  NfcEvents: {},
}));
jest.mock('~/services/wallet', () => ({}));
jest.mock('~/shared/utils/paymentInputParser', () => ({}));
jest.mock('~/state/authStore', () => ({}));

const native = {
  setEnabled: jest.fn(async () => {}),
  setContent: jest.fn(async () => {}),
  setRequestSession: jest.fn(async () => {}),
  getPendingPayment: jest.fn(async (): Promise<{ id: string } | null> => null),
  acknowledgePayment: jest.fn(async () => true),
};
const original = NativeModules.Hce;
beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
  NativeModules.Hce = native;
});
afterAll(() => {
  NativeModules.Hce = original;
});

it('erases saved broadcast contents and pending receive data without emitting a payment outcome', async () => {
  native.getPendingPayment
    .mockResolvedValueOnce({ id: 'fixture-receipt' })
    .mockResolvedValueOnce(null);
  await nfcService.clearWalletData();
  expect(native.setEnabled).toHaveBeenCalledWith(false);
  expect(native.setContent).toHaveBeenCalledWith({ type: 'text', content: '', writable: false });
  expect(native.setRequestSession).toHaveBeenCalledWith('');
  expect(native.acknowledgePayment).toHaveBeenCalledWith('fixture-receipt');
  expect(native.getPendingPayment).toHaveBeenCalledTimes(2);
});

it('fails deletion when a saved pending receipt cannot be removed', async () => {
  native.getPendingPayment.mockResolvedValueOnce({ id: 'fixture-receipt' });
  native.acknowledgePayment.mockResolvedValueOnce(false);
  await expect(nfcService.clearWalletData()).rejects.toThrow('Saved NFC data could not be deleted');
});

it('does not call Android APIs on other platforms', async () => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
  await nfcService.clearWalletData();
  expect(native.setContent).not.toHaveBeenCalled();
});
