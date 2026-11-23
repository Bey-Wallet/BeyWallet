import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { PaymentAmountRow } from '~/shared/ui/PaymentAmountRow';

const mockSettings = {
  primaryCurrency: 'SATS',
  secondaryCurrency: 'USD',
  showBitcoinSymbol: false,
};
let mockPrice: number | undefined = 100000;
jest.mock('~/state/settingsStore', () => ({ useSettingsStore: () => mockSettings }));
jest.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: { price: mockPrice } }) }));
jest.mock('~/services/api/bitcoinService', () => ({ bitcoinService: {} }));
jest.mock('~/services/wallet/currencyService', () => ({
  currencyService: {
    convertSatsToCurrency: (sats: number, price: number) => (sats * price) / 1e8,
    formatValue: (amount: number) => `$${amount.toFixed(2)}`,
  },
}));
jest.mock('tamagui', () => ({ Text: 'Text', YStack: 'YStack' }));
jest.mock('~/shared/ui/ListTable', () => ({ ListTableRow: 'Row' }));
let tree: ReactTestRenderer;
beforeEach(() => {
  mockSettings.primaryCurrency = 'SATS';
  mockSettings.secondaryCurrency = 'USD';
  mockPrice = 100000;
});
afterEach(async () => {
  await act(async () => tree?.unmount());
});

it.each(['SATS', 'FIAT'])(
  'keeps %s primary with a muted parenthesized secondary value',
  async (primary) => {
    mockSettings.primaryCurrency = primary;
    await act(async () => {
      tree = create(<PaymentAmountRow amount={1000} />);
    });
    const row = tree.root.findByType('Row' as any);
    expect(row.props.label).toBe('Amount');
    expect(row.props.expandValue).toBe(true);
    const value = row.props.value;
    expect(value.props.color).toBe('$color');
    expect(value.props.textAlign).toBe('right');
    expect(value.props.children[0]).toBe(primary === 'SATS' ? '1,000 sat' : '$1.00');
    expect(value.props.children[1].props).toMatchObject({
      color: '$gray10',
      children: primary === 'SATS' ? ' ($1.00)' : ' (1,000 sat)',
    });
  },
);

it('omits a disabled secondary currency', async () => {
  mockSettings.secondaryCurrency = 'NONE';
  await act(async () => {
    tree = create(<PaymentAmountRow amount={1000} />);
  });
  expect(tree.root.findByType('Row' as any).props.value.props.children[1]).toBeNull();
});

it('falls back to sats without inventing a fiat equivalent when the price is unavailable', async () => {
  mockSettings.primaryCurrency = 'FIAT';
  mockPrice = undefined;
  await act(async () => {
    tree = create(<PaymentAmountRow amount={1000} />);
  });
  const value = tree.root.findByType('Row' as any).props.value;
  expect(value.props.children[0]).toBe('1,000 sat');
  expect(value.props.children[1]).toBeNull();
});
