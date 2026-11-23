import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { PaymentTechnicalDetails } from '~/features/payments/PaymentTechnicalDetails';
import { buildReceiptDetails } from '~/features/history/receiptDetails';

let mockData: any;
const mockQuery = jest.fn();
jest.mock('@tanstack/react-query', () => ({
  useQuery: (options: unknown) => {
    mockQuery(options);
    return { data: mockData };
  },
}));
jest.mock('~/state/settingsStore', () => ({
  useSettingsStore: (select: any) => select({ npub: 'wallet' }),
}));
jest.mock('~/features/history/components/ReceiptExtraDetails', () => ({
  ReceiptExtraDetails: 'ExtraDetails',
}));
jest.mock('~/services/wallet/paymentReceiptContext', () => ({
  readPaymentReceiptContext: jest.fn(),
}));
let tree: ReactTestRenderer;
beforeEach(() => {
  mockData = undefined;
  jest.clearAllMocks();
});
afterEach(async () => {
  await act(async () => tree?.unmount());
});
const entry = {
  id: '',
  type: 'send',
  amount: 20,
  unit: 'sat',
  mintUrl: 'mint',
  createdAt: 0,
  operationId: 'operation',
  state: 'pending',
};

it('renders the exact same fields as History once the saved transaction is available', async () => {
  const saved = {
    ...entry,
    id: '7',
    amount: 21,
    state: 'claimed',
    createdAt: 1700000000000,
    metadata: { fee: 2 },
  };
  mockData = { entry: saved, snapshot: {} };
  await act(async () => {
    tree = create(<PaymentTechnicalDetails entry={entry} />);
  });
  expect(tree.root.findByType('ExtraDetails' as any).props.fields).toEqual(
    buildReceiptDetails(saved).extra,
  );
  expect(mockQuery.mock.calls[0][0].queryKey).toEqual([
    'history',
    'technicalDetails',
    'wallet',
    'mint',
    'send',
    'operation',
    undefined,
    'pending',
  ]);
  expect(mockQuery.mock.calls[0][0].networkMode).toBe('always');
});

it('does not fabricate a saved ID, timestamp or paid fee before persistence', async () => {
  await act(async () => {
    tree = create(<PaymentTechnicalDetails entry={entry} />);
  });
  const fields = tree.root.findByType('ExtraDetails' as any).props.fields;
  expect(
    fields.some((field: any) => field.label === 'Transaction ID' || field.label === 'Date'),
  ).toBe(false);
  expect(fields.find((field: any) => field.label === 'Fee').value).toBe('Unavailable');
});
