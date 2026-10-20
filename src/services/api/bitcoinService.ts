import { sqliteStorage } from '~/storage/sqlite/sqliteStorage';

export interface BitcoinPriceData {
  price: number;
  change24h: number;
  updatedAt: number;
}

function isValidPrice(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function readCachedPrice(currency: string): BitcoinPriceData | null {
  try {
    const cached = sqliteStorage.getItem(`btc_price_cache_${currency.toLowerCase()}`);
    if (!cached) return null;
    const data = JSON.parse(cached);
    return isValidPrice(data?.price) &&
      Number.isFinite(data?.change24h) &&
      Number.isFinite(data?.updatedAt) &&
      data.updatedAt > 0
      ? data
      : null;
  } catch {
    return null;
  }
}

async function fetchFromCoinPaprika(vsCurrency: string): Promise<BitcoinPriceData> {
  const quoteCurrency = vsCurrency.toUpperCase();
  const response = await fetch(
    `https://api.coinpaprika.com/v1/tickers/btc-bitcoin?quotes=${encodeURIComponent(quoteCurrency)}`,
  );

  if (!response.ok) {
    throw new Error(`CoinPaprika price API failed: ${response.status}`);
  }

  const data = await response.json();
  const quote = data?.quotes?.[quoteCurrency];

  if (!isValidPrice(quote?.price)) {
    throw new Error(`Invalid price format from CoinPaprika for ${vsCurrency}`);
  }

  return {
    price: quote.price,
    change24h: Number.isFinite(quote.percent_change_24h) ? quote.percent_change_24h : 0,
    updatedAt: Math.floor(Date.now() / 1000),
  };
}

async function fetchFromCoinbase(vsCurrency: string): Promise<BitcoinPriceData> {
  const quoteCurrency = vsCurrency.toUpperCase();
  const response = await fetch(
    `https://api.coinbase.com/v2/prices/BTC-${encodeURIComponent(quoteCurrency)}/spot`,
  );

  if (!response.ok) {
    throw new Error(`Coinbase price API failed: ${response.status}`);
  }

  const data = await response.json();
  const price = Number(data?.data?.amount);

  if (!isValidPrice(price)) {
    throw new Error(`Invalid price format from Coinbase for ${vsCurrency}`);
  }

  return {
    price,
    change24h: 0,
    updatedAt: Math.floor(Date.now() / 1000),
  };
}

export const bitcoinService = {
  getCachedPrice: readCachedPrice,
  async fetchPrice(currency: string = 'usd'): Promise<BitcoinPriceData> {
    const vsCurrency = currency.toLowerCase();
    try {
      let parsedData: BitcoinPriceData;
      try {
        parsedData = await fetchFromCoinPaprika(vsCurrency);
      } catch (primaryError) {
        try {
          parsedData = await fetchFromCoinbase(vsCurrency);
        } catch (fallbackError) {
          throw new AggregateError(
            [primaryError, fallbackError],
            `All Bitcoin price providers failed for ${vsCurrency}`,
          );
        }
      }

      // Save to local cache synchronously
      sqliteStorage.setItem(`btc_price_cache_${vsCurrency}`, JSON.stringify(parsedData));

      return parsedData;
    } catch (error) {
      console.warn(`[BitcoinService] Network fetch failed, falling back to cache...`, error);

      const cached = readCachedPrice(vsCurrency);
      if (cached) return cached;
      throw new Error('Network error and no local cache available.');
    }
  },

  async getFromDb(currency: string = 'usd'): Promise<BitcoinPriceData | null> {
    return readCachedPrice(currency);
  },
};
