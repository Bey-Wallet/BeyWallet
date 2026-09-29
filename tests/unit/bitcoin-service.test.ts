import { bitcoinService } from '~/services/api/bitcoinService';
import { sqliteStorage } from '~/storage/sqlite/sqliteStorage';

jest.mock('~/storage/sqlite/sqliteStorage', () => ({
  sqliteStorage: { getItem: jest.fn(() => null), setItem: jest.fn(), removeItem: jest.fn() },
}));

const fetchMock = jest.fn();

describe('bitcoinService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = fetchMock;
  });

  it('fetches and caches price data from CoinPaprika', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        quotes: {
          INR: { price: 8_092_513.67, percent_change_24h: 0.98 },
        },
      }),
    });

    const result = await bitcoinService.fetchPrice('INR');

    expect(result).toMatchObject({ price: 8_092_513.67, change24h: 0.98 });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.coinpaprika.com/v1/tickers/btc-bitcoin?quotes=INR',
    );
    expect(sqliteStorage.setItem).toHaveBeenCalledWith(
      'btc_price_cache_inr',
      JSON.stringify(result),
    );
  });

  it('falls back to Coinbase when CoinPaprika rejects a currency', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 400 }).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { amount: '309756.42' } }),
    });

    const result = await bitcoinService.fetchPrice('AED');

    expect(result).toMatchObject({ price: 309_756.42, change24h: 0 });
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://api.coinbase.com/v2/prices/BTC-AED/spot');
  });

  it('uses the local cache when both price providers fail', async () => {
    const cached = { price: 84_000, change24h: -1.2, updatedAt: 123 };
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: false, status: 429 });
    (sqliteStorage.getItem as jest.Mock).mockReturnValueOnce(JSON.stringify(cached));
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    await expect(bitcoinService.fetchPrice('USD')).resolves.toEqual(cached);
    expect(sqliteStorage.getItem).toHaveBeenCalledWith('btc_price_cache_usd');
  });
});
