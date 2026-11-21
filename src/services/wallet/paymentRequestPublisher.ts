import { SimplePool, type Event } from 'nostr-tools';
import { createNip17GiftWrap, resolveNostrRecipient } from './nostrService';
import { getNostrRelays } from '~/state/nostrRelayStore';
import { appLogger } from '~/shared/utils/appLogger';

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
    let tracking = true;
    try {
      const acknowledgements = pool
        .publish(publication.relays, publication.event)
        .map((promise, index) =>
          promise.then(
            (result) => {
              if (!tracking) return;
              // The locked nostr-tools pool resolves connection failures as strings.
              // Only successful relay OK responses count as acknowledgements.
              if (!(typeof result === 'string' && result.startsWith('connection failure: '))) {
                accepted.add(publication.relays[index]);
              }
            },
            () => {},
          ),
        );
      // Attach rejection handlers before cleanup, including to attempts still pending at timeout.
      // A fast fallback ACK must not disconnect a slower recipient relay.
      await Promise.race([
        Promise.allSettled(acknowledgements),
        new Promise<void>((resolve) => {
          timer = setTimeout(() => {
            resolve();
          }, 10_000);
        }),
      ]);
      const recipientAccepted = publication.recipientRelays.filter((relay) => accepted.has(relay));
      const confirmed = publication.recipientRelays.length
        ? recipientAccepted.length > 0
        : accepted.size > 0;

      if (confirmed) return { eventId: publication.event.id, acceptedRelays: [...accepted] };
    } catch {
      appLogger.warn('[PaymentRequestPublisher]', undefined, 'wallet_sdk');
    } finally {
      tracking = false;
      if (timer) clearTimeout(timer);
      pool.close(publication.relays);
    }
  }
  throw new Error('Relay delivery is unconfirmed. The existing payment remains in History.');
}
