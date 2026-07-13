// Mock the settings store before importing currencyService
jest.mock('../store/settingsStore', () => ({
    useSettingsStore: {
        getState: jest.fn(() => ({
            showBitcoinSymbol: false,
        })),
    },
}));

import { currencyService, SUPPORTED_CURRENCIES } from '../services/currencyService';

describe('currencyService', () => {
    describe('getSymbol', () => {
        it('returns $ for USD', () => {
            expect(currencyService.getSymbol('USD')).toBe('$');
        });

        it('returns € for EUR', () => {
            expect(currencyService.getSymbol('EUR')).toBe('€');
        });

        it('returns £ for GBP', () => {
            expect(currencyService.getSymbol('GBP')).toBe('£');
        });

        it('returns ₽ for RUB', () => {
            expect(currencyService.getSymbol('RUB')).toBe('₽');
        });

        it('returns fallback $ for unknown currency', () => {
            expect(currencyService.getSymbol('XYZ' as any)).toBe('$');
        });
    });

    describe('convertSatsToCurrency', () => {
        it('converts 1 BTC (100M sats) correctly', () => {
            const result = currencyService.convertSatsToCurrency(100000000, 60000);
            expect(result).toBe(60000);
        });

        it('converts 1 sat correctly', () => {
            const result = currencyService.convertSatsToCurrency(1, 60000);
            expect(result).toBeCloseTo(0.0006, 6);
        });

        it('converts half a BTC correctly', () => {
            const result = currencyService.convertSatsToCurrency(50000000, 60000);
            expect(result).toBe(30000);
        });

        it('handles 0 sats', () => {
            expect(currencyService.convertSatsToCurrency(0, 60000)).toBe(0);
        });

        it('handles 0 price', () => {
            expect(currencyService.convertSatsToCurrency(100000000, 0)).toBe(0);
        });
    });

    describe('convertCurrencyToSats', () => {
        it('converts $60000 to 1 BTC', () => {
            const result = currencyService.convertCurrencyToSats(60000, 60000);
            expect(result).toBe(100000000);
        });

        it('converts $30000 to 0.5 BTC', () => {
            const result = currencyService.convertCurrencyToSats(30000, 60000);
            expect(result).toBe(50000000);
        });

        it('floors the result', () => {
            const result = currencyService.convertCurrencyToSats(1, 60000);
            expect(result).toBe(1666); // Math.floor(1/60000 * 100000000)
        });

        it('returns 0 for 0 price', () => {
            expect(currencyService.convertCurrencyToSats(100, 0)).toBe(0);
        });

        it('returns 0 for negative price', () => {
            expect(currencyService.convertCurrencyToSats(100, -1)).toBe(0);
        });

        it('returns 0 for 0 amount', () => {
            expect(currencyService.convertCurrencyToSats(0, 60000)).toBe(0);
        });
    });

    describe('formatValue', () => {
        it('formats USD correctly', () => {
            const result = currencyService.formatValue(1234.56, 'USD');
            expect(result).toContain('1');
            expect(result).toContain('234');
        });

        it('formats EUR correctly', () => {
            const result = currencyService.formatValue(1234.56, 'EUR');
            expect(result).toContain('€');
        });

        it('formats GBP correctly', () => {
            const result = currencyService.formatValue(1234.56, 'GBP');
            expect(result).toContain('£');
        });

        it('formats 0 correctly', () => {
            const result = currencyService.formatValue(0, 'USD');
            expect(result).toContain('0');
        });

        it('formats negative values', () => {
            const result = currencyService.formatValue(-100, 'USD');
            expect(result).toContain('100');
        });

        it('falls back for unknown currency', () => {
            const result = currencyService.formatValue(100, 'XYZ' as any);
            expect(result).toContain('100');
        });
    });

    describe('SUPPORTED_CURRENCIES', () => {
        it('has at least 10 currencies', () => {
            expect(SUPPORTED_CURRENCIES.length).toBeGreaterThanOrEqual(10);
        });

        it('each currency has required fields', () => {
            for (const currency of SUPPORTED_CURRENCIES) {
                expect(currency.code).toBeTruthy();
                expect(currency.symbol).toBeTruthy();
                expect(currency.name).toBeTruthy();
                expect(currency.locale).toBeTruthy();
            }
        });

        it('has unique codes', () => {
            const codes = SUPPORTED_CURRENCIES.map(c => c.code);
            expect(new Set(codes).size).toBe(codes.length);
        });
    });
});
