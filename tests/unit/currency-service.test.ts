import { currencyService } from '~/services/wallet/currencyService';

jest.mock('~/state/settingsStore', () => ({ useSettingsStore: { getState: jest.fn() } }));
jest.mock('~/services/api/bitcoinService', () => ({ bitcoinService: {} }));

describe('fiat display', () => {
  it.each(['AED', 'KWD'] as const)('uses Latin digits with a trailing %s code', (code) => {
    expect(currencyService.formatValue(1234.5, code)).toBe(`1,234.50 ${code}`);
    expect(currencyService.formatValue(0, code)).toBe(`0.00 ${code}`);
    expect(currencyService.formatValue(-12.5, code)).toBe(`-12.50 ${code}`);
    expect(currencyService.getSymbol(code)).toBe(code);
  });

  it('preserves USD formatting', () => {
    expect(currencyService.formatValue(1234.5, 'USD')).toBe('$1,234.50');
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
      });
    } finally {
      formatter.mockRestore();
    }
  });
});
