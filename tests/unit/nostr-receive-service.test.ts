import { nip19 } from 'nostr-tools';
import { generateSecretKey, getPublicKey, verifyEvent } from 'nostr-tools/pure';
import { wrapEvent } from 'nostr-tools/nip59';
import { getEncodedTokenV4 } from '@cashu/cashu-ts';
import {
  hasSuccessfulRelayPublish,
  NIP17_INBOX_RELAYS,
  nostrService,
  createNip17GiftWrap,
} from '~/services/wallet/nostrService';
import { nostrClaimService } from '~/services/wallet/nostrClaimService';
import { useNostrInboxStore } from '~/state/nostrInboxStore';
import { usePeopleStore } from '~/state/peopleStore';

jest.mock(
  '@noble/hashes/utils',
  () => ({
    hexToBytes: (hex: string) =>
      Uint8Array.from(hex.match(/.{2}/g) ?? [], (byte) => Number.parseInt(byte, 16)),
  }),
  { virtual: true },
);

jest.mock('~/services/wallet/nostrClaimService', () => ({
  nostrClaimService: { enqueue: jest.fn() },
}));

jest.mock('~/storage/sqlite/sqliteStorage', () => ({
  sqliteStorage: { getItem: jest.fn(() => null), setItem: jest.fn(), removeItem: jest.fn() },
}));

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

