import { sqliteStorage } from '~/storage/sqlite/sqliteStorage';

export interface BitcoinPriceData {
  price: number;
  change24h: number;
  updatedAt: number;
}

export const bitcoinService = {
  async fetchPrice(currency: string = 'usd'): Promise<BitcoinPriceData> {
    const vsCurrency = currency.toLowerCase();
    try {
      const priceRes = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=${vsCurrency}&include_24hr_change=true`,
      );

      if (!priceRes.ok) {
        throw new Error(`Price API failed: ${priceRes.status}`);
      }

      const priceData = await priceRes.json();

      if (!priceData?.bitcoin?.[vsCurrency]) {
        throw new Error(`Invalid price format from CoinGecko for ${vsCurrency}`);
      }

      const parsedData = {
        price: priceData.bitcoin[vsCurrency],
        change24h: priceData.bitcoin[`${vsCurrency}_24h_change`] || 0,
        updatedAt: Math.floor(Date.now() / 1000),
      };

      // Save to local cache synchronously
      sqliteStorage.setItem(`btc_price_cache_${vsCurrency}`, JSON.stringify(parsedData));

      return parsedData;
    } catch (error) {
      console.warn(`[BitcoinService] Network fetch failed, falling back to cache...`, error);

      const cached = sqliteStorage.getItem(`btc_price_cache_${vsCurrency}`);
      if (cached) {
        try {
          return JSON.parse(cached) as BitcoinPriceData;
        } catch (parseError) {
          console.error('[BitcoinService] Failed to parse cached price:', parseError);
        }
      }
      throw new Error('Network error and no local cache available.');
    }
  },

  async getFromDb(currency: string = 'usd'): Promise<BitcoinPriceData | null> {
    const vsCurrency = currency.toLowerCase();
    const cached = sqliteStorage.getItem(`btc_price_cache_${vsCurrency}`);
    if (cached) {
      try {
        return JSON.parse(cached) as BitcoinPriceData;
      } catch (err) {
        return null;
      }
    }
    return null;
  },
};
