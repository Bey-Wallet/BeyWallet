import { AppState } from 'react-native';
import type { Manager } from 'coco-cashu-core';
import { useNostrRequestStore } from '~/state/nostrRequestStore';
import { useNostrInboxStore, type NostrInboxItem } from '~/state/nostrInboxStore';
import { normalizeNpub } from '~/shared/utils/nostr';
import { matchReceiveRequest } from './requestReceiptMatching';
export { matchReceiveRequest } from './requestReceiptMatching';
import { contactPolicyReady } from './contactPolicy';

export async function retryRequestPayment(id: string): Promise<void> {
  if (!contactPolicyReady()) throw new Error('Contacts are still loading. Try again.');
  const { initService } = require('./initService') as typeof import('./initService');
  const { usePeopleStore } = require('~/state/peopleStore') as typeof import('~/state/peopleStore');
  const { useAuthStore } = require('~/state/authStore') as typeof import('~/state/authStore');
  const { useSettingsStore } =
    require('~/state/settingsStore') as typeof import('~/state/settingsStore');
  await useNostrRequestStore.getState().loadPendingRequests();
  const payment = useNostrRequestStore.getState().payments.find((payment) => payment.id === id);
  if (!payment?.publication || !payment.operationId || payment.state !== 'pending')
    throw new Error('Check the existing operation in History.');
  const operation = await initService.getManager().send.getOperation(payment.operationId);
  if (operation?.state !== 'pending')
    throw new Error('This payment is no longer pending. Refresh its status.');
  const { publishPaymentRequest } =
    require('./paymentRequestPublisher') as typeof import('./paymentRequestPublisher');
  if (!initService.isInitialized()) throw new Error('Open your wallet first.');
  if (!contactPolicyReady()) throw new Error('Contacts are still loading. Try again.');
  if (
    payment.conversation &&
    usePeopleStore.getState().people[payment.conversation]?.contactStatus === 'blocked'
  )
    throw new Error('Unblock this person in Nostr Settings first.');
  if (useSettingsStore.getState().biometricEnabled && !useAuthStore.getState().isAuthenticated)
    throw new Error('Unlock your wallet first.');
  await publishPaymentRequest(payment.publication);
  await useNostrRequestStore.getState().savePayment({ ...payment, published: true });
  if (
    payment.conversation &&
    usePeopleStore.getState().people[payment.conversation]?.contactStatus !== 'blocked'
  )
    usePeopleStore.getState().setContactStatus(payment.conversation, 'accepted');
}

export async function recordRequestReceipt(item: NostrInboxItem): Promise<void> {
  if (item.status !== 'claimed' || !item.receiptVerified) return;
  const store = useNostrRequestStore.getState();
  await store.loadPendingRequests();
  const match = matchReceiveRequest(useNostrRequestStore.getState().pendingRequests, item);
  if (match) await store.markReceived(match.id);
}

class RequestLifecycleService {
  private manager?: Manager;
  private stops: (() => void)[] = [];
  private timer?: ReturnType<typeof setInterval>;
  private generation = 0;
  private running?: Promise<void>;
  private again = false;

  start(manager: Manager): void {
    this.stop();
    this.manager = manager;
    const reconcile = () => {
      void this.reconcile().catch(() => undefined);
    };
    this.stops = [
      manager.on('send:pending', reconcile),
      manager.on('send:finalized', reconcile),
      manager.on('send:rolled-back', reconcile),
    ];
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') reconcile();
    });
    this.stops.push(() => subscription.remove());
    this.timer = setInterval(() => {
      if (AppState.currentState === 'active') reconcile();
    }, 30_000);
    reconcile();
  }

  reconcile(): Promise<void> {
    if (!this.manager) return Promise.resolve();
    if (this.running) {
      this.again = true;
      return this.running;
    }
    const manager = this.manager;
    const generation = this.generation;
    const task = this.refresh(manager, generation);
    this.running = task;
    void task
      .finally(() => {
        if (this.running !== task) return;
        this.running = undefined;
        if (this.again) {
          this.again = false;
          void this.reconcile().catch(() => undefined);
        }
      })
      .catch(() => undefined);
    return task;
  }

  private async refresh(manager: Manager, generation: number): Promise<void> {
    const store = useNostrRequestStore.getState();
    await store.loadPendingRequests();
    for (const payment of useNostrRequestStore.getState().payments) {
      if (generation !== this.generation) return;
      if (!payment.operationId || payment.state === 'paid' || payment.state === 'rolled_back')
        continue;
      try {
        let operation = await manager.send.getOperation(payment.operationId);
        // Coco checks the complete proof set and owns operation finalization.
        if (operation?.state === 'pending') {
          try {
            await manager.send.checkPendingOperation(payment.operationId);
          } catch {
            /* offline; retain status */
          }
          operation = await manager.send.getOperation(payment.operationId);
        }
        if (generation !== this.generation) return;
        const state =
          operation?.state === 'finalized'
            ? 'paid'
            : operation?.state === 'rolled_back'
              ? 'rolled_back'
              : operation?.state === 'pending'
                ? 'pending'
                : payment.state;
        if (state !== payment.state) await store.savePayment({ ...payment, state });
      } catch {
        /* An unavailable mint must not stop other requests from reconciling. */
      }
    }
    for (const item of useNostrInboxStore.getState().items) {
      if (generation !== this.generation) return;
      if (item.status !== 'claimed' || !item.receiptVerified || item.type === 'request') continue;
      const request = matchReceiveRequest(useNostrRequestStore.getState().pendingRequests, item);
      if (request) await store.markReceived(request.id);
    }
  }

  stop(): void {
    this.generation++;
    this.manager = undefined;
    this.running = undefined;
    this.again = false;
    this.stops.forEach((stop) => stop());
    this.stops = [];
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }
}

export const requestLifecycleService = new RequestLifecycleService();
