import { reclaimOptions, RECLAIM_PRESETS, supportsReclaim } from '~/services/wallet/reclaimPolicy';
import { supportsPaymentMethod } from '~/services/wallet/paymentMintPolicy';
import { execFileSync } from 'child_process';

const pubkey = '02' + 'a'.repeat(64);
const refund = '02' + 'b'.repeat(64);

it.each(RECLAIM_PRESETS)('encodes the $label preset as a refund path', ({ hours }) => {
  const now = 1700000000000;
  const options = reclaimOptions(
    pubkey,
    hours ? now + hours * 3600000 : undefined,
    hours ? refund : undefined,
    now,
  );
  expect(options).toEqual(
    hours ? { pubkey, locktime: (now + hours * 3600000) / 1000, refundKeys: [refund] } : { pubkey },
  );
  expect(JSON.stringify(options)).not.toContain('privkey');
});

it.each([undefined, null, {}, { nuts: {} }, { nuts: { 11: { supported: false } } }])(
  'hides reclaim without explicit support',
  (info) => {
    expect(supportsReclaim(info)).toBe(false);
  },
);

it('accepts advertised NUT-11 and rejects expired deadlines and missing refund keys', () => {
  expect(supportsReclaim({ nuts: { 11: { supported: true } } })).toBe(true);
  expect(() => reclaimOptions(pubkey, 100, refund, 101)).toThrow('future');
  expect(() => reclaimOptions(pubkey, 200, undefined, 100)).toThrow('refund');
});

it('filters method and unit compatibility conservatively', () => {
  const info = { nuts: { 4: { methods: [{ method: 'bolt11', unit: 'sat' }] } } };
  expect(supportsPaymentMethod(info, 'mint-lightning')).toBe(true);
  expect(supportsPaymentMethod(info, 'melt-lightning')).toBe(false);
  expect(supportsPaymentMethod(info, 'mint-onchain')).toBe(false);
  expect(supportsPaymentMethod(null, 'p2pk')).toBe(false);
});

it('encodes the refund and locktime tags with the installed Cashu SDK', () => {
  const key = '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';
  const options = reclaimOptions(key, 1900000000000, key, 1700000000000);
  const encoded = execFileSync(
    process.execPath,
    [
      '-e',
      `
    const { OutputData } = require('@cashu/cashu-ts');
    const data = OutputData.createSingleP2PKData(JSON.parse(process.argv[1]), 1, '009a1f293253e41e');
    process.stdout.write(new TextDecoder().decode(data.secret));
  `,
      JSON.stringify(options),
    ],
    { encoding: 'utf8' },
  );
  const [kind, condition] = JSON.parse(encoded);
  expect(kind).toBe('P2PK');
  expect(condition.data).toBe(key);
  expect(condition.tags).toContainEqual(['locktime', '1900000000']);
  expect(condition.tags).toContainEqual(['refund', key]);
});
