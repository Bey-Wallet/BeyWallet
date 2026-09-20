import * as nip19 from 'nostr-tools/nip19';
import { normalizeNpub } from '../../src/shared/utils/nostr';

describe('normalizeNpub', () => {
  const pubkey = '4d14904ff013ae02d1e3041a432f7e24e440c2c93081e0d2fb078fb96ab6d1b6';

  it('encodes a hex public key without converting it to bytes', () => {
    expect(normalizeNpub(pubkey)).toBe(nip19.npubEncode(pubkey));
  });

  it('extracts and encodes the public key from an nprofile', () => {
    const nprofile = nip19.nprofileEncode({ pubkey, relays: [] });

    expect(normalizeNpub(nprofile)).toBe(nip19.npubEncode(pubkey));
  });

  it('leaves malformed public keys unchanged', () => {
    expect(normalizeNpub('not-a-public-key')).toBe('not-a-public-key');
  });
});
