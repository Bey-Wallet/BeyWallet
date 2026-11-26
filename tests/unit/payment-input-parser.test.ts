import { parsePaymentInput } from '~/shared/utils/paymentInputParser';
import { resolveUniversalInput } from '~/shared/utils/universalInputResolver';
import { bech32, bech32m } from 'bech32';

const CREQB =
  'CREQB1QYQQWER9D4HNZV3NQGQQSQQQQQQQQQQRAQPSQQGQQSQQZQG9QQVXSAR5WPEN5TE0D45KUAPWV4UXZMTSD3JJUCM0D5RQQRJRDANXVET9YPCXZ7TDV4H8GXHR3TQ';
const INVOICE = 'lnbc210n1ptestinvoice';
const ADDRESS = 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh';

describe('parsePaymentInput', () => {
  const regtestAddresses = [
    bech32.encode('bcrt', [0, ...bech32.toWords(new Uint8Array(20).fill(1))]),
    bech32m.encode('bcrt', [1, ...bech32m.toWords(new Uint8Array(32).fill(2))]),
  ];
  it.each(regtestAddresses)(
    'recognizes a regtest address through paste and QR resolution (%s)',
    async (address) => {
      for (const input of [
        address,
        address.toUpperCase(),
        `bitcoin:${address}?amount=0.001`,
        `BITCOIN:${address}?label=Test`,
      ]) {
        const result = parsePaymentInput(input);
        expect(result.matched && result.ok && result.value.primary).toEqual({
          type: 'bitcoin_onchain',
          value: input.includes(':') ? address : input,
        });
        expect(await resolveUniversalInput(input)).toMatchObject({
          type: 'bitcoin_onchain',
          resolvedData: { address: input.includes(':') ? address : input },
        });
      }
    },
  );
  it('keeps unified payment priority and required-parameter checks for regtest URIs', () => {
    const address = regtestAddresses[0];
    const unified = parsePaymentInput(`bitcoin:${address}?lightning=${INVOICE}`);
    expect(unified.matched && unified.ok && unified.value.alternatives).toEqual([
      { type: 'lightning_invoice', value: INVOICE },
      { type: 'bitcoin_onchain', value: address },
    ]);
    expect(parsePaymentInput(`bitcoin:${address}?req-unsupported=1`)).toMatchObject({
      matched: true,
      ok: false,
    });
    expect(parsePaymentInput('bcrt1')).toEqual({ matched: false });
  });
  it('prefers the Cashu request in a Numo unified URI', () => {
    const result = parsePaymentInput(`bitcoin:?creq=${CREQB}&lightning=${INVOICE}`);

    expect(result).toEqual({
      matched: true,
      ok: true,
      value: {
        raw: `bitcoin:?creq=${CREQB}&lightning=${INVOICE}`,
        normalized: CREQB,
        primary: { type: 'cashu_request', value: CREQB },
        alternatives: [
          { type: 'cashu_request', value: CREQB },
          { type: 'lightning_invoice', value: INVOICE },
        ],
        source: 'bitcoin_uri',
      },
    });
  });

  it('handles parameter order, key casing, and percent encoding', () => {
    const result = parsePaymentInput(
      `BITCOIN:?lightning=${INVOICE}&CREQ=${encodeURIComponent(CREQB)}`,
    );

    expect(result.matched).toBe(true);
    expect(result.matched && result.ok && result.value.primary).toEqual({
      type: 'cashu_request',
      value: CREQB,
    });
  });

  it('retains an on-chain address as a fallback alternative', () => {
    const result = parsePaymentInput(
      `bitcoin:${ADDRESS}?lightning=${INVOICE}&creq=${CREQB.toLowerCase()}`,
    );

    expect(result.matched && result.ok && result.value.alternatives).toEqual([
      { type: 'cashu_request', value: CREQB.toLowerCase() },
      { type: 'lightning_invoice', value: INVOICE },
      { type: 'bitcoin_onchain', value: ADDRESS },
    ]);
  });

  it('rejects an invalid Cashu request instead of falling back to Lightning', () => {
    const result = parsePaymentInput(`bitcoin:?creq=not-a-request&lightning=${INVOICE}`);

    expect(result).toEqual({
      matched: true,
      ok: false,
      reason: 'Invalid Cashu payment request',
    });
  });

  it('rejects conflicting duplicate payment parameters', () => {
    const result = parsePaymentInput(`bitcoin:?creq=${CREQB}&creq=creqBdifferent`);

    expect(result).toEqual({
      matched: true,
      ok: false,
      reason: 'Ambiguous duplicate creq parameter',
    });
  });

  it('allows identical duplicate payment parameters', () => {
    const result = parsePaymentInput(`bitcoin:?creq=${CREQB}&creq=${CREQB}`);

    expect(result.matched && result.ok && result.value.primary).toEqual({
      type: 'cashu_request',
      value: CREQB,
    });
  });

  it('rejects required parameters it does not support', () => {
    const result = parsePaymentInput(`bitcoin:?creq=${CREQB}&req-example=1`);

    expect(result).toEqual({
      matched: true,
      ok: false,
      reason: 'Unsupported required Bitcoin URI parameter: req-example',
    });
  });

  it('rejects malformed percent encoding and empty Bitcoin URIs', () => {
    expect(parsePaymentInput('bitcoin:?creq=%ZZ')).toEqual({
      matched: true,
      ok: false,
      reason: 'Malformed Bitcoin URI encoding',
    });
    expect(parsePaymentInput('bitcoin:?')).toEqual({
      matched: true,
      ok: false,
      reason: 'Bitcoin URI has no supported payment method',
    });
  });

  it('rejects oversized inputs before decoding', () => {
    expect(parsePaymentInput(`bitcoin:?creq=${'a'.repeat(32_001)}`)).toEqual({
      matched: true,
      ok: false,
      reason: 'Payment input is too large',
    });
  });

  it('does not claim unrelated inputs', () => {
    expect(parsePaymentInput('https://example.com/?creq=not-a-request')).toEqual({
      matched: false,
    });
  });

  it.each([
    ['cashu:cashuBabc123', 'cashu_token', 'cashuBabc123'],
    [`cashu:${CREQB}`, 'cashu_request', CREQB],
    [`lightning:${INVOICE}`, 'lightning_invoice', INVOICE],
    [ADDRESS, 'bitcoin_onchain', ADDRESS],
  ])('preserves existing input behavior for %s', (input, type, value) => {
    const result = parsePaymentInput(input);

    expect(result.matched && result.ok && result.value.primary).toEqual({ type, value });
  });
});

