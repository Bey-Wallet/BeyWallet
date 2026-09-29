import { hasVerifiedNip05 } from '~/features/people/nip05';

describe('hasVerifiedNip05', () => {
  it.each(['alice@bey.cash', 'alice@minibits.cash', 'alice@example.com'])(
    'accepts a verified NIP-05 from any domain: %s',
    (nip05) => {
      expect(hasVerifiedNip05({ nip05, nip05Verified: true })).toBe(true);
    },
  );

  it('rejects an unverified NIP-05', () => {
    expect(hasVerifiedNip05({ nip05: 'alice@example.com', nip05Verified: false })).toBe(false);
  });

  it('rejects missing or empty NIP-05 values', () => {
    expect(hasVerifiedNip05({ nip05Verified: true })).toBe(false);
    expect(hasVerifiedNip05({ nip05: '  ', nip05Verified: true })).toBe(false);
  });
});
