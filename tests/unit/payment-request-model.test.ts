import { PaymentRequest, PaymentRequestTransportType } from '@cashu/cashu-ts';
import { encode } from 'cbor-x';
import { Buffer } from 'buffer';
import { nip19 } from 'nostr-tools';
import {
  parsePaymentRequest,
  isPaymentMintAllowed,
  normalizePaymentMint,
} from '~/services/wallet/paymentRequestModel';

const target = nip19.nprofileEncode({ pubkey: '12'.repeat(32), relays: ['wss://relay.example'] });
function request(unit = 'sat', amount = 1, transport = true) {
  return new PaymentRequest(
    transport
      ? [
          {
            type: PaymentRequestTransportType.NOSTR,
            target,
            tags: [
              ['n', '17', '4'],
              ['custom', 'value'],
            ],
          },
        ]
      : [],
    'request',
    amount,
    unit,
    ['https://mint.example/Bitcoin'],
    'Coffee',
    true,
  );
}

describe('shared request validation', () => {
  it.each(['A', 'B'])('preserves creq%s semantics and complete transport tags', (version) => {
    const sdk = request();
    const parsed = parsePaymentRequest(
      version === 'A' ? sdk.toEncodedCreqA() : sdk.toEncodedCreqB(),
    );
    expect(parsed).toMatchObject({
      id: 'request',
      amount: 1,
      unit: 'sat',
      singleUse: true,
      delivery: 'nip17',
      mintPolicy: 'strict',
    });
    expect(parsed.transports[0].tags).toEqual([
      ['n', '17', '4'],
      ['custom', 'value'],
    ]);
    expect(isPaymentMintAllowed(parsed, 'https://mint.example/Bitcoin/')).toBe(true);
    expect(isPaymentMintAllowed(parsed, 'https://mint.example/bitcoin')).toBe(false);
  });
  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])('rejects invalid amount %s', (amount) => {
    const raw = 'creqA' + Buffer.from(encode({ a: amount, u: 'sat' })).toString('base64');
    expect(() => parsePaymentRequest(raw)).toThrow();
  });
  it('rejects missing amount and unsupported unit', () => {
    expect(() => parsePaymentRequest(new PaymentRequest().toEncodedCreqA())).toThrow('amount');
    expect(() => parsePaymentRequest(request('usd').toEncodedCreqA())).toThrow('Only sat');
  });
  it('uses in-band delivery only for NFC, and rejects unsupported transports', () => {
    const raw = request('sat', 1, false).toEncodedCreqA();
    expect(() => parsePaymentRequest(raw)).toThrow('No supported delivery');
    expect(parsePaymentRequest(raw, 'nfc').delivery).toBe('nfc');
    const sdk = request();
    sdk.transport![0].tags = [['n', '4']];
    expect(() => parsePaymentRequest(sdk.toEncodedCreqA(), 'nfc')).toThrow('No supported delivery');
    sdk.transport![0].type = PaymentRequestTransportType.POST;
    expect(() => parsePaymentRequest(sdk.toEncodedCreqA())).toThrow('No supported delivery');
  });
  it('rejects locking and method fees the installed SDK would otherwise discard', () => {
    for (const extra of [{ nut10: { k: 'P2PK', d: 'key' } }, { sm: [{ mn: 'bolt11', mf: 2 }] }]) {
      const raw = 'creqA' + Buffer.from(encode({ a: 1, u: 'sat', ...extra })).toString('base64');
      expect(() => parsePaymentRequest(raw, 'nfc')).toThrow('not supported');
    }
  });
  it('preserves advisory mint policy and validates URLs', () => {
    const raw =
      'creqA' +
      Buffer.from(encode({ a: 1, u: 'sat', m: ['https://mint.example'], mp: true })).toString(
        'base64',
      );
    expect(isPaymentMintAllowed(parsePaymentRequest(raw, 'nfc'), 'https://other.example')).toBe(
      true,
    );
    expect(() => normalizePaymentMint('https://user:secret@mint.example')).toThrow();
    expect(() => normalizePaymentMint('ftp://mint.example')).toThrow();
  });
});
