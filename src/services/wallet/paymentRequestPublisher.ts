import { SimplePool, type Event } from 'nostr-tools';
import { createNip17GiftWrap, resolveNostrRecipient, RELAYS } from './nostrService';

export interface PaymentRequestPublication {
  event: Event;
  relays: string[];
}

export function preparePaymentRequestPublication(
  payload: string,
  target: string,
  privateKey: string,
): PaymentRequestPublication {
  const recipient = resolveNostrRecipient(target);
  return {
    event: createNip17GiftWrap(payload, recipient.pubkey, privateKey),
    relays: [...new Set([...recipient.relayHints, ...RELAYS])],
  };
}

/** Only ACKs for this kind-1059 event count. Retry the very same ciphertext once. */
export async function publishPaymentRequest(
  publication: PaymentRequestPublication,
  createPool = () => new SimplePool(),
): Promise<{ eventId: string; acceptedRelays: string[] }> {
  if (publication.event.kind !== 1059) throw new Error('Invalid payment request event kind');
  for (let attempt = 0; attempt < 2; attempt++) {
    const pool = createPool();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const accepted = new Set<string>();
    try {
      const acknowledgements = pool
        .publish(publication.relays, publication.event)
        .map((promise, index) =>
          promise.then(() => {
            accepted.add(publication.relays[index]);
            return publication.relays[index];
          }),
        );
      await Promise.race([
        Promise.any(acknowledgements),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('Publication timed out')), 10_000);
        }),
      ]);
      console.info('[PaymentRequestPublisher]', {
        eventId: publication.event.id,
        acceptedRelays: [...accepted].map((relay) => new URL(relay).host),
      });
      return { eventId: publication.event.id, acceptedRelays: [...accepted] };
    } catch {
      console.warn('[PaymentRequestPublisher]', {
        eventId: publication.event.id,
        category: 'relay_acceptance_unconfirmed',
      });
    } finally {
      if (timer) clearTimeout(timer);
      pool.close(publication.relays);
    }
  }
  throw new Error('Relay delivery is unconfirmed. The existing payment remains in History.');
}