describe('resolveUniversalInput', () => {
  it.each(['alice@example.com', 'satoshi@bey.cash', 'LIGHTNING:alice@example.com'])(
    'treats %s as a Lightning address without looking up a Nostr identity',
    async (input) => {
      const fetch = jest.spyOn(global, 'fetch');
      try {
        const address = input.replace(/^lightning:/i, '');
        expect(await resolveUniversalInput(`  ${input}  `)).toMatchObject({
          type: 'lightning_address',
          cleaned: address,
          resolvedData: { address },
        });
        expect(fetch).not.toHaveBeenCalled();
      } finally {
        fetch.mockRestore();
      }
    },
  );

  it.each([
    'alice',
    '@alice',
    'npub1-person',
    'nprofile1-person',
    'nostr:alice@example.com',
    'web+nostr:npub1-person',
    'a'.repeat(64),
    'https://bey.cash/u/alice',
    'bey.cash/user/alice',
  ])('directs Nostr recipient %s to People without a lookup', async (input) => {
    const fetch = jest.spyOn(global, 'fetch');
    try {
      expect(await resolveUniversalInput(input)).toMatchObject({
        type: 'unknown',
        error: 'To send to a person, use the People tab.',
      });
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      fetch.mockRestore();
    }
  });

  it('keeps LNURL inputs on the Lightning path', async () => {
    expect(await resolveUniversalInput('lnurl1-payment')).toMatchObject({
      type: 'lightning_address',
      cleaned: 'lnurl1-payment',
    });
  });

  it('routes a Numo unified URI as a Cashu request', async () => {
    const result = await resolveUniversalInput(
      `bitcoin:?lightning=${INVOICE}&creq=${encodeURIComponent(CREQB)}`,
    );

    expect(result).toMatchObject({
      type: 'cashu_request',
      cleaned: CREQB,
      resolvedData: { paymentRequest: CREQB },
    });
  });

  it('returns a useful error for an invalid unified Cashu request', async () => {
    const result = await resolveUniversalInput(`bitcoin:?creq=invalid&lightning=${INVOICE}`);

    expect(result).toMatchObject({
      type: 'unknown',
      error: 'Invalid Cashu payment request',
    });
  });
});
