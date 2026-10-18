import { getEncodedTokenV3, getEncodedTokenV4 } from '@cashu/cashu-ts';
import { matchesReceiveReceipt, findReceiveReceipt } from '~/services/wallet/nostrReceiptService';
import type { ReceiveHistoryEntry } from 'coco-cashu-core';
const mockCandidates = jest.fn(async (): Promise<ReceiveHistoryEntry[]> => []);
jest.mock('~/services/wallet/initService', () => ({
  initService: {
    getRepo: () => ({
      historyRepository: {
        getSuccessfulReceiveCandidates: () => mockCandidates(),
      },
    }),
  },
}));

const proof = {
  id: '01' + 'ab'.repeat(32),
  amount: 8,
  secret: 'synthetic-receipt',
  C: '02' + '11'.repeat(32),
};
const token = { mint: 'https://mint.example/Bitcoin', unit: 'sat', proofs: [proof] };
const receipt: ReceiveHistoryEntry = {
  id: '1',
  type: 'receive',
  createdAt: 1,
  mintUrl: token.mint,
  unit: 'sat',
  amount: 8,
  token,
};

it.each([getEncodedTokenV3(token), getEncodedTokenV4(token)])(
  'matches exact original inputs across supported encodings',
  (encoded) => {
    expect(matchesReceiveReceipt(encoded, receipt)).toBe(true);
    expect(matchesReceiveReceipt(encoded, { ...receipt, mintUrl: token.mint + '/' })).toBe(true);
  },
);

it('rejects same-amount history for different proofs, mints, units, and unsuccessful receives', () => {
  const encoded = getEncodedTokenV3(token);
  for (const candidate of [
    { ...receipt, token: { ...token, proofs: [{ ...proof, secret: 'somebody-else' }] } },
    { ...receipt, token: { ...token, proofs: [{ ...proof, C: '02' + '22'.repeat(32) }] } },
    { ...receipt, mintUrl: 'https://mint.example/bitcoin' },
    { ...receipt, token: { ...token, mint: 'https://other-mint.example' } },
    { ...receipt, unit: 'usd' },
    { ...receipt, state: 'unclaimed' },
    { ...receipt, type: 'send' },
    { ...receipt, token: undefined },
  ])
    expect(matchesReceiveReceipt(encoded, candidate as ReceiveHistoryEntry)).toBe(false);
});

it('compares the complete proof set and ignores ordering or witness changes', () => {
  const second = { ...proof, secret: 'synthetic-second', amount: 4 };
  const encoded = getEncodedTokenV3({ ...token, proofs: [proof, second] });
  const matching = {
    ...receipt,
    amount: 12,
    token: { ...token, proofs: [second, { ...proof, witness: 'local-signature' }] },
  };
  expect(matchesReceiveReceipt(encoded, matching)).toBe(true);
  expect(
    matchesReceiveReceipt(encoded, { ...matching, token: { ...token, proofs: [proof] } }),
  ).toBe(false);
  expect(
    matchesReceiveReceipt(encoded, { ...matching, token: { ...token, proofs: [proof, proof] } }),
  ).toBe(false);
});

it('never reassigns an NFC-associated receipt to another QR request', async () => {
  mockCandidates.mockResolvedValue([
    { ...receipt, metadata: { requestId: 'nfc-request' } } as ReceiveHistoryEntry,
  ]);
  const item = {
    tokenString: getEncodedTokenV3(token),
    mintUrl: token.mint,
    amount: 8,
    unit: 'sat',
    requestId: 'another-request',
  } as any;
  expect(await findReceiveReceipt(item)).toBeUndefined();
  expect(await findReceiveReceipt({ ...item, requestId: 'nfc-request' })).toBeDefined();
});
