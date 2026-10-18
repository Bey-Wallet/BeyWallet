import { Platform } from 'react-native';
import type { HCESession } from 'react-native-hce';
import {
  nfcService,
  decodePaymentNdef,
  assertSameNfcPaymentRequest,
  type NfcPaymentSession,
} from '~/services/platform/nfcService';
import { parsePaymentInput } from '~/shared/utils/paymentInputParser';
import { parsePaymentRequest, isPaymentMintAllowed } from '~/services/wallet/paymentRequestModel';
import {
  PaymentRequestPayment,
  previewPaymentRequest,
  areAllPaymentProofsSpent,
} from '~/services/wallet/paymentRequestPayment';
import { LightningPayment } from '~/services/wallet/lightningPayment';
import { walletService, decodeToken } from '~/services/wallet';
import { proofService } from '~/services/wallet/proofService';
import { useWalletStore } from '~/state/walletStore';

export type NfcStatus =
  | 'ready'
  | 'reading'
  | 'sending'
  | 'receiving'
  | 'paying'
  | 'pending'
  | 'unconfirmed'
  | 'confirmed'
  | 'error'
  | 'disabled'
  | 'unsupported';
export interface NfcPresentation {
  visible: boolean;
  status: NfcStatus;
  direction: 'send' | 'receive' | 'pay';
  message: string;
  amount?: number;
  mintUrl?: string;
  fees?: number;
  eventTime?: number;
  locked: boolean;
  hasPayment: boolean;
  canRetryDelivery: boolean;
  requestStatus?: 'starting' | 'ready' | 'disabled' | 'unsupported' | 'paused' | 'error';
  requestPauseReason?: 'locked' | 'background' | 'session' | 'payment';
}
export interface NfcSend {
  token: string;
  amount: number;
  mintUrl: string;
  operationId?: string;
  fees?: number;
}

