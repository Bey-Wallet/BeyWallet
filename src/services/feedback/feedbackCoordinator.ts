import type { FeedbackKind } from './feedbackCatalog';
import { mintUrlKey } from '~/shared/utils/mintUrl';

export function quoteFeedbackId(mintUrl: string, quoteId: string) {
  return JSON.stringify([mintUrlKey(mintUrl), quoteId]);
}

export type FeedbackTarget =
  | { type: 'transaction'; id: string }
  | { type: 'conversation'; id: string }
  | { type: 'incoming'; id: string }
  | { type: 'recovery' }
  | { type: 'history' };
export interface FeedbackEvent {
  walletId: string;
  // Canonical IDs only. Never tokens, proofs, invoices or key material.
  entity: {
    type: 'quote' | 'operation' | 'receipt' | 'nostr' | 'message' | 'recovery';
    id: string;
  };
  kind: FeedbackKind;
  state: 'pending' | 'completed' | 'review' | 'prepared';
  origin: 'live' | 'catch-up';
  parentOperationId?: string;
  target?: FeedbackTarget;
  details?: { amount: number };
}
export interface FeedbackStorage {
  reserve(event: FeedbackEvent, key: string): Promise<boolean>;
}
export interface FeedbackPresenter {
  hapticEpoch?(): number | undefined;
  haptic?(events: FeedbackEvent[]): void;
  unlocked(): boolean;
  foreground(): boolean;
  toast(events: FeedbackEvent[]): void | Promise<void>;
  notification(events: FeedbackEvent[]): void | Promise<void>;
}

/** Scheduling/presentation only. No wallet execution or native imports. */
export class FeedbackCoordinator {
  private walletId?: string;
  private storage?: FeedbackStorage;
  private presenter?: FeedbackPresenter;
  private muted = new Set<symbol>();
  private generation = 0;
  private owners = new Map<symbol, { id: string; outcome?: (event: FeedbackEvent) => void }>();
  private queued: { event: FeedbackEvent; hapticEpoch?: number }[] = [];
  private timer?: ReturnType<typeof setTimeout>;

  get wallet() {
    return this.walletId;
  }
  get hasActiveOwner() {
    return this.owners.size > 0;
  }
  get suppressed() {
    return this.muted.size > 0;
  }

  /** Import, recovery and maintenance reserve markers but never announce restored funds. */
  suppress() {
    const token = Symbol();
    this.muted.add(token);
    return () => {
      this.muted.delete(token);
    };
  }

  bind(walletId: string, storage: FeedbackStorage) {
    if (this.walletId !== walletId) this.clear();
    this.walletId = walletId;
    this.storage = storage;
  }

  connect(presenter: FeedbackPresenter) {
    this.presenter = presenter;
    return () => {
      if (this.presenter === presenter) this.presenter = undefined;
    };
  }

  claim(id: string, outcome?: (event: FeedbackEvent) => void) {
    const token = Symbol();
    this.owners.set(token, { id, outcome });
    return () => {
      this.owners.delete(token);
    };
  }

  clear() {
    this.generation++;
    this.walletId = undefined;
    this.storage = undefined;
    this.owners.clear();
    this.queued = [];
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
  }

  private hapticEpoch(presenter = this.presenter) {
    try {
      return presenter?.hapticEpoch?.();
    } catch {
      return undefined;
    }
  }

  private deliverHaptic(events: FeedbackEvent[], presenter = this.presenter) {
    try {
      presenter?.haptic?.(events);
    } catch {
      // A device effect cannot suppress screen/toast delivery or reject a payment.
    }
  }

  async publish(event: FeedbackEvent): Promise<void> {
    if (!this.storage || event.walletId !== this.walletId || !event.entity.id) return;
    const generation = this.generation;
    const hapticEpoch = this.hapticEpoch();
    const key = JSON.stringify([event.walletId, event.entity.type, event.entity.id, event.state]);
    try {
      // Atomic durable reservation precedes every surface, including the active screen.
      if (!(await this.storage.reserve(event, key)) || generation !== this.generation) return;
      if (event.origin !== 'live' || this.suppressed) return;
      const owner = [...this.owners.values()]
        .reverse()
        .find(({ id }) => id === event.parentOperationId || id === event.entity.id);
      if (owner && this.presenter?.foreground() && this.presenter.unlocked()) {
        if (hapticEpoch !== undefined && hapticEpoch === this.hapticEpoch())
          this.deliverHaptic([event]);
        owner.outcome?.(event);
        return;
      }
      this.queued.push({ event, hapticEpoch });
      if (!this.timer) this.timer = setTimeout(() => void this.flush(), 500);
    } catch {
      // Delivery failure must never change or reject a financial outcome.
    }
  }

  async flush() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    const queued = this.queued;
    let events = queued.map(({ event }) => event);
    this.queued = [];
    const presenter = this.presenter;
    if (!events.length || !presenter) return;
    try {
      const eligible = queued
        .filter(
          (item) =>
            item.hapticEpoch !== undefined && item.hapticEpoch === this.hapticEpoch(presenter),
        )
        .map(({ event }) => event);
      if (eligible.length && presenter.foreground() && presenter.unlocked())
        this.deliverHaptic(eligible, presenter);
      // Focus can change during the burst window (for example, opening an incoming review).
      if (presenter.foreground() && presenter.unlocked())
        events = events.filter((event) => {
          const owner = [...this.owners.values()]
            .reverse()
            .find(({ id }) => id === event.parentOperationId || id === event.entity.id);
          if (!owner) return true;
          owner.outcome?.(event);
          return false;
        });
      if (!events.length) return;
      if (presenter.foreground() && presenter.unlocked()) await presenter.toast(events);
      else await presenter.notification(events);
    } catch {
      /* Best effort; history is authoritative. */
    }
  }
}
export const feedbackCoordinator = new FeedbackCoordinator();

export function publishWalletFeedback(event: Omit<FeedbackEvent, 'walletId'>) {
  const walletId = feedbackCoordinator.wallet;
  return walletId ? feedbackCoordinator.publish({ ...event, walletId }) : Promise.resolve();
}
