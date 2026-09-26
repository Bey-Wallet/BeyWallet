import { generateSecretKey, getPublicKey, verifyEvent } from 'nostr-tools/pure';
import { NIP17_INBOX_RELAYS, nostrService } from '~/services/wallet/nostrService';

jest.mock(
  '@noble/hashes/utils',
  () => ({
    hexToBytes: (hex: string) =>
      Uint8Array.from(hex.match(/.{2}/g) ?? [], (byte) => Number.parseInt(byte, 16)),
  }),
  { virtual: true },
);

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

describe('Nostr receive service', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    const service = nostrService as any;
    service.privkeyHex = null;
    service.privkeyBytes = null;
    service.pubkeyHex = null;
  });

  it('recovers the authenticated sender from a NIP-17 gift wrap', async () => {
    const senderPrivateKey = generateSecretKey();
    const recipientPrivateKey = generateSecretKey();
    const senderPrivateKeyHex = bytesToHex(senderPrivateKey);
    const recipientPrivateKeyHex = bytesToHex(recipientPrivateKey);
    const recipientPublicKey = getPublicKey(recipientPrivateKey);

    const service = nostrService as any;
    const giftWrap = await service.createNip17GiftWrap(
      'cashuAtest-token',
      recipientPublicKey,
      senderPrivateKeyHex,
    );

    service.privkeyHex = recipientPrivateKeyHex;
    service.privkeyBytes = recipientPrivateKey;
    service.pubkeyHex = recipientPublicKey;

    await expect(service._decrypt(giftWrap)).resolves.toEqual({
      text: 'cashuAtest-token',
      senderPubkey: getPublicKey(senderPrivateKey),
    });
  });

  it('advertises the relay used by Minibits', () => {
    expect(NIP17_INBOX_RELAYS).toContain('wss://relay.minibits.cash');
  });

  it('creates a signed kind-0 profile and preserves existing metadata', async () => {
    const privateKey = generateSecretKey();
    const privateKeyHex = bytesToHex(privateKey);
    const publicKey = getPublicKey(privateKey);
    const service = nostrService as any;
    jest.spyOn(service, '_fetchProfileMetadata').mockResolvedValue({
      about: 'Existing bio',
      picture: 'https://example.com/avatar.png',
    });

    const event = await nostrService.createProfileEvent(
      '6HuObPp@BEY.CASH',
      privateKeyHex,
      publicKey,
    );
    const metadata = JSON.parse(event.content);

    expect(event.kind).toBe(0);
    expect(event.pubkey).toBe(publicKey);
    expect(verifyEvent(event)).toBe(true);
    expect(metadata).toEqual({
      about: 'Existing bio',
      picture: 'https://example.com/avatar.png',
      name: '6huobpp',
      display_name: '6huobpp',
      nip05: '6huobpp@bey.cash',
    });
  });

  it('refuses to create a profile with a mismatched signing key', async () => {
    const privateKey = generateSecretKey();

    await expect(
      nostrService.createProfileEvent(
        '6huobpp@bey.cash',
        bytesToHex(privateKey),
        getPublicKey(generateSecretKey()),
      ),
    ).rejects.toThrow('Nostr profile key mismatch');
  });
});