describe('Nostr receive service', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    const service = nostrService as any;
    service.privkeyHex = null;
    service.privkeyBytes = null;
    service.pubkeyHex = null;
    service.processedEvents.clear();
    service.processingEvents.clear();
    useNostrInboxStore.setState({ items: [], activeClaimId: null });
    usePeopleStore.setState({ people: {} });
  });

  it('recovers the authenticated sender from a NIP-17 gift wrap', async () => {
    const senderPrivateKey = generateSecretKey();
    const recipientPrivateKey = generateSecretKey();
    const senderPrivateKeyHex = bytesToHex(senderPrivateKey);
    const recipientPrivateKeyHex = bytesToHex(recipientPrivateKey);
    const recipientPublicKey = getPublicKey(recipientPrivateKey);

    const service = nostrService as any;
    const giftWrap = createNip17GiftWrap(
      'cashuAtest-token',
      recipientPublicKey,
      senderPrivateKeyHex,
    );

    service.privkeyHex = recipientPrivateKeyHex;
    service.privkeyBytes = recipientPrivateKey;
    service.pubkeyHex = recipientPublicKey;

    await expect(service._decrypt(giftWrap)).resolves.toMatchObject({
      text: 'cashuAtest-token',
      senderPubkey: getPublicKey(senderPrivateKey),
    });
  });

  it('advertises the relay used by Minibits', () => {
    expect(NIP17_INBOX_RELAYS).toContain('wss://relay.minibits.cash');
  });

  it('hands a Minibits-style NIP-17 ordinary V4 message to automatic claiming intact', async () => {
    const senderKey = generateSecretKey();
    const recipientKey = generateSecretKey();
    const service = nostrService as any;
    service.privkeyHex = bytesToHex(recipientKey);
    service.privkeyBytes = recipientKey;
    service.pubkeyHex = getPublicKey(recipientKey);
    jest.spyOn(service, 'getSenderUsername').mockResolvedValue(undefined);
    const token = getEncodedTokenV4({
      mint: 'https://mint.example',
      unit: 'sat',
      proofs: [
        {
          id: '01' + 'ab'.repeat(32),
          amount: 5,
          secret: 'synthetic-only',
          C: '02' + '11'.repeat(32),
        },
      ],
    });
    // Same kind/tags/wrapEvent call as the cloned Minibits encryptAndSendDirectMessageNip17.
    const event = wrapEvent(
      {
        kind: 14,
        created_at: Math.ceil(Date.now() / 1000),
        tags: [
          ['p', service.pubkeyHex],
          ['from', 'sender@minibits.cash'],
        ],
        content: token,
      },
      senderKey,
      service.pubkeyHex,
    );
    await service._processEvent(event);
    await service._processEvent(event);
    expect(nostrClaimService.enqueue).toHaveBeenCalledTimes(1);
    expect(useNostrInboxStore.getState().items[0]).toMatchObject({
      tokenString: token,
      amount: 5,
      senderPubkey: getPublicKey(senderKey),
    });
  });

  it('preserves standard base64 V3 token characters in incoming legacy messages', async () => {
    const service = nostrService as any;
    jest.spyOn(service, 'getSenderUsername').mockResolvedValue(undefined);
    const token =
      'cashuA' +
      Buffer.from(
        JSON.stringify({
          token: [
            {
              mint: 'https://mint.example',
              proofs: [
                {
                  id: '00' + 'ab'.repeat(7),
                  amount: 5,
                  secret: 'synthetic-only',
                  C: '02' + '11'.repeat(32),
                },
              ],
            },
          ],
          unit: 'sat',
          memo: '\uffff'.repeat(6),
        }),
      ).toString('base64');
    expect(token).toMatch(/[+/]/);
    await service._handleDecrypted(`Payment: ${token}`, { id: 'legacy-base64' }, '07'.repeat(32));
    expect(useNostrInboxStore.getState().items[0].tokenString).toBe(token);
    expect(nostrClaimService.enqueue).toHaveBeenCalledWith('legacy-base64');
  });

  it('only reports publication success when at least one relay transport succeeds', async () => {
    await expect(
      hasSuccessfulRelayPublish([
        Promise.reject(new Error('NIP-04 relays unavailable')),
        Promise.reject(new Error('NIP-17 relays unavailable')),
      ]),
    ).resolves.toBe(false);

    await expect(
      hasSuccessfulRelayPublish([
        Promise.reject(new Error('NIP-04 relays unavailable')),
        Promise.resolve('wss://relay.minibits.cash'),
      ]),
    ).resolves.toBe(true);
  });

  it('keeps a delivery retryable when decryption fails', async () => {
    const service = nostrService as any;
    service.privkeyHex = '04'.repeat(32);
    service.privkeyBytes = generateSecretKey();
    service.pubkeyHex = getPublicKey(service.privkeyBytes);

    const event = {
      id: 'retryable-event',
      kind: 1059,
      pubkey: '05'.repeat(32),
      tags: [['p', service.pubkeyHex]],
      content: 'encrypted',
    } as any;
    jest
      .spyOn(service, '_decrypt')
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: event.id,
        recipients: [service.pubkeyHex],
        text: 'cashuAtest',
        senderPubkey: event.pubkey,
      });
    const handle = jest.spyOn(service, '_handleDecrypted').mockResolvedValue(undefined);

    await service._processEvent(event);
    await service._processEvent(event);

    expect(service._decrypt).toHaveBeenCalledTimes(2);
    expect(handle).toHaveBeenCalledTimes(1);
    expect(service.processedEvents.has(event.id)).toBe(true);
  });

  it('persists and hands off a NUT-18 payment payload before marking it handled', async () => {
    const service = nostrService as any;
    const senderPubkey = '06'.repeat(32);
    const event = { id: 'minibits-payment', kind: 1059 } as any;
    jest.spyOn(service, 'getSenderUsername').mockResolvedValue(undefined);
    (nostrClaimService.enqueue as jest.Mock).mockResolvedValue({
      eventId: event.id,
      status: 'claimed',
      amount: 5,
    });

    await service._handleDecrypted(
      JSON.stringify({
        id: 'request-id',
        mint: 'https://mint.example',
        unit: 'sat',
        proofs: [{ id: 'keyset', amount: 5, secret: 'secret', C: '02aa' }],
      }),
      event,
      senderPubkey,
    );

    expect(useNostrInboxStore.getState().items[0]).toMatchObject({
      id: event.id,
      type: 'token',
      amount: 5,
      mintUrl: 'https://mint.example',
      requestId: 'request-id',
      senderPubkey,
    });
    expect(nostrClaimService.enqueue).toHaveBeenCalledWith(event.id);
    expect(usePeopleStore.getState().people[nip19.npubEncode(senderPubkey)]).toMatchObject({
      npub: nip19.npubEncode(senderPubkey),
      username: null,
      contactStatus: 'unaccepted',
    });
  });

  it('does not re-enqueue a dismissed payment when relays replay it after restart', async () => {
    const service = nostrService as any;
    const senderPubkey = '07'.repeat(32);
    const event = { id: 'dismissed-payment', kind: 1059 } as any;
    const payload = JSON.stringify({
      mint: 'https://mint.example',
      unit: 'sat',
      proofs: [{ id: 'keyset', amount: 5, secret: 'secret', C: '02aa' }],
    });
    jest.spyOn(service, 'getSenderUsername').mockResolvedValue('CaseSensitive');
    (nostrClaimService.enqueue as jest.Mock).mockResolvedValue({
      eventId: event.id,
      status: 'approval_required',
    });

    await service._handleDecrypted(payload, event, senderPubkey);
    useNostrInboxStore.getState().dismiss(event.id);
    await service._handleDecrypted(payload, event, senderPubkey);

    expect(nostrClaimService.enqueue).toHaveBeenCalledTimes(1);
    expect(useNostrInboxStore.getState().items).toHaveLength(1);
    expect(useNostrInboxStore.getState().items[0]).toMatchObject({
      id: event.id,
      status: 'dismissed',
      senderUsername: 'CaseSensitive',
    });
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
