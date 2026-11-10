import { bech32 } from 'bech32';
import {
  conversationPaymentInput,
  conversationPaymentParts,
} from '~/features/people/conversationPaymentInput';
import { conversationPaymentLabel } from '~/features/people/conversationPaymentLabel';
import { PaymentRequest } from '@cashu/cashu-ts';
import { conversationDateLabel, conversationDayKey } from '~/features/people/conversationDates';
import { normalizeLightningInput, getLnurlPayParams } from '~/services/api/lnurlService';

const lnurl = (url: string) =>
  bech32.encode('lnurl', bech32.toWords(Array.from(url, (char) => char.charCodeAt(0))), 32000);

const request = new PaymentRequest([], 'test-request', 10, 'sat', [
  'https://mint.example',
]).toEncodedRequest();
const requestB =
  'CREQB1QYQQWER9D4HNZV3NQGQQSQQQQQQQQQQRAQPSQQGQQSQQZQG9QQVXSAR5WPEN5TE0D45KUAPWV4UXZMTSD3JJUCM0D5RQQRJRDANXVET9YPCXZ7TDV4H8GXHR3TQ';
it.each([
  ['lnbc210n1ptestinvoice', 'Lightning invoice', 'lightning'],
  ['LIGHTNING:LNBC1TEST', 'Lightning invoice', 'lightning'],
  ['lntb1test', 'Lightning invoice', 'lightning'],
  ['lnbcrt1test', 'Lightning invoice', 'lightning'],
  [lnurl('https://example.com/Pay'), 'LNURL payment', 'lightning'],
  ['lnurlp://example.com/Pay', 'LNURL payment', 'lightning'],
  ['alice@example.com', 'Lightning address', 'lightning'],
  ['lightning:alice@example.com', 'Lightning address', 'lightning'],
  ['cashuAencoded', 'Ecash token', 'cashu_token'],
  ['cashuBencoded', 'Ecash token', 'cashu_token'],
  ['cashu:cashuBencoded', 'Ecash token', 'cashu_token'],
  ['web+cashu://cashuAencoded', 'Ecash token', 'cashu_token'],
  [request, 'Ecash request', 'cashu_request'],
  [requestB, 'Ecash request', 'cashu_request'],
  [`cashu:${request}`, 'Ecash request', 'cashu_request'],
  ['bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', 'Bitcoin payment', 'onchain'],
  ['bitcoin:bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', 'Bitcoin payment', 'onchain'],
  [`bitcoin:?creq=${requestB}&lightning=lnbc210n1ptestinvoice`, 'Ecash request', 'cashu_request'],
])(
  'recognizes %s with label %s while leaving payment execution to the destination',
  (text, label, route) => {
    const input = conversationPaymentInput(text);
    expect(input?.route).toBe(route);
    expect(input?.error).toBeUndefined();
    expect(conversationPaymentLabel({ paymentInput: input })).toBe(label);
  },
);

it('retains malformed Cashu request identity without enabling payment actions', () => {
  const input = conversationPaymentInput('creqAbroken');
  expect(conversationPaymentLabel({ paymentInput: input })).toBe('Ecash request');
  expect(input?.error).toBeTruthy();
  expect(input?.route).toBeUndefined();
});

it.each([
  ['lnbc210n1ptestinvoice', 'Lightning invoice'],
  ['alice@example.com', 'Lightning address'],
  ['lnurlp://example.com/Pay?amount=10&note=Lunch', 'LNURL payment'],
  ['cashuBencoded', 'Ecash token'],
  [request, 'Ecash request'],
  ['bitcoin:bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh?amount=0.001', 'Bitcoin payment'],
  ['lno1offer', 'BOLT12 offer'],
])('extracts %s from a sentence, retaining only surrounding text in the note', (value, label) => {
  const parts = conversationPaymentParts(`Please review (${value}). Thank you!`);
  expect(parts.inputs).toHaveLength(1);
  expect(conversationPaymentLabel({ paymentInput: parts.inputs[0] })).toBe(label);
  expect(parts.inputs[0].value).toBe(value);
  expect(parts.note).toBe('Please review Thank you!');
});

it('extracts multiple payments independently without including encoded values in the note', () => {
  const parts = conversationPaymentParts(`Choose lnbc210n1ptestinvoice or ${request}`);
  expect(parts.inputs.map((input) => conversationPaymentLabel({ paymentInput: input }))).toEqual([
    'Lightning invoice',
    'Ecash request',
  ]);
  expect(parts.note).toBe('Choose or');
  expect(parts.note).not.toContain(request);
  expect(conversationPaymentParts('Just ordinary conversation').inputs).toEqual([]);
});

it('reads whole-sat invoice amounts for cards without fetching or executing a payment', () => {
  const encoded = bech32.encode('lnbc1000n', new Array(120).fill(0), 32000);
  expect(conversationPaymentInput(encoded)?.amount).toBe(100);
  expect(conversationPaymentInput('lnbc210n1ptestinvoice')?.amount).toBeUndefined();
  const subSat = bech32.encode('lnbc1p', new Array(120).fill(0), 32000);
  expect(conversationPaymentInput(subSat)?.amount).toBeUndefined();
});

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
