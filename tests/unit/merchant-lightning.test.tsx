import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { MerchantLightningStage } from '~/features/payments/receive/MerchantLightningStage';
const mockCreate = jest.fn();
const mockRedeem = jest.fn();
const mockOffline = jest.fn();
const mockUnsubscribe = jest.fn();
let mockListener: (payload: any) => void;
jest.mock('~/services/wallet', () => ({
  quotesService: {
    createMintQuote: (...args: unknown[]) => mockCreate(...args),
    redeemMintQuote: (...args: unknown[]) => mockRedeem(...args),
  },
  eventService: {
    on: (_event: string, listener: typeof mockListener) => {
      mockListener = listener;
      return mockUnsubscribe;
    },
  },
}));
jest.mock('~/services/platform/networkService', () => ({
  networkService: { isOffline: () => mockOffline() },
}));
jest.mock('~/shared/hooks/useFeedbackOwner', () => ({ useFeedbackOwner: jest.fn() }));
jest.mock('tamagui', () => ({ Text: 'Text', YStack: 'YStack' }));
jest.mock('~/shared/ui/Spinner', () => ({ Spinner: 'Spinner' }));
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'Button' }));
jest.mock('~/features/payments/mint/PaymentStage', () => ({ PaymentStage: 'Payment' }));
const props = {
  amount: 64,
  mintUrl: 'mint-a',
  onReceived: jest.fn(),
  onBusyChange: jest.fn(),
  onClose: jest.fn(),
};
let tree: ReactTestRenderer;
beforeEach(() => {
  jest.clearAllMocks();
  mockOffline.mockResolvedValue(false);
  mockCreate.mockResolvedValue({
    quote: 'sale-quote',
    request: 'lnbc-invoice',
    expiry: 9999999999,
  });
  mockRedeem.mockResolvedValue(undefined);
});
afterEach(async () => {
  await act(async () => tree?.unmount());
});
async function open() {
  await act(async () => {
    tree = create(<MerchantLightningStage {...props} />);
  });
}
it('creates one invoice across renders and accepts only redemption for that mint and quote', async () => {
  await open();
  await act(async () => tree.update(<MerchantLightningStage {...props} />));
  expect(mockCreate).toHaveBeenCalledTimes(1);
  expect(mockCreate).toHaveBeenCalledWith('mint-a', 64);
  expect(props.onReceived).not.toHaveBeenCalled();
  await act(async () => {
    mockListener({ mintUrl: 'mint-b', quoteId: 'sale-quote' });
    mockListener({ mintUrl: 'mint-a', quoteId: 'other-quote' });
  });
  expect(props.onReceived).not.toHaveBeenCalled();
  await act(async () => mockListener({ mintUrl: 'mint-a', quoteId: 'sale-quote' }));
  expect(props.onReceived).toHaveBeenCalledTimes(1);
});
it('passes the sale note to invoice creation', async () => {
  await act(async () => {
    tree = create(<MerchantLightningStage {...props} note="Coffee" />);
  });
  expect(mockCreate).toHaveBeenCalledWith('mint-a', 64, 'Coffee');
});

it('does not confirm a failed collection and prevents duplicate manual redemption', async () => {
  await open();
  mockRedeem.mockRejectedValueOnce(new Error('not paid'));
  const paid = tree.root.findByType('Payment' as any).props.onPaid;
  await act(async () => {
    await expect(paid()).rejects.toThrow('not paid');
  });
  expect(props.onReceived).not.toHaveBeenCalled();
  let finish!: () => void;
  mockRedeem.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  let first!: Promise<void>;
  await act(async () => {
    first = paid();
    await paid();
  });
  expect(mockRedeem).toHaveBeenCalledTimes(2);
  await act(async () => {
    finish();
    await first;
  });
  expect(props.onReceived).toHaveBeenCalledTimes(1);
});
it('leaves a created invoice in History when the checkout closes', async () => {
  await open();
  await act(async () => tree.root.findByType('Payment' as any).props.onCancel());
  expect(props.onClose).toHaveBeenCalledTimes(1);
  expect(mockRedeem).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
  expect(mockUnsubscribe).toHaveBeenCalled();
});
it('blocks offline creation and allows an explicit retry after reconnecting', async () => {
  mockOffline.mockResolvedValueOnce(true);
  await open();
  expect(mockCreate).not.toHaveBeenCalled();
  expect(props.onReceived).not.toHaveBeenCalled();
  await act(async () => tree.root.findByType('Button' as any).props.onPress());
  expect(mockCreate).toHaveBeenCalledTimes(1);
});
