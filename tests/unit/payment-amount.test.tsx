import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { PaymentAmount, paymentAmounts } from '~/shared/ui/PaymentAmount';

const mockSettings = {
  primaryCurrency: 'SATS',
  secondaryCurrency: 'USD',
  showBitcoinSymbol: false,
};

jest.mock('~/state/settingsStore', () => ({ useSettingsStore: () => mockSettings }));
jest.mock('~/services/api/bitcoinService', () => ({ bitcoinService: {} }));
jest.mock('tamagui', () => ({ Text: 'Text', YStack: 'YStack' }));
jest.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: { price: 100000 } }) }));

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
