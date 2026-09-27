import { nip19 } from 'nostr-tools';
import {
  getNostrRecipientLabel,
  isExactNostrRecipientQuery,
  isResolvedNostrRecipient,
} from '~/features/payments/send/nostrRecipient';

const PUBKEY = '7'.repeat(64);
const NPUB = nip19.npubEncode(PUBKEY);

describe('Nostr send recipients', () => {
  it('accepts a resolved npub regardless of the accompanying NIP-05 domain', () => {
    expect(isResolvedNostrRecipient(NPUB)).toBe(true);
    expect(
      getNostrRecipientLabel({
        pubkeyHex: PUBKEY,
        npub: NPUB,
        nip05: 'alice@minibits.cash',
        nip05Verified: true,
        source: 'nip05',
      }),
    ).toBe('alice@minibits.cash');
  });

  it('recognizes general NIP-05 addresses as exact lookup queries', () => {
    expect(isExactNostrRecipientQuery('alice@minibits.cash')).toBe(true);
    expect(isExactNostrRecipientQuery('alice@example.org')).toBe(true);
    expect(isExactNostrRecipientQuery('alice')).toBe(false);
  });
});
