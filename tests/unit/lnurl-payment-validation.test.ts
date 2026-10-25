import { bech32 } from 'bech32';
import { getLnurlPayParams, requestInvoiceFromLnurl } from '~/services/api/lnurlService';

const params = {
  tag: 'payRequest',
  callback: 'https://npub.cash/callback',
  minSendable: 1000,
  maxSendable: 1000000,
};
const invoice = (prefix: string) => bech32.encode(prefix, [1, 2, 3], 32000);
const response = (data: unknown, ok = true) => ({ ok, json: async () => data }) as Response;
beforeEach(() => {
  global.fetch = jest.fn();
});
it('routes ordinary Lightning addresses through discovery and checks invoice amounts exactly', async () => {
  const fetch = global.fetch as jest.Mock;
  fetch
    .mockResolvedValueOnce(response(params))
    .mockResolvedValueOnce(response({ pr: invoice('lnbc80n') }));
  expect(await requestInvoiceFromLnurl('alice@npub.cash', 8)).toBe(invoice('lnbc80n'));
  expect(fetch.mock.calls[0][0]).toBe('https://npub.cash/.well-known/lnurlp/alice');
  expect(fetch.mock.calls[1][0]).toBe('https://npub.cash/callback?amount=8000');
});
it.each([
  { status: 'ERROR', reason: 'No such account' },
  { ...params, minSendable: -1 },
  { ...params, maxSendable: 0 },
  { ...params, callback: 'javascript:alert(1)' },
  { ...params, tag: 'withdrawRequest' },
])('rejects invalid or failed discovery', async (data) => {
  (global.fetch as jest.Mock).mockResolvedValueOnce(response(data));
  await expect(getLnurlPayParams('alice@npub.cash')).rejects.toThrow();
});
it.each([0, -1, 1.2, Number.MAX_SAFE_INTEGER, 2000])(
  'rejects invalid amounts and limits before requesting an invoice: %s',
  async (amount) => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(response(params));
    await expect(requestInvoiceFromLnurl('alice@npub.cash', amount)).rejects.toThrow();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  },
);
it.each([
  { status: 'ERROR', reason: 'Mint unavailable' },
  { pr: invoice('lnbc90n') },
  { pr: invoice('lnbc') },
  { pr: 'not-an-invoice' },
])('rejects callback errors and mismatched invoices', async (data) => {
  (global.fetch as jest.Mock)
    .mockResolvedValueOnce(response(params))
    .mockResolvedValueOnce(response(data));
  await expect(requestInvoiceFromLnurl('alice@npub.cash', 8)).rejects.toThrow();
});
