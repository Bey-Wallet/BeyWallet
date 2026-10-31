import { getEncodedTokenV4 } from '@cashu/cashu-ts';
import QRCode from 'qrcode';
import { canRenderStaticTokenQr, MAX_STATIC_TOKEN_QR_BYTES } from '~/shared/utils/tokenQr';

// Synthetic serialization fixtures only; no wallet data or mint requests.
const token = (count: number, dleq = false) =>
  getEncodedTokenV4({
    mint: 'https://mint.example/Bitcoin',
    unit: 'sat',
    proofs: Array.from({ length: count }, (_, index) => ({
      amount: 2 ** index,
      id: '00' + 'ab'.repeat(7),
      secret: String(index + 1).padStart(64, '0'),
      C: '02' + '11'.repeat(32),
      ...(dleq ? { dleq: { e: '22'.repeat(32), s: '33'.repeat(32), r: '44'.repeat(32) } } : {}),
    })),
  });

it('fits ordinary compact tokens and tokens retaining their full DLEQ data', () => {
  expect(canRenderStaticTokenQr(token(4), 280)).toBe(true);
  expect(canRenderStaticTokenQr(token(2, true), 280)).toBe(true);
  expect(canRenderStaticTokenQr(token(5), 280)).toBe(false);
  expect(canRenderStaticTokenQr(token(3, true), 280)).toBe(false);
});

it('uses animation when the same token would be too dense on a smaller display', () => {
  const value = token(2, true);
  expect(value.length).toBeLessThan(MAX_STATIC_TOKEN_QR_BYTES);
  expect(canRenderStaticTokenQr(value, 280)).toBe(true);
  expect(canRenderStaticTokenQr(value, 220)).toBe(false);
});

it('keeps long spending conditions intact and falls back instead of stripping them', () => {
  const value = getEncodedTokenV4({
    mint: 'https://mint.example',
    proofs: [
      {
        amount: 1,
        id: '00' + 'ab'.repeat(7),
        C: '02' + '11'.repeat(32),
        secret: JSON.stringify([
          'P2PK',
          { nonce: 'fixture', data: '02' + '11'.repeat(32), tags: [['fixture', 'x'.repeat(800)]] },
        ]),
      },
    ],
  });
  expect(canRenderStaticTokenQr(value, 280)).toBe(false);
});

it('falls back safely when matrix creation fails, without logging the token', () => {
  const create = jest.spyOn(QRCode, 'create').mockImplementationOnce(() => {
    throw new Error('fixture');
  });
  expect(canRenderStaticTokenQr('cashuBfixture', 280)).toBe(false);
  create.mockRestore();
});

it.each([0, -1, NaN, Infinity])('rejects an unusable QR size of %s', (size) => {
  expect(canRenderStaticTokenQr('cashuBfixture', size)).toBe(false);
});
