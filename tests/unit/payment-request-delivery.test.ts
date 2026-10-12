import type { Token } from '@cashu/cashu-ts';
import {
  generateSecretKey,
  getPublicKey,
  nip19,
  nip44,
  verifyEvent,
  getEventHash,
} from 'nostr-tools';
import { bytesToHex } from '@noble/hashes/utils.js';
import { unwrapEvent } from 'nostr-tools/nip59';

import { createPaymentRequestPayload } from '~/services/wallet/paymentRequestDelivery';
import { createNip17GiftWrap, resolveNostrRecipient } from '~/services/wallet/nostrService';

describe('createPaymentRequestPayload', () => {
  it('preserves the original proof objects without token re-decoding', () => {
    const proofs = [
      {
        id: '01fc0ec0e59cd6fa',
        amount: 2,
        secret: 'secret',
        C: `02${'ab'.repeat(32)}`,
      },
    ];
    const token = {
      mint: 'https://mint.minibits.cash/Bitcoin',
      unit: 'sat',
      proofs,
    } as Token;

    const payload = createPaymentRequestPayload(token, {
      id: 'ffc9bfd5',
      unit: 'sat',
    });

    expect(payload).toEqual({
      id: 'ffc9bfd5',
      mint: token.mint,
      unit: 'sat',
      proofs,
    });
    expect(payload.proofs).toBe(proofs);
  });

  it('rejects an empty proof set', () => {
    expect(() =>
      createPaymentRequestPayload(
        { mint: 'https://mint.example', proofs: [] } as unknown as Token,
        { unit: 'sat' },
      ),
    ).toThrow('without token proofs');
  });
});

describe('resolveNostrRecipient', () => {
  it('preserves secure relay hints from an nprofile', () => {
    const pubkey = '12'.repeat(32);
    const target = nip19.nprofileEncode({
      pubkey,
      relays: ['wss://relay.primal.net', 'wss://nostr.mom', 'https://not-a-relay.example'],
    });

    expect(resolveNostrRecipient(target)).toEqual({
      pubkey,
      relayHints: ['wss://relay.primal.net', 'wss://nostr.mom'],
    });
  });
});

describe('createNip17GiftWrap', () => {
  it.each(['Cashu.me', 'Minibits', 'Sovran'])(
    'delivers intact NUT-18 JSON through the %s receiver decryption path',
    (peer) => {
      const recipientSecret = generateSecretKey();
      const payload = createPaymentRequestPayload(
        {
          mint: 'https://mint.example/Bitcoin',
          unit: 'sat',
          proofs: [
            {
              id: '01' + 'ab'.repeat(32),
              amount: 8,
              secret: 'synthetic',
              C: '02' + '11'.repeat(32),
            },
          ],
        } as Token,
        { id: 'peer-request-id', unit: 'sat' },
      );
      const event = createNip17GiftWrap(
        JSON.stringify(payload),
        getPublicKey(recipientSecret),
        bytesToHex(generateSecretKey()),
      );
      // Cashu.me manually decrypts wrap -> seal -> rumor (stores/nostr.ts).
      // Minibits uses nip59.unwrapEvent; Sovran's cache uses the same two NIP-44 layers.
      let content: string;
      if (peer === 'Minibits') {
        content = unwrapEvent(event, recipientSecret).content;
      } else {
        const seal = JSON.parse(
          nip44.v2.decrypt(
            event.content,
            nip44.v2.utils.getConversationKey(recipientSecret, event.pubkey),
          ),
        );
        const rumor = JSON.parse(
          nip44.v2.decrypt(
            seal.content,
            nip44.v2.utils.getConversationKey(recipientSecret, seal.pubkey),
          ),
        );
        content = rumor.content;
      }
      expect(JSON.parse(content)).toEqual(payload);
      expect(JSON.parse(content).proofs[0].id).toHaveLength(66);
    },
  );
  it('creates a canonical gift wrap whose rumor has a valid id', () => {
    const senderSecret = generateSecretKey();
    const recipientSecret = generateSecretKey();
    const recipientPubkey = getPublicKey(recipientSecret);
    const message = JSON.stringify({ id: 'request-id', mint: 'https://mint.example' });

    const giftWrap = createNip17GiftWrap(message, recipientPubkey, bytesToHex(senderSecret));
    const rumor = unwrapEvent(giftWrap, recipientSecret);
    const seal = JSON.parse(
      nip44.v2.decrypt(
        giftWrap.content,
        nip44.v2.utils.getConversationKey(recipientSecret, giftWrap.pubkey),
      ),
    );
    expect(verifyEvent(giftWrap)).toBe(true);
    expect(verifyEvent(seal)).toBe(true);
    expect(seal.kind).toBe(13);
    expect(rumor.id).toBe(getEventHash(rumor));
    expect(rumor.tags).toContainEqual(['p', recipientPubkey]);

    expect(giftWrap.kind).toBe(1059);
    expect(giftWrap.tags).toContainEqual(['p', recipientPubkey]);
    expect(rumor.kind).toBe(14);
    expect(rumor.id).toMatch(/^[0-9a-f]{64}$/);
    expect(rumor.pubkey).toBe(getPublicKey(senderSecret));
    expect(rumor.content).toBe(message);
  });
});
