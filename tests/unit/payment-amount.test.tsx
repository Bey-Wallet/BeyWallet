import { paymentAmounts } from '~/shared/ui/PaymentAmount';

jest.mock('~/state/settingsStore', () => ({ useSettingsStore: () => ({}) }));
jest.mock('~/services/api/bitcoinService', () => ({ bitcoinService: {} }));
jest.mock('tamagui', () => ({ Text: 'Text', YStack: 'YStack' }));
jest.mock('@tanstack/react-query', () => ({ useQuery: jest.fn() }));

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
