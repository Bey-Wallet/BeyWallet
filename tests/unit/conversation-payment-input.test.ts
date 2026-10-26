import { bech32 } from 'bech32';
import { conversationPaymentInput } from '~/features/people/conversationPaymentInput';
import { conversationDateLabel, conversationDayKey } from '~/features/people/conversationDates';
import { normalizeLightningInput, getLnurlPayParams } from '~/services/api/lnurlService';

const lnurl = (url: string) =>
  bech32.encode('lnurl', bech32.toWords(Array.from(url, (char) => char.charCodeAt(0))), 32000);

it.each(['lnbc210n1ptestinvoice', 'lntb1test', 'lnbcrt1test', 'LIGHTNING:LNBC1TEST'])(
  'recognizes invoice %s without reporting a payment outcome',
  (text) => {
    expect(conversationPaymentInput(text)).toMatchObject({
      route: 'lightning',
      type: 'Lightning · Invoice',
    });
  },
);

it('decodes LNURL locally, preserves path case and supports address and LNURL-pay forms', () => {
  const encoded = lnurl('https://example.com/Pay?name=Alice');
  expect(normalizeLightningInput(encoded)).toBe('lnurlp://example.com/Pay?name=Alice');
  expect(conversationPaymentInput(`lightning:${encoded.toUpperCase()}`)).toMatchObject({
    value: 'lnurlp://example.com/Pay?name=Alice',
    route: 'lightning',
  });
  expect(conversationPaymentInput('alice@example.com')?.route).toBe('lightning');
  expect(conversationPaymentInput('lnurlp://example.com/Pay')?.route).toBe('lightning');
  expect(conversationPaymentInput('Hello Alice')).toBeUndefined();
});

it.each([
  'http://example.com/pay',
  'https://user:pass@example.com/pay',
  'https://example.com/pay#secret',
  'javascript:alert(1)',
])('rejects unsafe LNURL destination %s', (url) => {
  expect(conversationPaymentInput(lnurl(url))).toMatchObject({
    error: 'Invalid Lightning payment',
  });
  expect(conversationPaymentInput(lnurl(url))?.route).toBeUndefined();
});

it('rejects invalid checksums and does not downgrade unsupported payment formats to text', () => {
  expect(conversationPaymentInput('lnurl1invalid')?.error).toBeTruthy();
  expect(conversationPaymentInput('lightning:garbage')?.error).toBeTruthy();
  expect(conversationPaymentInput('lno1offer')).toMatchObject({
    type: 'Lightning · BOLT12',
    error: 'BOLT12 offers are not supported yet',
  });
  expect(
    conversationPaymentInput('bitcoin:bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh')?.route,
  ).toBe('onchain');
});

it('resolves encoded LNURL through the existing payment service only when requested', async () => {
  const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => ({
      tag: 'payRequest',
      callback: 'https://example.com/callback',
      minSendable: 1000,
      maxSendable: 1000000,
    }),
  } as Response);
  try {
    const encoded = lnurl('https://example.com/Pay');
    conversationPaymentInput(encoded);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await getLnurlPayParams(encoded)).toMatchObject({ tag: 'payRequest' });
    expect(fetchMock).toHaveBeenCalledWith('https://example.com/Pay');
  } finally {
    fetchMock.mockRestore();
  }
});

it('groups by local calendar day and labels today, yesterday, and older dates across year boundaries', () => {
  const now = new Date(2026, 0, 1, 12);
  expect(conversationDateLabel(new Date(2026, 0, 1, 0, 1).getTime(), now)).toBe('Today');
  expect(conversationDateLabel(new Date(2025, 11, 31, 23, 59).getTime(), now)).toBe('Yesterday');
  expect(conversationDateLabel(new Date(2025, 10, 10).getTime(), now)).toContain('2025');
  expect(conversationDayKey(new Date(2026, 0, 1, 0).getTime())).toBe(
    conversationDayKey(new Date(2026, 0, 1, 23, 59).getTime()),
  );
});
