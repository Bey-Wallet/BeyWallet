import {
  currencyService,
  SUPPORTED_CURRENCIES,
  SELECTABLE_CURRENCIES,
} from '~/services/wallet/currencyService';

jest.mock('~/state/settingsStore', () => ({ useSettingsStore: { getState: jest.fn() } }));
jest.mock('~/services/api/bitcoinService', () => ({ bitcoinService: {} }));

describe('fiat display', () => {
  it('retires only the four requested picker options, keeping NGN, THB and saved-value formatting', () => {
    expect(SELECTABLE_CURRENCIES).toHaveLength(25);
    const retired = ['VND', 'PHP', 'IDR', 'ARS'];
    expect(SELECTABLE_CURRENCIES.map(({ code }) => code)).toEqual(
      SUPPORTED_CURRENCIES.filter(({ code }) => !retired.includes(code)).map(({ code }) => code),
    );
    expect(SELECTABLE_CURRENCIES.map(({ code }) => code)).toEqual(
      expect.arrayContaining(['NGN', 'THB']),
    );
    expect(currencyService.getSymbol('NGN')).toBe('₦');
    expect(currencyService.getSymbol('THB')).toBe('฿');
  });

  it.each([
    ['PLN', 'zł'],
    ['CZK', 'Kč'],
  ] as const)('formats %s with its local symbol and decimal separator', (code, symbol) => {
    expect(currencyService.formatValue(1234.5, code).replace(/[\s\u00a0\u202f]/g, ' ')).toMatch(
      new RegExp(`^1 ?234,50 ${symbol}$`),
    );
    expect(currencyService.getSymbol(code)).toBe(symbol);
    expect(currencyService.formatValue(0.001, code)).toContain(`0,01`);
  });
  it.each(['AED', 'KWD'] as const)('uses Latin digits with a trailing %s code', (code) => {
    expect(currencyService.formatValue(1234.5, code)).toBe(`1,234.50 ${code}`);
    expect(currencyService.formatValue(0, code)).toBe(`0.00 ${code}`);
    expect(currencyService.formatValue(-12.5, code)).toBe(`-12.50 ${code}`);
    expect(currencyService.getSymbol(code)).toBe(code);
  });

  it('preserves USD formatting', () => {
    expect(currencyService.formatValue(1234.5, 'USD')).toBe('$1,234.50');
  });

  it.each([
    ['THB', '฿'],
    ['PHP', '₱'],
    ['VND', '₫'],
    ['NGN', '₦'],
  ] as const)('uses the currency symbol for %s', (code, label) => {
    expect(currencyService.formatValue(12.5, code)).toContain(label);
    expect(currencyService.getSymbol(code)).toBe(label);
    expect(currencyService.formatValue(0.001, code)).toMatch(/^</);
  });

  it('distinguishes Argentine pesos and formats Indonesian rupiah', () => {
    expect(currencyService.formatValue(12.5, 'ARS')).toBe('AR$12,50');
    expect(currencyService.getSymbol('ARS')).toBe('AR$');
    expect(currencyService.formatValue(12.5, 'IDR')).toMatch(/^Rp\s?12,50$/);
    expect(currencyService.getSymbol('IDR')).toBe('Rp');
  });

  it('distinguishes Mexican pesos from US dollars in displays and amount entry labels', () => {
    expect(currencyService.formatValue(12.5, 'MXN')).toBe('MX$12.50');
    expect(currencyService.formatValue(0.001, 'MXN')).toBe('<MX$0.01');
    expect(currencyService.getSymbol('MXN')).toBe('MX$');
    expect(currencyService.formatValue(12.5, 'USD')).toBe('$12.50');
  });

  it.each(SUPPORTED_CURRENCIES.map(({ code }) => code))(
    'shows small nonzero values with a localized lower display limit for %s',
    (code) => {
      const minimum = currencyService.formatValue(0.01, code);
      for (const amount of [Number.MIN_VALUE, 0.0001, 0.004, 0.009, 0.009999]) {
        expect(currencyService.formatValue(amount, code)).toBe(`<${minimum}`);
      }
      expect(currencyService.formatValue(0, code)).not.toContain('<');
      expect(currencyService.formatValue(0.01, code)).not.toContain('<');
      expect(currencyService.formatValue(0.015, code)).not.toContain('<');
    },
  );

  it('keeps symbols, decimal separators and debit signs in small-value labels', () => {
    expect(currencyService.formatValue(0.001, 'USD')).toBe('<$0.01');
    expect(currencyService.formatValue(0.001, 'EUR')).toMatch(/^<0,01\s€$/);
    expect(currencyService.formatValue(0.001, 'INR')).toBe('<₹0.01');
    expect(currencyService.formatValue(0.001, 'JPY')).toMatch(/^<[¥￥]0\.01$/);
    expect(currencyService.formatValue(0.001, 'AED')).toBe('<0.01 AED');
    expect(currencyService.formatValue(0.001, 'KWD')).toBe('<0.01 KWD');
    expect(currencyService.formatValue(-0.001, 'USD')).toBe('-<$0.01');
    expect(currencyService.formatValue(0, 'USD')).toBe('$0.00');
  });

  it('keeps currency codes after values when platform number formatting is unavailable', () => {
    const formatter = jest.spyOn(Intl, 'NumberFormat').mockImplementation(() => {
      throw new Error('Intl unavailable');
    });
    try {
      jest.isolateModules(() => {
        const { currencyService: fallback } = require('~/services/wallet/currencyService');
        expect(fallback.formatValue(12.5, 'AED')).toBe('12.50 AED');
        expect(fallback.formatValue(12.5, 'KWD')).toBe('12.50 KWD');
        expect(fallback.formatValue(0.001, 'USD')).toBe('<$0.01');
        expect(fallback.formatValue(0.001, 'AED')).toBe('<0.01 AED');
        expect(fallback.formatValue(0.001, 'KWD')).toBe('<0.01 KWD');
        expect(fallback.formatValue(12.5, 'THB')).toBe('฿12.50');
        expect(fallback.formatValue(12.5, 'PHP')).toBe('₱12.50');
        expect(fallback.formatValue(12.5, 'VND')).toBe('12.50 ₫');
        expect(fallback.formatValue(12.5, 'NGN')).toBe('₦12.50');
        expect(fallback.formatValue(12.5, 'IDR')).toBe('Rp12.50');
        expect(fallback.formatValue(12.5, 'ARS')).toBe('AR$12.50');
        expect(fallback.formatValue(12.5, 'MXN')).toBe('MX$12.50');
        expect(fallback.formatValue(12.5, 'PLN')).toBe('12.50 zł');
        expect(fallback.formatValue(12.5, 'CZK')).toBe('12.50 Kč');
      });
    } finally {
      formatter.mockRestore();
    }
  });
});
