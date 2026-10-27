import { useSettingsStore } from '~/state/settingsStore';
import { bitcoinService } from '~/services/api/bitcoinService';

export type CurrencyCode =
  | 'USD'
  | 'EUR'
  | 'GBP'
  | 'PLN'
  | 'CZK'
  | 'JPY'
  | 'AUD'
  | 'CAD'
  | 'CHF'
  | 'CNY'
  | 'INR'
  | 'BRL'
  | 'RUB'
  | 'ZAR'
  | 'MXN'
  | 'SGD'
  | 'HKD'
  | 'NZD'
  | 'SEK'
  | 'KRW'
  | 'TRY'
  | 'THB'
  | 'PHP'
  | 'IDR'
  | 'VND'
  | 'NGN'
  | 'ARS'
  | 'AED'
  | 'KWD';

export interface Currency {
  code: CurrencyCode;
  symbol: string;
  name: string;
  locale: string;
  codeSuffix?: boolean;
}

export const SUPPORTED_CURRENCIES: Currency[] = [
  { code: 'USD', symbol: '$', name: 'US Dollar', locale: 'en-US' },
  { code: 'EUR', symbol: '€', name: 'Euro', locale: 'de-DE' },
  { code: 'GBP', symbol: '£', name: 'British Pound', locale: 'en-GB' },
  { code: 'PLN', symbol: 'zł', name: 'Polish Zloty', locale: 'pl-PL' },
  { code: 'CZK', symbol: 'Kč', name: 'Czech Koruna', locale: 'cs-CZ' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', locale: 'ja-JP' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', locale: 'en-AU' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', locale: 'en-CA' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc', locale: 'de-CH' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', locale: 'zh-CN' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', locale: 'en-IN' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real', locale: 'pt-BR' },
  { code: 'RUB', symbol: '₽', name: 'Russian Ruble', locale: 'ru-RU' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand', locale: 'en-ZA' },
  { code: 'MXN', symbol: 'MX$', name: 'Mexican Peso', locale: 'es-MX' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', locale: 'en-SG' },
  { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar', locale: 'zh-HK' },
  { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar', locale: 'en-NZ' },
  { code: 'SEK', symbol: 'kr', name: 'Swedish Krona', locale: 'sv-SE' },
  { code: 'KRW', symbol: '₩', name: 'South Korean Won', locale: 'ko-KR' },
  { code: 'TRY', symbol: '₺', name: 'Turkish Lira', locale: 'tr-TR' },
  { code: 'AED', symbol: 'AED', name: 'UAE Dirham', locale: 'en-US', codeSuffix: true },
  { code: 'KWD', symbol: 'KWD', name: 'Kuwaiti Dinar', locale: 'en-US', codeSuffix: true },
  { code: 'THB', symbol: '฿', name: 'Thai Baht', locale: 'th-TH' },
  { code: 'PHP', symbol: '₱', name: 'Philippine Peso', locale: 'en-PH' },
  { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah', locale: 'id-ID' },
  { code: 'VND', symbol: '₫', name: 'Vietnamese Dong', locale: 'vi-VN' },
  { code: 'NGN', symbol: '₦', name: 'Nigerian Naira', locale: 'en-NG' },
  { code: 'ARS', symbol: 'AR$', name: 'Argentine Peso', locale: 'es-AR' },
];

// Preserve metadata for saved preferences/backups while retiring these picker options.
const retiredPickerCodes = new Set<CurrencyCode>(['VND', 'PHP', 'IDR', 'ARS']);
export const SELECTABLE_CURRENCIES = SUPPORTED_CURRENCIES.filter(
  ({ code }) => !retiredPickerCodes.has(code),
);

// Caches for Intl.NumberFormat instances to prevent garbage collection churn and constructor overhead during list scrolls.
const currencyFormatterCache = new Map<string, Intl.NumberFormat>();
const decimalFormatterCache = new Map<string, Intl.NumberFormat>();

export const currencyService = {
  formatSats(sats: number, options?: { explicitSign?: boolean }): string {
    const showBitcoinSymbol = useSettingsStore.getState().showBitcoinSymbol;
    const isNegative = sats < 0;
    const absSats = Math.abs(sats);
    const formatted = absSats.toLocaleString();
    let sign = '';
    if (isNegative) {
      sign = '-';
    } else if (options?.explicitSign && sats > 0) {
      sign = '+';
    }
    if (showBitcoinSymbol) {
      return `${sign}₿${formatted}`;
    }
    return `${sign}${formatted} sat`;
  },

  formatValue(value: number, currencyCode: CurrencyCode): string {
    // Show the magnitude bound before rounding so a nonzero value never looks like zero.
    if (Math.abs(value) > 0 && Math.abs(value) < 0.01) {
      return `${value < 0 ? '-' : ''}<${currencyService.formatValue(0.01, currencyCode)}`;
    }
    const currency =
      SUPPORTED_CURRENCIES.find((c) => c.code === currencyCode) || SUPPORTED_CURRENCIES[0];
    const useCodeSuffix = currency.codeSuffix === true;
    try {
      const cacheKey = `${currency.locale}_${currency.code}`;
      let formatter = currencyFormatterCache.get(cacheKey);
      if (!formatter) {
        formatter = new Intl.NumberFormat(currency.locale, {
          style: useCodeSuffix ? 'decimal' : 'currency',
          currency: currency.code,
          ...(useCodeSuffix ? { minimumFractionDigits: 2 } : {}),
          maximumFractionDigits: 2,
        });
        currencyFormatterCache.set(cacheKey, formatter);
      }
      const formatted = formatter.format(value);

      // React Native / Hermes has a bug on some platforms where Intl.NumberFormat
      // falls back to USD formatting, printing '$' or 'USD' instead of the requested currency symbol.
      // If the requested currency code is NOT USD, but the formatted output contains '$', 'USD', or 'US$',
      // or if the requested currency symbol is different from '$' but '$' was used, we trigger our fallback.
      if (
        currencyCode !== 'USD' &&
        (formatted.includes('$') ||
          formatted.includes('USD') ||
          formatted.includes('US$') ||
          (currency.symbol !== '$' && formatted.includes('$')))
      ) {
        throw new Error('Platform Intl fallback detected');
      }
      return useCodeSuffix ? `${formatted} ${currency.code}` : formatted;
    } catch (error) {
      // Fallback formatting: format the number as a decimal under the requested locale,
      // then manually prepend/append the correct currency symbol.
      let decimalPart = '';
      try {
        let decimalFormatter = decimalFormatterCache.get(currency.locale);
        if (!decimalFormatter) {
          decimalFormatter = new Intl.NumberFormat(currency.locale, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
          decimalFormatterCache.set(currency.locale, decimalFormatter);
        }
        decimalPart = decimalFormatter.format(value);
      } catch (e1) {
        try {
          // Fallback to standard en-US format for the decimal digits
          let enUsDecimalFormatter = decimalFormatterCache.get('en-US');
          if (!enUsDecimalFormatter) {
            enUsDecimalFormatter = new Intl.NumberFormat('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            });
            decimalFormatterCache.set('en-US', enUsDecimalFormatter);
          }
          decimalPart = enUsDecimalFormatter.format(value);
        } catch (e2) {
          decimalPart = value.toFixed(2);
        }
      }

      // Determine symbol position based on currency convention
      const suffixCurrencies = [
        'EUR',
        'PLN',
        'CZK',
        'SEK',
        'RUB',
        'CHF',
        'ZAR',
        'AED',
        'KWD',
        'VND',
      ];
      if (useCodeSuffix || suffixCurrencies.includes(currency.code)) {
        return `${decimalPart} ${currency.symbol}`;
      } else {
        return `${currency.symbol}${decimalPart}`;
      }
    }
  },

  getSymbol(currencyCode: CurrencyCode): string {
    return SUPPORTED_CURRENCIES.find((c) => c.code === currencyCode)?.symbol || '$';
  },

  async fetchBitcoinPrice(currencyCode: CurrencyCode) {
    return bitcoinService.fetchPrice(currencyCode);
  },

  convertSatsToCurrency(sats: number, btcPrice: number): number {
    // 1 BTC = 100,000,000 sats
    return (sats / 100000000) * btcPrice;
  },

  convertCurrencyToSats(fiatAmount: number, btcPrice: number): number {
    if (!btcPrice || btcPrice <= 0) return 0;
    return Math.floor((fiatAmount / btcPrice) * 100000000);
  },
};
