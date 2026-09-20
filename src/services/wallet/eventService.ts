/**
 * Event service — typed event subscriptions for all CoreEvents.
 *
 * Uses Manager.on/off/once which provide fully typed CoreEvents:
 *
 * Mint events:
 *   'mint:added', 'mint:updated'
 *
 * Proof events:
 *   'proofs:saved', 'proofs:state-changed', 'proofs:deleted', 'proofs:wiped'
 *
 * Mint quote events:
 *   'mint-quote:created', 'mint-quote:added', 'mint-quote:state-changed',
 *   'mint-quote:requeue', 'mint-quote:redeemed'
 *
 * Melt quote events:
 *   'melt-quote:created', 'melt-quote:state-changed', 'melt-quote:paid'
 *
 * Wallet events:
 *   'send:created', 'receive:created'
 *
 * History events:
 *   'history:updated'
 */

import type { CoreEvents } from 'coco-cashu-core';
import { initService } from '~/services/wallet/initService';

type EventName = keyof CoreEvents;
type EventHandler<E extends EventName> = (payload: CoreEvents[E]) => void | Promise<void>;

export const eventService = {
  /**
   * Subscribe to a CoreEvent.
   * Returns an unsubscribe function.
   *
   * @example
   * const unsub = eventService.on('mint-quote:redeemed', (payload) => {
   *   console.log('Quote redeemed:', payload.quoteId);
   * });
   * // Later: unsub();
   */
  on: <E extends EventName>(event: E, handler: EventHandler<E>): (() => void) => {
    return initService.getManager().on(event, handler);
  },

  /**
   * Unsubscribe from a CoreEvent.
   */
  off: <E extends EventName>(event: E, handler: EventHandler<E>): void => {
    initService.getManager().off(event, handler);
  },

  /**
   * Subscribe to a CoreEvent for a single emission.
   * Returns an unsubscribe function (in case you want to cancel early).
   */
  once: <E extends EventName>(event: E, handler: EventHandler<E>): (() => void) => {
    return initService.getManager().once(event, handler);
  },
};

/**
 * Type-safe list of all available CoreEvent names.
 * Useful for debugging or dynamic subscription.
 */
export const CORE_EVENT_NAMES: EventName[] = [
  'mint:added',
  'mint:updated',
  'counter:updated',
  'proofs:saved',
  'proofs:state-changed',
  'proofs:deleted',
  'proofs:wiped',
  'mint-quote:state-changed',
  'mint-quote:created',
  'mint-quote:added',
  'mint-quote:requeue',
  'mint-quote:redeemed',
  'melt-quote:created',
  'melt-quote:state-changed',
  'melt-quote:paid',
  'send:created',
  'receive:created',
  'history:updated',
];
