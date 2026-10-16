import { getEventHash, getPublicKey, nip04, nip44, verifyEvent, type Event } from 'nostr-tools';
import { bytesToHex, hexToBytes, randomBytes } from '@noble/hashes/utils.js';
import { createRumor, createSeal, createWrap } from 'nostr-tools/nip59';

export interface AuthenticatedMessage {
  id: string;
  text: string;
  senderPubkey: string;
  recipients: string[];
  createdAt: number;
  transport: 'nip17' | 'nip04';
}

export function isPaymentShaped(text: string): boolean {
  return (
    /cashu[ab]|creq[ab]|["'](?:proofs|token|secret|witness)["']/i.test(text) ||
    (text.trimStart().startsWith('{') && /\b(?:proofs|secret|witness|mint)\b/i.test(text))
  );
}

export function validRelay(relay: string): boolean {
  try {
    const url = new URL(relay);
    return url.protocol === 'wss:' && !!url.hostname && !url.username && !url.password && !url.hash;
  } catch {
    return false;
  }
}

export function createChatCopies(text: string, recipient: string, secret: Uint8Array) {
  const rumor = createRumor(
    {
      kind: 14,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['p', recipient],
        ['nonce', bytesToHex(randomBytes(16))],
      ],
      content: text,
    },
    secret,
  );
  const sender = getPublicKey(secret);
  return {
    rumor,
    recipient: createWrap(createSeal(rumor, secret, recipient), recipient),
    sender: createWrap(createSeal(rumor, secret, sender), sender),
  };
}

export async function decryptAuthenticated(
  event: Event,
  privateKeyHex: string,
): Promise<AuthenticatedMessage | null> {
  try {
    const secret = hexToBytes(privateKeyHex);
    const self = getPublicKey(secret);
    if (!verifyEvent(event) || !event.tags.some((tag) => tag[0] === 'p' && tag[1] === self))
      return null;
    if (event.kind === 4) {
      const recipients = event.tags.filter((tag) => tag[0] === 'p').map((tag) => tag[1]);
      if (recipients.length !== 1) return null;
      return {
        id: event.id,
        senderPubkey: event.pubkey,
        recipients,
        createdAt: event.created_at,
        text: await nip04.decrypt(privateKeyHex, event.pubkey, event.content),
        transport: 'nip04',
      };
    }
    if (event.kind !== 1059) return null;
    const seal = JSON.parse(
      nip44.v2.decrypt(event.content, nip44.v2.utils.getConversationKey(secret, event.pubkey)),
    ) as Event;
    if (seal.kind !== 13 || seal.tags.length !== 0 || !verifyEvent(seal)) return null;
    const rumor = JSON.parse(
      nip44.v2.decrypt(seal.content, nip44.v2.utils.getConversationKey(secret, seal.pubkey)),
    );
    if (
      rumor.kind !== 14 ||
      rumor.sig !== undefined ||
      rumor.pubkey !== seal.pubkey ||
      rumor.id !== getEventHash(rumor) ||
      !Number.isSafeInteger(rumor.created_at) ||
      rumor.created_at < 0
    )
      return null;
    const recipients: string[] = [
      ...new Set<string>(
        rumor.tags.filter((tag: string[]) => tag[0] === 'p').map((tag: string[]) => tag[1]),
      ),
    ];
    // This version supports one-to-one conversations only, including sender copies.
    if (
      recipients.length !== 1 ||
      !/^[0-9a-f]{64}$/.test(recipients[0]) ||
      (rumor.pubkey !== self && recipients[0] !== self)
    )
      return null;
    return {
      id: rumor.id,
      text: rumor.content,
      senderPubkey: rumor.pubkey,
      recipients,
      createdAt: rumor.created_at,
      transport: 'nip17',
    };
  } catch {
    return null;
  }
}
