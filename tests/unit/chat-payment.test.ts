import {
  getDecodedToken,
  getEncodedTokenV3,
  getEncodedTokenV4,
  PaymentRequest,
} from '@cashu/cashu-ts';
import { inspectChatPayment } from '~/services/wallet/chatPayment';
import { withTokenMemo } from '~/services/wallet/tokenUtils';
import { decode as decodeCbor } from 'cbor-x';

const token = {
  mint: 'https://mint.example/Bitcoin',
  unit: 'sat',
  proofs: [
    {
      id: '00' + 'ab'.repeat(7),
      amount: 8,
      secret: JSON.stringify(['P2PK', { nonce: 'fixture', data: '02' + '22'.repeat(32) }]),
      C: '02' + '11'.repeat(32),
    },
  ],
};

it('adds a memo offline without keyset lookups and retains every V4 proof field', () => {
  const encoded = getEncodedTokenV4({
    ...token,
    proofs: [{ ...token.proofs[0], id: '01' + 'ab'.repeat(31), witness: 'fixture-witness' }],
  });
  const original = decodeCbor(Buffer.from(encoded.slice(6), 'base64'));
  const result = withTokenMemo(encoded, 'Offline note');
  expect(decodeCbor(Buffer.from(result.slice(6), 'base64'))).toEqual({
    ...original,
    d: 'Offline note',
  });
});

it.each([getEncodedTokenV3, getEncodedTokenV4])(
  'adds a memo without changing proofs, locks, or amounts',
  (encode) => {
    const original = encode(token);
    const encoded = withTokenMemo(original, '  Lunch ☕  ');
    expect(getDecodedToken(encoded)).toEqual({ ...getDecodedToken(original), memo: 'Lunch ☕' });
    expect(inspectChatPayment(encoded)).toMatchObject({
      type: 'token',
      amount: 8,
      note: 'Lunch ☕',
    });
    expect(withTokenMemo(original, '   ')).toBe(original);
  },
);

it('shares an existing request and retains its description and correlation ID', () => {
  const encoded = new PaymentRequest(
    [],
    'outside-request',
    8,
    'sat',
    [token.mint],
    'Lunch',
  ).toEncodedRequest();
  expect(inspectChatPayment(encoded)).toEqual({
    encoded,
    type: 'request',
    amount: 8,
    requestId: 'outside-request',
    note: 'Lunch',
  });
});

it.each(['cashuAbroken', 'creqAbroken', '{"proofs":[]}', 'Hello'])(
  'rejects malformed payment-shaped content (%s)',
  (value) => {
    expect(() => inspectChatPayment(value)).toThrow();
  },
);

it('rejects invalid amounts and unsupported denominations without publishing', () => {
  expect(() => inspectChatPayment(getEncodedTokenV3({ ...token, unit: 'usd' }))).toThrow();
  expect(() =>
    inspectChatPayment(new PaymentRequest([], 'zero', 0, 'sat', [token.mint]).toEncodedRequest()),
  ).toThrow();
});
