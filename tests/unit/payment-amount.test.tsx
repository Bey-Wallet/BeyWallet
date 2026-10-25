import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { PaymentAmount, paymentAmounts } from '~/shared/ui/PaymentAmount';

const mockSettings = {
  primaryCurrency: 'SATS',
  secondaryCurrency: 'USD',
  showBitcoinSymbol: false,
};
const mockQuery = jest.fn();

jest.mock('~/state/settingsStore', () => ({ useSettingsStore: () => mockSettings }));
jest.mock('~/services/api/bitcoinService', () => ({ bitcoinService: {} }));
jest.mock('tamagui', () => ({ Text: 'Text', YStack: 'YStack' }));
jest.mock('@tanstack/react-query', () => ({
  useQuery: (options: unknown) => {
    mockQuery(options);
    return { data: { price: 100000 } };
  },
}));
beforeEach(() => {
  mockSettings.primaryCurrency = 'SATS';
  mockSettings.secondaryCurrency = 'USD';
  mockSettings.showBitcoinSymbol = false;
  jest.clearAllMocks();
});

it.each([
  ['standard', false, 32, 14],
  ['standard', true, 32, 14],
  ['prominent', false, 40, 16],
  ['prominent', true, 40, 16],
] as const)(
  'uses %s amount sizing independently of compact=%s',
  async (size, compact, primary, secondary) => {
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(
        <PaymentAmount amount={123456789} size={size} compact={compact} testID="amount" />,
      );
    });
    expect(tree.root.findByProps({ testID: 'amount-primary-amount' }).props).toMatchObject({
      fontSize: primary,
      fontWeight: '500',
      color: '$color',
      numberOfLines: 1,
      adjustsFontSizeToFit: true,
    });
    expect(tree.root.findByProps({ testID: 'amount-secondary-amount' }).props).toMatchObject({
      fontSize: secondary,
      color: '$gray10',
    });
    await act(async () => tree.unmount());
  },
);

it.each(['USD', 'EUR', 'INR'])(
  'respects primary currency and Bitcoin symbol for %s',
  (currency) => {
    const sats = paymentAmounts(10000, 'SATS', currency, false, 100000);
    const fiat = paymentAmounts(10000, 'FIAT', currency, true, 100000);
    expect(sats.primary).toBe('10,000 sat');
    expect(fiat.primary).toBe(sats.secondary);
    expect(fiat.secondary).toBe('₿10,000');
  },
);

it.each(['SATS', 'FIAT'] as const)(
  'shows only sats for None with saved %s primary and disables quotes',
  async (primary) => {
    mockSettings.primaryCurrency = primary;
    mockSettings.secondaryCurrency = 'NONE';
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(<PaymentAmount amount={10000} testID="amount" />);
    });
    expect(paymentAmounts(10000, primary, 'NONE', false, 100000)).toEqual({
      primary: '10,000 sat',
      secondary: null,
    });
    expect(paymentAmounts(-10000, primary, 'NONE', true)).toEqual({
      primary: '₿-10,000',
      secondary: null,
    });
    expect(tree.root.findAllByProps({ testID: 'amount-secondary-amount' })).toHaveLength(0);
    expect(mockQuery).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: false }));
    expect(JSON.stringify(tree.toJSON())).not.toMatch(/Loading|Conversion unavailable|≈/);
    mockSettings.secondaryCurrency = 'EUR';
    await act(async () => tree.update(<PaymentAmount amount={10000} testID="amount" />));
    expect(tree.root.findAllByProps({ testID: 'amount-secondary-amount' })).toHaveLength(1);
    expect(mockSettings.primaryCurrency).toBe(primary);
    await act(async () => tree.unmount());
  },
);

it.each([undefined, 0, NaN, Infinity, -1])(
  'never reports a zero conversion for unavailable price %s',
  (price) => {
    expect(paymentAmounts(100, 'SATS', 'USD', false, price).secondary).toBeNull();
    expect(paymentAmounts(100, 'FIAT', 'USD', false, price).primary).toBeNull();
  },
);

it('retains a real zero amount with an available conversion', () => {
  expect(paymentAmounts(0, 'FIAT', 'USD', false, 100000).primary).toBe('$0.00');
});

it('shows sub-cent conversions in both primary and secondary payment amounts', () => {
  expect(paymentAmounts(1, 'SATS', 'USD', false, 100000)).toEqual({
    primary: '1 sat',
    secondary: '<$0.01',
  });
  expect(paymentAmounts(1, 'FIAT', 'USD', false, 100000)).toEqual({
    primary: '<$0.01',
    secondary: '1 sat',
  });
});
