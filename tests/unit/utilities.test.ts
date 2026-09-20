jest.mock('@noble/hashes/sha2.js', () => ({
  sha256: (value: Uint8Array) => new Uint8Array(32).fill(value[0] ?? 0),
}));
jest.mock('nostr-tools/pure', () => ({ finalizeEvent: jest.fn() }));

import { findExactSubset, getPossibleAmounts } from '../../src/shared/utils/offlineSendUtils';
import {
  normalizeBitcoinAddress,
  onchainNetwork,
  onchainNetworkDisplay,
} from '../../src/shared/utils/onchain';
import { formatRelativeTime } from '../../src/shared/utils/time';
import { generateDeterministicUsername } from '../../src/shared/utils/username';

describe('pure wallet utilities', () => {
  it('selects an exact offline proof subset without mutating proofs', () => {
    const proofs = [1, 2, 4, 8].map((amount, index) => ({
      amount,
      secret: String(index),
    })) as any[];
    const snapshot = [...proofs];

    expect(findExactSubset(10, proofs)?.map((proof) => proof.amount)).toEqual([2, 8]);
    expect(getPossibleAmounts(proofs)).toContain(15);
    expect(proofs).toEqual(snapshot);
  });

  it('normalizes and identifies on-chain addresses', () => {
    expect(normalizeBitcoinAddress(' bitcoin:bc1qexample?amount=1 ')).toBe('bc1qexample');
    expect(onchainNetwork('tb1qexample')).toBe('mutinynet');
    expect(onchainNetworkDisplay('bitcoin')).toBe('Bitcoin');
  });

  it('formats relative time deterministically', () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    expect(formatRelativeTime(1_699_999_940)).toBe('1m');
  });

  it('derives stable usernames from a public key', () => {
    const pubkey = '00'.repeat(32);
    expect(generateDeterministicUsername(pubkey)).toBe(generateDeterministicUsername(pubkey));
  });
});
