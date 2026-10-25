import { createNpubCashClient, NPUB_CASH } from '~/services/api/npubCashClient';

const signed = { id: 'synthetic-id', pubkey: 'synthetic-public-key', sig: 'synthetic-signature' };
const signer = jest.fn(async (event) => ({ ...event, ...signed }));
const response = (body: unknown) => ({ ok: true, json: async () => body }) as Response;
beforeEach(() => {
  signer.mockClear();
  global.fetch = jest.fn();
});

it('discovers more than 50 quotes and authenticates only once with an in-memory JWT', async () => {
  const fetch = global.fetch as jest.Mock;
  fetch.mockResolvedValueOnce(response({ error: false, data: { token: 'synthetic-jwt' } }));
  fetch.mockResolvedValueOnce(
    response({
      error: false,
      data: { quotes: Array.from({ length: 50 }, (_, i) => ({ quoteId: `quote-${i}` })) },
      metadata: { total: 51 },
    }),
  );
  fetch.mockResolvedValueOnce(
    response({
      error: false,
      data: { quotes: [{ quoteId: 'quote-50' }] },
      metadata: { total: 51 },
    }),
  );
  const quotes = await createNpubCashClient(NPUB_CASH, signer).getQuotesSince(99);
  expect(quotes).toHaveLength(51);
  expect(fetch.mock.calls[1][0]).toBe(
    `${NPUB_CASH}/api/v2/wallet/quotes?offset=0&limit=50&since=99`,
  );
  expect(fetch.mock.calls[2][0]).toContain('offset=50');
  expect(signer).toHaveBeenCalledTimes(1);
  expect(signer.mock.calls[0][0]).toMatchObject({
    kind: 27235,
    tags: [
      ['u', `${NPUB_CASH}/api/v2/auth/nip98`],
      ['method', 'GET'],
    ],
  });
});

it('refuses authentication challenges for other origins, methods and paths', async () => {
  const client: any = createNpubCashClient(NPUB_CASH, signer);
  await expect(
    client.authProvider.getNostrToken('wss://attacker.test/api/v2/ws/quote', 'GET'),
  ).rejects.toThrow();
  await expect(
    client.authProvider.getNostrToken('wss://npub.cash/api/v2/ws/quote', 'POST'),
  ).rejects.toThrow();
  await expect(
    client.authProvider.getAuthToken('https://attacker.test/api/v2/user/info', 'GET'),
  ).rejects.toThrow();
  expect(signer).not.toHaveBeenCalled();
  expect(global.fetch).not.toHaveBeenCalled();
});

it('does not authenticate new pages after the wallet stops being available', async () => {
  let available = true;
  const fetch = global.fetch as jest.Mock;
  fetch.mockResolvedValueOnce(response({ error: false, data: { token: 'synthetic-jwt' } }));
  fetch.mockImplementationOnce(async () => {
    available = false;
    return response({
      error: false,
      data: { quotes: Array.from({ length: 50 }, () => ({})) },
      metadata: { total: 51 },
    });
  });
  await expect(
    createNpubCashClient(NPUB_CASH, signer, () => available).getAllQuotes(),
  ).rejects.toThrow();
  expect(fetch).toHaveBeenCalledTimes(2);
});

it('does not start discovery if the wallet locks during JWT exchange', async () => {
  let available = true;
  const fetch = global.fetch as jest.Mock;
  fetch.mockImplementationOnce(async () => {
    available = false;
    return response({ error: false, data: { token: 'synthetic-jwt' } });
  });
  await expect(
    createNpubCashClient(NPUB_CASH, signer, () => available).getAllQuotes(),
  ).rejects.toThrow();
  expect(fetch).toHaveBeenCalledTimes(1);
});
