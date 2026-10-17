import { getEncodedTokenV3 } from '@cashu/cashu-ts';
import { getHistoryToken, getVerifiedTokenState } from '~/features/history/historyToken';
import { decodeToken } from '~/services/wallet/tokenUtils';

const proof = {
  id: '00' + 'ab'.repeat(7),
  amount: 8,
  secret: 'synthetic-history-proof',
  C: '02' + '11'.repeat(32),
};
const token = { mint: 'https://mint.example/Bitcoin', unit: 'sat', proofs: [proof] };
const encoded = getEncodedTokenV3(token);
const entry = { mintUrl: token.mint, token };

it.each([
  token,
  [token],
  { token: [{ mint: token.mint, proofs: token.proofs }], unit: 'sat' },
  encoded,
  `cashu:${encoded}`,
  JSON.stringify(token),
])('restores the complete copyable token from persisted formats (%j)', (stored) => {
  const result = getHistoryToken({ ...entry, token: stored });
  expect(result).toMatch(/^cashu[AB]/);
  expect(decodeToken(result)).toMatchObject({ mint: token.mint, proofs: [proof] });
});

it.each([
  { token: 'invalid token' },
  { token: { proofs: [] } },
  { token: { ...token, mint: 'https://another-mint.example' } },
  '{invalid metadata',
])('falls back to the history token when metadata is unusable (%j)', (metadata) => {
  expect(decodeToken(getHistoryToken({ ...entry, metadata }))).toMatchObject(token);
});

it('keeps the complete original encoded value when metadata contains a valid token', () => {
  expect(getHistoryToken({ ...entry, metadata: JSON.stringify({ token: encoded }) })).toBe(encoded);
});

it('does not truncate multi-mint legacy tokens or carry a previous transaction token forward', () => {
  expect(getHistoryToken({ mintUrl: token.mint })).toBe('');
  expect(getHistoryToken({ ...entry, token: [token, token] })).toBe('');
  expect(getHistoryToken({ ...entry, token: { token: [token, token] } })).toBe('');
});

it('does not accept proofs from a different mint or an empty proof set', () => {
  expect(getHistoryToken({ ...entry, mintUrl: 'https://mint.example/bitcoin' })).toBe('');
  expect(getHistoryToken({ ...entry, token: { ...token, proofs: [] } })).toBe('');
});

it.each([
  [[], 2, undefined],
  [[{ state: 'SPENT' }], 2, undefined],
  [[{ state: 'UNSPENT' }], 2, undefined],
  [[{ state: 'SPENT' }, { state: 'SPENT' }], 2, 'claimed'],
  [[{ state: 'UNSPENT' }, { state: 'UNSPENT' }], 2, 'unclaimed'],
  [[{ state: 'PENDING' }, { state: 'UNSPENT' }], 2, 'pending'],
  [[{ state: 'SPENT' }, { state: 'UNSPENT' }], 2, undefined],
  [[{ state: 'UNKNOWN' }], 1, undefined],
])(
  'only changes history state on a complete, conclusive mint response (%j)',
  (states, count, expected) => {
    expect(getVerifiedTokenState(states, count)).toBe(expected);
  },
);