/** Secrets and operation controllers live only here, never in navigation or persisted UI state. */
export class NfcFlow {
  private state: NfcPresentation = {
    visible: false,
    status: 'ready',
    direction: 'receive',
    message: 'Hold the phones together',
    locked: false,
    hasPayment: false,
    canRetryDelivery: false,
  };
  private listeners = new Set<() => void>();
  private ready = false;
  private appActive = true;
  private queued: NfcSend | 'reader' | undefined;
  private send?: NfcSend;
  private payment?: PaymentRequestPayment;
  private lightning?: LightningPayment;
  private requests = new Map<string, PaymentRequestPayment>();
  private invoices = new Map<string, LightningPayment>();
  private reader?: NfcPaymentSession;
  private hce?: HCESession;
  private unlisteners: (() => void)[] = [];
  private poll?: ReturnType<typeof setInterval>;
  private timeout?: ReturnType<typeof setTimeout>;
  private generation = 0;
  private busy = false;
  private refreshing = false;
  private cleanup: Promise<void> = Promise.resolve();
  private requestBroadcast?: { value: string };
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getSnapshot = () => this.state;
  private update(change: Partial<NfcPresentation>) {
    if ('requestStatus' in change && change.requestStatus !== 'paused')
      change.requestPauseReason = undefined;
    if (change.status === 'ready') change.eventTime = undefined;
    if (change.status === 'confirmed' && this.state.status !== 'confirmed')
      change.eventTime = Date.now();
    this.state = { ...this.state, ...change };
    this.listeners.forEach((listener) => listener());
  }
  setReady(ready: boolean) {
    const changed = this.ready !== ready;
    this.ready = ready;
    if (ready && this.queued) {
      const queued = this.queued;
      this.queued = undefined;
      if (queued === 'reader') this.openReader();
      else this.openSend(queued);
    }
    if (changed && !this.state.visible && this.requestBroadcast) {
      if (ready) this.resumeRequest();
      else {
        this.generation++;
        this.update({ requestStatus: 'paused', requestPauseReason: 'locked' });
        void this.stopSession();
      }
    }
  }
  /** Advertise a public request inline; a read event is never payment evidence. */
  presentRequest = (value: string): (() => void) => {
    const request = { value };
    this.requestBroadcast = request;
    this.resumeRequest();
    return () => {
      if (this.requestBroadcast !== request) return;
      this.requestBroadcast = undefined;
      this.update({ requestStatus: undefined });
      if (!this.state.visible) {
        this.generation++;
        void this.stopSession();
      }
    };
  };
  resumeRequest = () => {
    const request = this.requestBroadcast;
    if (!request) return;
    if (
      !this.ready ||
      !this.appActive ||
      this.state.visible ||
      this.busy ||
      this.payment ||
      this.lightning ||
      this.send
    ) {
      this.update({
        requestStatus: 'paused',
        requestPauseReason: !this.ready
          ? 'locked'
          : !this.appActive
            ? 'background'
            : this.state.visible || this.busy
              ? 'session'
              : 'payment',
      });
      return;
    }
    const generation = ++this.generation;
    const active = () =>
      this.generation === generation &&
      this.requestBroadcast === request &&
      this.ready &&
      this.appActive &&
      !this.state.visible;
    this.update({ requestStatus: 'starting' });
    void this.stopSession();
    // Share the existing cleanup queue so replaced requests and reader mode cannot
    // race a late HCE startup against the next NFC session.
    this.cleanup = this.cleanup.then(async () => {
      if (!active()) return;
      try {
        if (Platform.OS !== 'android' || !(await nfcService.init())) {
          if (active()) this.update({ requestStatus: 'unsupported' });
          return;
        }
        if (!active()) return;
        if (!(await nfcService.isEnabled())) {
          if (active()) this.update({ requestStatus: 'disabled' });
          return;
        }
        if (!active()) return;
        const session = await nfcService.startHceSimulation(request.value, {
          preventAutoLock: false,
        });
        if (!active()) {
          await nfcService.stopHceSimulation(session);
          return;
        }
        this.hce = session;
        this.update({ requestStatus: 'ready' });
      } catch {
        if (active()) this.update({ requestStatus: 'error' });
      }
    });
  };
  openReader = () => this.open('reader');
  openSend = (send: NfcSend) => this.open(send);
  private open(input: NfcSend | 'reader') {
    if (!this.ready) {
      this.queued ??= input;
      return;
    }
    if (this.state.visible) return;
    if (this.busy) return;
    // Reopen unresolved controllers rather than create a second payment.
    if (
      this.payment ||
      this.lightning ||
      (this.send && ['pending', 'unconfirmed', 'confirmed'].includes(this.state.status)) ||
      (this.send && input !== 'reader' && input.token === this.send.token)
    ) {
      this.update({ visible: true });
      if (this.send && ['ready', 'error', 'disabled', 'unsupported'].includes(this.state.status)) {
        void this.start();
        return;
      }
      if (this.state.status !== 'confirmed') {
        void this.refresh();
        if (this.state.status === 'pending') this.startPolling();
      }
      return;
    }
    this.send = input === 'reader' ? undefined : input;
    this.update({
      visible: true,
      requestStatus: this.requestBroadcast ? 'paused' : undefined,
      requestPauseReason: this.requestBroadcast ? 'session' : undefined,
      status: 'ready',
      direction: this.send ? 'send' : 'receive',
      amount: this.send?.amount,
      mintUrl: this.send?.mintUrl,
      fees: this.send?.fees,
      message: 'Hold the phones together',
      hasPayment: !!this.send,
      canRetryDelivery: false,
    });
    void this.start();
  }
  private alive(generation: number) {
    return this.generation === generation && this.state.visible;
  }
  private async stopSession() {
    this.unlisteners.splice(0).forEach((off) => off());
    if (this.poll) clearInterval(this.poll);
    if (this.timeout) clearTimeout(this.timeout);
    this.poll = undefined;
    this.timeout = undefined;
    const reader = this.reader;
    const hce = this.hce;
    this.reader = undefined;
    this.hce = undefined;
    this.cleanup = this.cleanup.then(async () => {
      await reader?.close();
      if (hce) await nfcService.stopHceSimulation(hce);
    });
    await this.cleanup;
  }
  dismiss = () => {
    if (this.state.locked) return false;
    this.hide();
    if (this.state.status === 'confirmed') {
      this.payment = undefined;
      this.lightning = undefined;
      this.send = undefined;
    }
    this.resumeRequest();
    return true;
  };
  private hide() {
    this.generation++;
    this.update({ visible: false });
    void this.stopSession();
  }
  background = () => {
    this.appActive = false;
    this.queued = undefined;
    this.hide();
    this.update({
      locked: false,
      requestStatus: this.requestBroadcast ? 'paused' : undefined,
      requestPauseReason: this.requestBroadcast ? 'background' : undefined,
      ...(this.send && this.state.status === 'sending'
        ? {
            status: 'unconfirmed' as const,
            message: 'Delivery interrupted. Refresh status to check settlement.',
          }
        : {}),
    });
    void this.lightning?.dispose().catch(() => {});
    return this.cleanup;
  };
  foreground = () => {
    this.appActive = true;
    this.resumeRequest();
  };
  private async start() {
    if (this.busy) return;
    this.busy = true;
    const generation = ++this.generation;
    try {
      await this.stopSession();
      if (!this.alive(generation)) return;
      if (Platform.OS === 'web') {
        this.update({ status: 'unsupported', message: 'NFC is unavailable on this device' });
        return;
      }
      const supported = await nfcService.init();
      if (!this.alive(generation)) return;
      if (!supported || (this.send && Platform.OS !== 'android')) {
        this.update({ status: 'unsupported', message: 'NFC is unavailable on this device' });
        return;
      }
      const enabled = await nfcService.isEnabled();
      if (!this.alive(generation)) return;
      if (!enabled) {
        this.update({ status: 'disabled', message: 'Enable NFC to continue' });
        return;
      }
      if (this.send) {
        const { HCESession } = require('react-native-hce') as typeof import('react-native-hce');
        const session = await nfcService.startHceSimulation(this.send.token);
        if (!this.alive(generation)) {
          await nfcService.stopHceSimulation(session);
          return;
        }
        this.hce = session;
        this.unlisteners.push(
          session.on(HCESession.Events.HCE_STATE_READ, () => {
            if (!this.alive(generation)) return;
            this.update({
              status: 'pending',
              locked: false,
              message: 'Delivered. Waiting for the recipient to claim the payment.',
            });
            this.startPolling();
          }),
        );
        this.unlisteners.push(
          session.on(HCESession.Events.HCE_STATE_CONNECTED, () => {
            if (this.alive(generation))
              this.update({ status: 'sending', locked: true, message: 'Hold the phones together' });
          }),
        );
        this.unlisteners.push(
          session.on(HCESession.Events.HCE_STATE_DISCONNECTED, () => {
            if (this.alive(generation)) {
              this.update({
                status: 'pending',
                locked: false,
                message: 'Checking whether the recipient claimed the payment.',
              });
              this.startPolling();
            }
          }),
        );
        return;
      }
      this.update({ status: 'reading' });
      const session = nfcService.openPaymentSession();
      this.reader = session;
      const tag = await session.read();
      if (!this.alive(generation)) return;
      const input = parsePaymentInput(decodePaymentNdef(tag));
      if (!input.matched || !input.ok)
        throw new Error(input.matched ? input.reason : 'Unsupported NFC payment');
      const payment = input.value.primary;
      if (payment.type === 'cashu_token') {
        this.update({ status: 'receiving', locked: true });
        // Preview decoding is optional; the existing receive service owns keyset
        // synchronization and validation, including compact V4 keyset IDs.
        try {
          const token = decodeToken(payment.value);
          this.update({ amount: token.amount, mintUrl: token.mint });
        } catch {
          /* Receive without a preview when compact IDs need synchronization. */
        }
        await this.stopSession();
        if (!this.alive(generation)) return;
        await walletService.receive(payment.value);
        if (this.alive(generation))
          this.update({ status: 'confirmed', message: 'Token received into your wallet.' });
      } else if (payment.type === 'cashu_request') {
        const request = parsePaymentRequest(payment.value, 'nfc');
        this.update({ direction: 'pay', status: 'paying', amount: request.amount });
        const existing = this.requests.get(request.raw);
        if (existing) {
          this.payment = existing;
          await this.stopSession();
          const confirmed = await existing.refresh();
          if (this.alive(generation)) {
            this.update({
              status: confirmed ? 'confirmed' : 'unconfirmed',
              mintUrl: existing.cost.mintUrl,
              fees: existing.cost.receiverFee + existing.cost.senderFee,
              hasPayment: !!existing.operationId,
              canRetryDelivery: !confirmed && !!existing.failureMessage && !!existing.encoded,
              message: confirmed
                ? 'Payment confirmed.'
                : 'This request already has a payment in History. Refresh status to check settlement.',
            });
          }
          return;
        }
        if (request.delivery === 'nip17') await this.stopSession();
        const store = useWalletStore.getState();
        const candidates = store.mints.filter((mint) =>
          isPaymentMintAllowed(request, mint.mintUrl),
        );
        candidates.sort(
          (a, b) =>
            Number(b.mintUrl === store.activeMintUrl) - Number(a.mintUrl === store.activeMintUrl),
        );
        let cost: Awaited<ReturnType<typeof previewPaymentRequest>> | undefined;
        for (const mint of candidates) {
          try {
            cost = await previewPaymentRequest(request, mint.mintUrl);
            break;
          } catch {
            /* Try the next accepted funded mint. */
          }
        }
        if (!this.alive(generation)) return;
        if (!cost) throw new Error('No compatible funded mint has enough balance including fees');
        this.payment = new PaymentRequestPayment(request, cost);
        this.requests.set(request.raw, this.payment);
        this.update({
          mintUrl: cost.mintUrl,
          fees: cost.receiverFee + cost.senderFee,
          locked: true,
        });
        await this.payment.deliver(this.writeExisting, () => {
          if (this.alive(generation)) this.update({ message: 'Publishing encrypted payment.' });
        });
        if (this.alive(generation)) {
          this.update({
            status: 'pending',
            hasPayment: true,
            message:
              request.delivery === 'nip17'
                ? 'Published. Waiting for the recipient to redeem the payment.'
                : 'Waiting for the recipient to claim the payment.',
          });
          this.startPolling();
        }
      } else if (payment.type === 'lightning_invoice') {
        await this.stopSession();
        if (!this.alive(generation)) return;
        const mint = useWalletStore.getState().activeMintUrl;
        if (!mint) throw new Error('Select a funded mint before paying');
        this.update({ direction: 'pay', status: 'paying', locked: true, mintUrl: mint });
        const existing = this.invoices.get(payment.value);
        this.lightning = existing || new LightningPayment(mint, payment.value);
        this.invoices.set(payment.value, this.lightning);
        if (existing) {
          const preview = await existing.preview().catch(() => undefined);
          const result = await existing.refresh();
          if (this.alive(generation))
            this.update({
              status: result === 'paid' ? 'confirmed' : 'unconfirmed',
              hasPayment: true,
              amount: preview?.amount,
              fees: preview?.fee_reserve,
              mintUrl: existing.mintUrl,
              message:
                result === 'paid'
                  ? 'Lightning payment confirmed.'
                  : 'This invoice already has an operation in History. Refresh status to check settlement.',
            });
          return;
        }
        const preview = await this.lightning.preview();
        if (!this.alive(generation)) return;
        this.update({ amount: preview.amount, fees: preview.fee_reserve, hasPayment: true });
        const result = await this.lightning.pay();
        if (this.alive(generation)) {
          this.update({
            status: result === 'paid' ? 'confirmed' : 'pending',
            message:
              result === 'paid'
                ? 'Lightning payment confirmed.'
                : 'Payment remains pending in History. Refresh status to check settlement.',
          });
          if (result !== 'paid') this.startPolling();
        }
      } else throw new Error('This NFC payment method is not supported');
    } catch {
      await this.stopSession();
      if (this.alive(generation))
        this.update({
          status: this.payment?.publicationState === 'unconfirmed' ? 'unconfirmed' : 'error',
          hasPayment: !!this.payment?.operationId || !!this.lightning || !!this.send,
          canRetryDelivery: !!this.payment?.encoded || !!this.send,
          message:
            this.payment?.failureMessage || 'NFC could not complete. Check contact and try again.',
        });
      if (this.payment && !this.payment.operationId) {
        this.requests.delete(this.payment.request.raw);
        this.payment = undefined;
      }
    } finally {
      this.busy = false;
      this.update({ locked: false });
      // Keep unresolved controllers even if a background event hid the sheet.
      if (!this.state.visible) {
        await this.stopSession();
        if (this.payment?.operationId || this.lightning)
          this.update({
            status: 'unconfirmed',
            hasPayment: true,
            canRetryDelivery: !!this.payment?.encoded,
            message: 'The payment remains in History. Refresh status to check settlement.',
          });
        this.resumeRequest();
      }
      void useWalletStore.getState().refreshBalance();
    }
  }
  private writeExisting = async (token: string) => {
    if (!this.state.visible || !this.payment) throw new Error('NFC session closed');
    if (!this.reader) {
      await this.cleanup;
      if (!this.state.visible) throw new Error('NFC session closed');
      this.reader = nfcService.openPaymentSession();
      const tag = await this.reader.read();
      assertSameNfcPaymentRequest(tag, this.payment.request.raw);
    }
    if (!this.state.visible) throw new Error('NFC session closed');
    await this.reader.write(token);
  };
  retry = async () => {
    if (this.busy || !this.state.visible) return;
    if (this.payment) {
      if (!this.payment.encoded) {
        await this.refresh();
        return;
      }
      this.busy = true;
      const generation = this.generation;
      this.update({ locked: true, status: 'paying', canRetryDelivery: false });
      try {
        await this.stopSession();
        await this.payment.deliver(this.writeExisting, () => {
          if (this.alive(generation)) this.update({ message: 'Publishing encrypted payment.' });
        });
        if (this.alive(generation)) {
          this.update({
            status: 'pending',
            message:
              this.payment.request.delivery === 'nip17'
                ? 'Published. Waiting for the recipient to redeem the payment.'
                : 'Waiting for the recipient to claim the payment.',
          });
          this.startPolling();
        }
      } catch {
        await this.stopSession();
        if (this.alive(generation))
          this.update({
            status: this.payment.publicationState === 'unconfirmed' ? 'unconfirmed' : 'error',
            canRetryDelivery: true,
            message:
              this.payment.failureMessage ||
              'Reconnect to the same request to retry delivery of the existing payment.',
          });
      } finally {
        this.busy = false;
        this.update({ locked: false });
      }
    } else if (!this.lightning) await this.start();
  };
  private startPolling() {
    if (this.poll || !this.state.visible) return;
    this.poll = setInterval(() => {
      void this.refresh();
    }, 3000);
    this.timeout = setTimeout(() => {
      if (this.poll) clearInterval(this.poll);
      this.poll = undefined;
      if (this.state.visible && this.state.status !== 'confirmed')
        this.update({ status: 'unconfirmed', message: 'The payment remains pending in History.' });
    }, 60_000);
  }
  refresh = async () => {
    if (this.refreshing || this.busy || !this.state.visible || this.state.status === 'confirmed')
      return;
    this.refreshing = true;
    const generation = this.generation;
    try {
      let confirmed = false;
      if (this.payment) confirmed = await this.payment.refresh();
      else if (this.lightning) confirmed = (await this.lightning.refresh()) === 'paid';
      else if (this.send) {
        const token = decodeToken(this.send.token);
        confirmed = areAllPaymentProofsSpent(
          await proofService.checkProofStates(this.send.token),
          token.proofs.length,
        );
        if (confirmed && this.send.operationId) {
          const { initService } =
            require('~/services/wallet/initService') as typeof import('~/services/wallet/initService');
          const manager = initService.getManager();
          await manager.send.checkPendingOperation(this.send.operationId).catch(() => {});
          confirmed =
            (await manager.send.getOperation(this.send.operationId))?.state === 'finalized';
        }
      }
      if (confirmed && this.alive(generation)) {
        this.update({
          status: 'confirmed',
          message: 'Payment confirmed.',
          canRetryDelivery: false,
        });
        await this.stopSession();
        void useWalletStore.getState().refreshBalance();
      }
    } catch {
      if (this.alive(generation))
        this.update({
          message: 'Status check unavailable. The payment remains pending in History.',
        });
    } finally {
      this.refreshing = false;
    }
  };
}
export const nfcFlow = new NfcFlow();
