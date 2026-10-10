import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('tamagui', () => ({
  YStack: 'YStack',
  Text: 'Text',
  Button: 'Button',
  Spinner: 'Spinner',
}));
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  router: { back: jest.fn(), canGoBack: jest.fn(() => false), replace: jest.fn() },
  useFocusEffect: (callback: () => void) => require('react').useEffect(callback, []),
}));
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));
jest.mock('~/shared/ui/Flex', () => ({ Flex: 'Flex' }));
jest.mock('~/state/walletStore', () => ({
  useWalletStore: (selector: (store: unknown) => unknown) =>
    selector({ activeMintUrl: 'https://mint.example', refreshBalance: jest.fn() }),
}));
jest.mock('~/services/platform/nfcService', () => ({
  nfcService: {
    init: jest.fn(async () => true),
    isEnabled: jest.fn(async () => true),
    openPaymentSession: jest.fn(),
  },
  decodePaymentNdef: () => 'payment',
  assertSameNfcPaymentRequest: jest.fn(),
}));
jest.mock('~/shared/utils/paymentInputParser', () => ({ parsePaymentInput: jest.fn() }));
jest.mock('~/services/wallet/paymentRequestModel', () => ({ parsePaymentRequest: jest.fn() }));
jest.mock('~/features/payments/send/PaymentRequestStage', () => ({
  PaymentRequestStage: jest.fn(() => null),
}));
jest.mock('~/services/wallet/lightningPayment', () => ({ LightningPayment: jest.fn() }));
jest.mock('~/services/wallet', () => ({ walletService: { receive: jest.fn() } }));

import NFCReceiveScreen from '~/features/payments/receive/NfcReceiveScreen';
import { nfcService } from '~/services/platform/nfcService';
import { parsePaymentInput } from '~/shared/utils/paymentInputParser';
import { parsePaymentRequest } from '~/services/wallet/paymentRequestModel';
import { PaymentRequestStage } from '~/features/payments/send/PaymentRequestStage';
import { LightningPayment } from '~/services/wallet/lightningPayment';
import { router } from 'expo-router';

let screen: ReactTestRenderer;
const close = jest.fn(async () => {});
beforeEach(() => {
  jest.clearAllMocks();
  jest
    .mocked(nfcService.openPaymentSession)
    .mockReturnValue({ read: jest.fn(async () => ({ ndefMessage: [] })), write: jest.fn(), close });
});
afterEach(async () => {
  await act(async () => {
    screen?.unmount();
  });
});

it('opts NFC Cashu requests into automatic payment without closing the write-back session', async () => {
  jest.mocked(parsePaymentInput).mockReturnValue({
    matched: true,
    ok: true,
    value: { primary: { type: 'cashu_request', value: 'request' } },
  } as any);
  jest.mocked(parsePaymentRequest).mockReturnValue({ raw: 'request', delivery: 'nfc' } as any);
  await act(async () => {
    screen = create(<NFCReceiveScreen />);
  });
  expect(jest.mocked(PaymentRequestStage).mock.calls.at(-1)?.[0]).toMatchObject({ autoPay: true });
  expect(close).not.toHaveBeenCalled();
});

it('automatically submits the previewed Lightning operation once, without a confirmation button', async () => {
  jest.mocked(parsePaymentInput).mockReturnValue({
    matched: true,
    ok: true,
    value: { primary: { type: 'lightning_invoice', value: 'invoice' } },
  } as any);
  const preview = jest.fn(async () => ({ quote: 'quote', amount: 1, fee_reserve: 2 }));
  const pay = jest.fn(async () => 'pending');
  jest
    .mocked(LightningPayment)
    .mockImplementation(() => ({ preview, pay, dispose: jest.fn(async () => {}) }) as any);
  await act(async () => {
    screen = create(<NFCReceiveScreen />);
  });
  expect(preview).toHaveBeenCalledTimes(1);
  expect(pay).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(screen.toJSON())).not.toContain('Confirm payment');
  expect(JSON.stringify(screen.toJSON())).toContain('Payment pending. Do not pay again.');
});

it('returns a cold-launch NFC screen to home when there is no back stack', async () => {
  jest.mocked(parsePaymentInput).mockReturnValue({ matched: false } as any);
  await act(async () => {
    screen = create(<NFCReceiveScreen />);
  });
  const button = screen.root
    .findAllByType('Button' as any)
    .find((node) => node.props.children === 'Close');
  await act(async () => {
    await button!.props.onPress();
  });
  expect(router.back).not.toHaveBeenCalled();
  expect(router.replace).toHaveBeenCalledWith('/(tabs)');
});
