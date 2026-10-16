import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
  nip04,
  nip44,
  getEventHash,
} from 'nostr-tools';
import { createSeal, createWrap } from 'nostr-tools/nip59';
import { bytesToHex } from '@noble/hashes/utils.js';
import {
  createChatCopies,
  decryptAuthenticated,
  isPaymentShaped,
} from '~/services/wallet/nostrChatTransport';

describe('authenticated one-to-one chat', () => {
  const sender = generateSecretKey();
  const receiver = generateSecretKey();
  const recipient = getPublicKey(receiver);

  it('retains the same logical rumor in recipient and sender copies', async () => {
    const copies = createChatCopies('Hello Minibits', recipient, sender);
    const incoming = await decryptAuthenticated(copies.recipient, bytesToHex(receiver));
    const outgoing = await decryptAuthenticated(copies.sender, bytesToHex(sender));
    expect(incoming).toEqual(outgoing);
    expect(incoming).toMatchObject({
      id: copies.rumor.id,
      text: 'Hello Minibits',
      senderPubkey: getPublicKey(sender),
      recipients: [recipient],
      transport: 'nip17',
    });
    expect(copies.recipient.id).not.toBe(copies.sender.id);
  });

  it('deduplicates different wraps of the same rumor by logical ID', async () => {
    const copies = createChatCopies('Same rumor', recipient, sender);
    const again = createWrap(createSeal(copies.rumor, sender, recipient), recipient);
    const first = await decryptAuthenticated(copies.recipient, bytesToHex(receiver));
    const second = await decryptAuthenticated(again, bytesToHex(receiver));
    expect(first?.id).toBe(second?.id);
  });

  it('keeps intentionally repeated text distinct even within the same second', () => {
    const first = createChatCopies('Hello', recipient, sender);
    const second = createChatCopies('Hello', recipient, sender);
    expect(first.rumor.id).not.toBe(second.rumor.id);
  });

  it('accepts authenticated legacy kind 4', async () => {
    const event = finalizeEvent(
      {
        kind: 4,
        created_at: 123,
        tags: [['p', recipient]],
        content: await nip04.encrypt(sender, recipient, 'Legacy hello'),
      },
      sender,
    );
    await expect(decryptAuthenticated(event, bytesToHex(receiver))).resolves.toMatchObject({
      id: event.id,
      text: 'Legacy hello',
      transport: 'nip04',
      createdAt: 123,
    });
  });

  it('rejects invalid signatures, rumor IDs, impersonated seals and wrong membership', async () => {
    const copies = createChatCopies('Private', recipient, sender);
    const corrupted = JSON.parse(JSON.stringify(copies.recipient));
    corrupted.sig = '00'.repeat(64);
    expect(await decryptAuthenticated(corrupted, bytesToHex(receiver))).toBeNull();
    const wrongId = { ...copies.rumor, id: '00'.repeat(32) };
    const wrapRumor = (rumor: typeof copies.rumor) =>
      createWrap(createSeal(rumor, sender, recipient), recipient);
    expect(await decryptAuthenticated(wrapRumor(wrongId), bytesToHex(receiver))).toBeNull();
    const forged = { ...copies.rumor, pubkey: getPublicKey(generateSecretKey()) };
    forged.id = getEventHash(forged);
    expect(await decryptAuthenticated(wrapRumor(forged), bytesToHex(receiver))).toBeNull();
    const wrongMember = { ...copies.rumor, tags: [['p', getPublicKey(generateSecretKey())]] };
    wrongMember.id = getEventHash(wrongMember);
    expect(await decryptAuthenticated(wrapRumor(wrongMember), bytesToHex(receiver))).toBeNull();
    const key = nip44.v2.utils.getConversationKey(sender, recipient);
    const invalidSeal = finalizeEvent(
      {
        kind: 13,
        tags: [['p', recipient]],
        created_at: 123,
        content: nip44.v2.encrypt(JSON.stringify(copies.rumor), key),
      },
      sender,
    );
    expect(
      await decryptAuthenticated(createWrap(invalidSeal, recipient), bytesToHex(receiver)),
    ).toBeNull();
  });

  it.each(['cashuBbroken', 'creqAbroken', '{"proofs":[]}', '{"secret":"synthetic"}'])(
    'never exposes payment-shaped content as chat: %s',
    (text) => {
      expect(isPaymentShaped(text)).toBe(true);
    },
  );
});
