import { secp256k1 } from '@noble/curves/secp256k1.js';
import { npubEncode, nprofileEncode, nsecEncode } from 'nostr-tools/nip19';
import { normalizeP2PKRecipient } from '~/services/wallet/p2pkRecipient';

const point = secp256k1.Point.BASE;
const compressed = point.toHex(true);
const xonly = compressed.slice(2);

it.each([
  compressed,
  point.toHex(false),
  xonly,
  `0x${compressed.toUpperCase()}`,
  ` ${npubEncode(xonly)} `,
  `nostr:${npubEncode(xonly)}`,
  nprofileEncode({ pubkey: xonly, relays: ['wss://relay.example'] }),
])('accepts and normalizes a valid public key representation (%#)', (key) => {
  expect(normalizeP2PKRecipient(key)).toBe(compressed);
});

it('preserves the parity of compressed and uncompressed public keys', () => {
  const odd = point.negate();
  expect(normalizeP2PKRecipient(odd.toHex(true))).toBe(odd.toHex(true));
  expect(normalizeP2PKRecipient(odd.toHex(false))).toBe(odd.toHex(true));
});

it.each([
  '',
  'alice@example.com',
  'npub1badchecksum',
  '02' + 'ff'.repeat(32),
  '04' + '00'.repeat(64),
  nsecEncode(new Uint8Array(32).fill(1)),
])('rejects invalid points and non-public identifiers without echoing input (%#)', (key) => {
  expect(() => normalizeP2PKRecipient(key)).toThrow(
    'Enter a valid public key: hex, npub, or nprofile.',
  );
});
