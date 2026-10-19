import { SimplePool, type Event } from 'nostr-tools';
import { createNip17GiftWrap, resolveNostrRecipient } from './nostrService';
import { getNostrRelays } from '~/state/nostrRelayStore';

export interface PaymentRequestPublication {
  event: Event;
  relays: string[];
  recipientRelays: string[];
}

export function preparePaymentRequestPublication(
  payload: string,
  target: string,
  privateKey: string,
): PaymentRequestPublication {
  const recipient = resolveNostrRecipient(target);
  return {
    event: createNip17GiftWrap(payload, recipient.pubkey, privateKey),
    relays: [...new Set([...recipient.relayHints, ...getNostrRelays()])],
    recipientRelays: [...new Set(recipient.relayHints)],
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
    let rejected = 0;
    let tracking = true;
    let timedOut = false;
    try {
      const acknowledgements = pool
        .publish(publication.relays, publication.event)
        .map((promise, index) =>
          promise.then(
            (result) => {
              if (!tracking) return;
              // The locked nostr-tools pool resolves connection failures as strings.
              // Only successful relay OK responses count as acknowledgements.
              if (typeof result === 'string' && result.startsWith('connection failure: ')) {
                rejected++;
              } else {
                accepted.add(publication.relays[index]);
              }
            },
            () => {
              if (tracking) rejected++;
            },
          ),
        );
      // Attach rejection handlers before cleanup, including to attempts still pending at timeout.
      // A fast fallback ACK must not disconnect a slower recipient relay.
      await Promise.race([
        Promise.allSettled(acknowledgements),
        new Promise<void>((resolve) => {
          timer = setTimeout(() => {
            timedOut = true;
            resolve();
          }, 10_000);
        }),
      ]);
      const recipientAccepted = publication.recipientRelays.filter((relay) => accepted.has(relay));
      const confirmed = publication.recipientRelays.length
        ? recipientAccepted.length > 0
        : accepted.size > 0;
      console.info('[PaymentRequestPublisher]', {
        eventId: publication.event.id,
        attempt: attempt + 1,
        category: confirmed ? 'relay_accepted' : 'relay_acceptance_unconfirmed',
        recipientAcknowledgements: recipientAccepted.length,
        fallbackAcknowledgements: accepted.size - recipientAccepted.length,
        rejected,
        unfinished: publication.relays.length - accepted.size - rejected,
        timedOut,
      });
      if (confirmed) return { eventId: publication.event.id, acceptedRelays: [...accepted] };
    } catch {
      console.warn('[PaymentRequestPublisher]', {
        eventId: publication.event.id,
        attempt: attempt + 1,
        category: 'relay_acceptance_unconfirmed',
      });
    } finally {
      tracking = false;
      if (timer) clearTimeout(timer);
      pool.close(publication.relays);
    }
  }
  throw new Error('Relay delivery is unconfirmed. The existing payment remains in History.');
}
