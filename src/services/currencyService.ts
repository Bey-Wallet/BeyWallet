import { useSettingsStore } from "../store/settingsStore";

export type CurrencyCode = 
    | 'USD' | 'EUR' | 'GBP' | 'JPY' | 'AUD' | 'CAD' | 'CHF' 
    | 'CNY' | 'INR' | 'BRL' | 'RUB' | 'ZAR' | 'MXN' | 'SGD' 
    | 'HKD' | 'NZD' | 'SEK' | 'KRW' | 'TRY' | 'AED' | 'KWD';

export interface Currency {
    code: CurrencyCode;
    symbol: string;
    name: string;
    locale: string;
}

export const SUPPORTED_CURRENCIES: Currency[] = [
    { code: 'USD', symbol: '$', name: 'US Dollar', locale: 'en-US' },
    { code: 'EUR', symbol: '€', name: 'Euro', locale: 'de-DE' },
    { code: 'GBP', symbol: '£', name: 'British Pound', locale: 'en-GB' },
    { code: 'JPY', symbol: '¥', name: 'Japanese Yen', locale: 'ja-JP' },
    { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', locale: 'en-AU' },
    { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', locale: 'en-CA' },
    { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc', locale: 'de-CH' },
    { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', locale: 'zh-CN' },
    { code: 'INR', symbol: '₹', name: 'Indian Rupee', locale: 'en-IN' },
    { code: 'BRL', symbol: 'R$', name: 'Brazilian Real', locale: 'pt-BR' },
    { code: 'RUB', symbol: '₽', name: 'Russian Ruble', locale: 'ru-RU' },
    { code: 'ZAR', symbol: 'R', name: 'South African Rand', locale: 'en-ZA' },
    { code: 'MXN', symbol: '$', name: 'Mexican Peso', locale: 'es-MX' },
    { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', locale: 'en-SG' },
    { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar', locale: 'zh-HK' },
    { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar', locale: 'en-NZ' },
    { code: 'SEK', symbol: 'kr', name: 'Swedish Krona', locale: 'sv-SE' },
    { code: 'KRW', symbol: '₩', name: 'South Korean Won', locale: 'ko-KR' },
    { code: 'TRY', symbol: '₺', name: 'Turkish Lira', locale: 'tr-TR' },
    { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham', locale: 'ar-AE' },
    { code: 'KWD', symbol: 'د.ك', name: 'Kuwaiti Dinar', locale: 'ar-KW' },
];

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
        return `${sign}${formatted} SATS`;
    },

    formatValue(value: number, currencyCode: CurrencyCode): string {
        const currency = SUPPORTED_CURRENCIES.find(c => c.code === currencyCode) || SUPPORTED_CURRENCIES[0];
        try {
            const cacheKey = `${currency.locale}_${currency.code}`;
            let formatter = currencyFormatterCache.get(cacheKey);
            if (!formatter) {
                formatter = new Intl.NumberFormat(currency.locale, {
                    style: 'currency',
                    currency: currency.code,
                    maximumFractionDigits: 2
                });
                currencyFormatterCache.set(cacheKey, formatter);
            }
            const formatted = formatter.format(value);

            // React Native / Hermes has a bug on some platforms where Intl.NumberFormat 
            // falls back to USD formatting, printing '$' or 'USD' instead of the requested currency symbol.
            // If the requested currency code is NOT USD, but the formatted output contains '$', 'USD', or 'US$',
            // or if the requested currency symbol is different from '$' but '$' was used, we trigger our fallback.
            if (currencyCode !== 'USD' && (
                formatted.includes('$') || 
                formatted.includes('USD') || 
                formatted.includes('US$') ||
                (currency.symbol !== '$' && formatted.includes('$'))
            )) {
                throw new Error('Platform Intl fallback detected');
            }
            return formatted;
        } catch (error) {
            // Fallback formatting: format the number as a decimal under the requested locale,
            // then manually prepend/append the correct currency symbol.
            let decimalPart = '';
            try {
                let decimalFormatter = decimalFormatterCache.get(currency.locale);
                if (!decimalFormatter) {
                    decimalFormatter = new Intl.NumberFormat(currency.locale, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
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
                            maximumFractionDigits: 2
                        });
                        decimalFormatterCache.set('en-US', enUsDecimalFormatter);
                    }
                    decimalPart = enUsDecimalFormatter.format(value);
                } catch (e2) {
                    decimalPart = value.toFixed(2);
                }
            }

            // Determine symbol position based on currency convention
            const suffixCurrencies = ['EUR', 'SEK', 'RUB', 'CHF', 'ZAR'];
            if (suffixCurrencies.includes(currency.code)) {
                return `${decimalPart} ${currency.symbol}`;
            } else {
                return `${currency.symbol}${decimalPart}`;
            }
        }
    },

    getSymbol(currencyCode: CurrencyCode): string {
        return SUPPORTED_CURRENCIES.find(c => c.code === currencyCode)?.symbol || '$';
    },

    async fetchBitcoinPrice(currencyCode: CurrencyCode) {
        const vsCurrency = currencyCode.toLowerCase();
        const priceRes = await fetch(
            `https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=${vsCurrency}&include_24hr_change=true`
        );

        if (!priceRes.ok) {
            throw new Error(`Price API failed: ${priceRes.status}`);
        }

        const priceData = await priceRes.json();

        if (!priceData?.bitcoin?.[vsCurrency]) {
            throw new Error(`Invalid price format from CoinGecko for ${vsCurrency}`);
        }

        return {
            price: priceData.bitcoin[vsCurrency],
            change24h: priceData.bitcoin[`${vsCurrency}_24h_change`] || 0,
            updatedAt: Math.floor(Date.now() / 1000),
        };
    },

    convertSatsToCurrency(sats: number, btcPrice: number): number {
        // 1 BTC = 100,000,000 sats
        return (sats / 100000000) * btcPrice;
    },

    convertCurrencyToSats(fiatAmount: number, btcPrice: number): number {
        if (!btcPrice || btcPrice <= 0) return 0;
        return Math.floor((fiatAmount / btcPrice) * 100000000);
    }
};
