import type { Plugin } from 'coco-cashu-core';
import type { Token } from '@cashu/cashu-ts';

let notify: ((token: Token) => Promise<void>) | undefined;

/** Publish only after the atomic local send commits. Notifications cannot undo a send. */
export function notifyLocalSend(token: Token): void {
  void notify?.(token).catch(() => {});
}

export const LocalSendEventsPlugin: Plugin<['eventBus']> = {
  name: 'local-send-events',
  required: ['eventBus'],
  onInit: ({ services: { eventBus } }) => {
    const handler = async (token: Token) => {
      await Promise.allSettled([
        eventBus.emit('proofs:state-changed', {
          mintUrl: token.mint,
          secrets: token.proofs.map((proof) => proof.secret),
          state: 'inflight',
        }),
        eventBus.emit('send:created', { mintUrl: token.mint, token }),
      ]);
    };
    notify = handler;
    return () => {
      if (notify === handler) notify = undefined;
    };
  },
};
