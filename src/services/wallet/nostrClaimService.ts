import { AppState, type AppStateStatus, DeviceEventEmitter } from 'react-native';
import { nip19 } from 'nostr-tools';
import { getTokenMetadata } from '@cashu/cashu-ts';
import { historyService } from '~/services/wallet/historyService';
import { initService } from '~/services/wallet/initService';
import { mintManager } from '~/services/wallet/mintManager';
import { walletService } from '~/services/wallet/walletService';
import { networkService } from '~/services/platform/networkService';
import { notificationService } from '~/services/platform/notificationService';
import { isDuplicateOutputsError } from '~/services/wallet/cashuReceiveRecovery';
import { applyIncomingContactPolicy, canReceiveFrom, contactPolicyReady } from './contactPolicy';
import { usePeopleStore } from '~/state/peopleStore';
import { useNostrReceiveSettingsStore } from '~/state/nostrReceiveSettingsStore';
import { findReceiveReceipt, unverifiedReceiptFailure } from './nostrReceiptService';
import {
  type NostrClaimErrorCode,
  type NostrClaimFailure,
  type NostrInboxItem,
  useNostrInboxStore,
} from '~/state/nostrInboxStore';

export interface NostrClaimResult {
  eventId: string;
  status:
    'claimed' | 'contact_required' | 'approval_required' | 'deferred' | 'failed' | 'dismissed';
  amount?: number;
  failure?: NostrClaimFailure;
}

export interface NostrClaimRetryOptions {
  trustMint?: boolean;
  force?: boolean;
}

const RETRY_DELAYS_MS = [5_000, 30_000, 5 * 60_000] as const;
const AUTO_CLAIM_WINDOW_MS = 60_000;
const MAX_AUTO_CLAIMS_PER_WINDOW = 12;

function normalizeMintUrl(url: string): string {
  return url.trim().replace(/\/+$/, '').toLowerCase();
}

function toNpub(pubkey: string): string | undefined {
  if (!pubkey) return undefined;
  try {
    if (pubkey.startsWith('npub1')) return pubkey;
    if (pubkey.startsWith('nprofile1')) {
      const decoded = nip19.decode(pubkey);
      return decoded.type === 'nprofile' ? nip19.npubEncode(decoded.data.pubkey) : undefined;
    }
    return nip19.npubEncode(pubkey);
  } catch {
    return undefined;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error || 'Claim failed');
}

function isAlreadySpent(error: any): boolean {
  return error?.code === 11001 || /already spent|proofs?.*spent/i.test(errorMessage(error));
}

function isP2pkFailure(error: unknown): boolean {
  return /p2pk|locked|public key|witness|signature/i.test(errorMessage(error));
}

function classifyFailure(error: unknown): NostrClaimFailure {
  const message = errorMessage(error);
  if (isDuplicateOutputsError(error)) {
    return {
      code: 'unknown',
      message: 'Wallet outputs are resynchronizing with the mint. The payment will retry.',
      retryable: true,
    };
  }
  if (
    /offline|network request failed|network unavailable|fetch failed|timeout|timed out|socket|connection/i.test(
      message,
    )
  ) {
    return { code: 'network', message, retryable: true };
  }
  if (isP2pkFailure(error)) return { code: 'p2pk', message, retryable: false };
  if (/invalid|decode|malformed|token.*format|amount/i.test(message)) {
    return { code: 'validation', message, retryable: false };
  }
  return { code: 'unknown', message, retryable: true };
}

class NostrClaimService {
  private privateKeyHex: string | null = null;
  private running = false;
  private queue: Promise<void> = Promise.resolve();
  private processing = new Set<string>();
  private recentClaims: number[] = [];
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private connectivityTimer: ReturnType<typeof setInterval> | null = null;
  private appStateSubscription: { remove: () => void } | null = null;
  private unsubscribeAuth: (() => void) | null = null;
  private unsubscribePolicy: (() => void)[] = [];
  private policyWorkQueued = false;
  private generation = 0;

  public start(privateKeyHex: string): void {
    this.stop();
    this.privateKeyHex = privateKeyHex;
    this.running = true;
    const policyChanged = () => {
      if (this.policyWorkQueued) return;
      this.policyWorkQueued = true;
      void Promise.resolve().then(async () => {
        this.policyWorkQueued = false;
        await this.processPending();
      });
    };
    this.unsubscribePolicy = [
      usePeopleStore.subscribe((state, previous) => {
        if (
          Object.values(state.people).some(
            (person) =>
              person.contactStatus === 'accepted' &&
              previous.people[person.npub]?.contactStatus !== 'accepted',
          )
        )
          policyChanged();
      }),
      useNostrReceiveSettingsStore.subscribe(policyChanged),
      usePeopleStore.persist.onFinishHydration(policyChanged),
      useNostrReceiveSettingsStore.persist.onFinishHydration(policyChanged),
    ];
    // A process can stop between markClaiming and the mint response. Persisted
    // claims must resume; the mint still validates and rejects already-spent inputs.
    const store = useNostrInboxStore.getState();
    for (const item of store.items) {
      if (item.type !== 'request' && item.status === 'claiming') {
        store.markFailed(item.id, 'Interrupted claim. Checking the saved payment again.', {
          code: 'wallet_unavailable',
          message: 'Interrupted claim. Checking the saved payment again.',
          retryable: true,
        });
      }
    }
    this.appStateSubscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') void this.processPending();
    });
    this.connectivityTimer = setInterval(() => void this.processPending(), 30_000);
    try {
      const { useAuthStore } = require('~/state/authStore');
      this.unsubscribeAuth = useAuthStore.subscribe((state: { isAuthenticated: boolean }) => {
        if (state.isAuthenticated) void this.processPending();
      });
    } catch {}
    void this.processPending();
  }

  public stop(): void {
    this.generation++;
    this.running = false;
    this.privateKeyHex = null;
    this.processing.clear();
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.connectivityTimer) clearInterval(this.connectivityTimer);
    this.retryTimer = null;
    this.connectivityTimer = null;
    this.appStateSubscription?.remove();
    this.appStateSubscription = null;
    this.unsubscribeAuth?.();
    this.unsubscribeAuth = null;
    this.unsubscribePolicy.forEach((unsubscribe) => unsubscribe());
    this.unsubscribePolicy = [];
  }

  public enqueue(eventId: string): Promise<NostrClaimResult> {
    return this.enqueueTask(() => this.claim(eventId, {}));
  }

  public retry(eventId: string, options: NostrClaimRetryOptions = {}): Promise<NostrClaimResult> {
    return this.enqueueTask(() => this.claim(eventId, { ...options, force: true }));
  }

  /** Read-only receipt recovery: spent proofs alone never prove receipt ownership. */
  public reconcileReceipt(eventId: string, checkSpent = false): Promise<NostrClaimResult> {
    return this.enqueueTask(async () => {
      const generation = this.generation;
      const store = useNostrInboxStore.getState();
      const item = store.items.find((item) => item.id === eventId);
      if (!item || item.type === 'request' || item.status === 'dismissed')
        return { eventId, status: 'deferred' };
      if (item.status === 'claimed' && item.receiptVerified)
        return { eventId, status: 'claimed', amount: item.amount };
      const allowed = () => {
        const current = useNostrInboxStore.getState().items.find((entry) => entry.id === eventId);
        return (
          !!current &&
          current.status !== 'dismissed' &&
          generation === this.generation &&
          contactPolicyReady() &&
          canReceiveFrom(item.senderPubkey) &&
          !this.canUseWallet()
        );
      };
      if (!allowed()) return { eventId, status: 'deferred' };
      try {
        const receipt = await findReceiveReceipt(item);
        if (!allowed()) return { eventId, status: 'deferred' };
        if (receipt) {
          store.markClaimed(eventId, receipt.createdAt);
          await this.afterClaim(item, true, receipt.id);
          return { eventId, status: 'claimed', amount: item.amount };
        }
        if (checkSpent && (await mintManager.isMintTrusted(item.mintUrl))) {
          const { proofService } =
            require('~/services/wallet/proofService') as typeof import('~/services/wallet/proofService');
          const states = await proofService.checkProofStates(item.tokenString);
          if (!allowed()) return { eventId, status: 'deferred' };
          const count = getTokenMetadata(item.tokenString).incompleteProofs.length;
          if (
            count > 0 &&
            states.length === count &&
            states.every((state) => state.state === 'SPENT')
          ) {
            // Recheck history in case a receive completed while the mint was queried.
            const completed = await findReceiveReceipt(item);
            if (!allowed()) return { eventId, status: 'deferred' };
            if (completed) {
              store.markClaimed(eventId, completed.createdAt);
              await this.afterClaim(item, true, completed.id);
              return { eventId, status: 'claimed', amount: item.amount };
            }
            store.markFailed(eventId, unverifiedReceiptFailure.message, unverifiedReceiptFailure);
          }
        } else if (item.status === 'claimed') {
          store.markFailed(eventId, unverifiedReceiptFailure.message, unverifiedReceiptFailure);
        }
      } catch {
        /* Unavailable local history or mint: leave receipt uncertainty intact. */
      }
      return { eventId, status: 'deferred' };
    });
  }

  public async processPending(): Promise<void> {
    if (!this.running || !this.privateKeyHex || !contactPolicyReady()) return;
    for (const item of useNostrInboxStore.getState().items) {
      if (
        item.type !== 'request' &&
        ((item.status === 'claimed' && !item.receiptVerified) ||
          item.failure?.code === 'receipt_unverified')
      )
        await this.reconcileReceipt(item.id);
    }
    const { useMessageStore } =
      require('~/state/messageStore') as typeof import('~/state/messageStore');
    for (const message of useMessageStore.getState().recent) {
      if (message.direction === 'incoming') applyIncomingContactPolicy(message.conversation);
    }
    for (const item of useNostrInboxStore.getState().items) {
      if (item.status !== 'claimed' && item.status !== 'dismissed')
        applyIncomingContactPolicy(item.senderPubkey);
    }
    // Includes text-only invitations when the receive policy changes.
    for (const person of Object.values(usePeopleStore.getState().people)) {
      if (person.contactStatus === 'unaccepted' && person.hasIncomingActivity)
        applyIncomingContactPolicy(person.npub);
    }
    const now = Date.now();
    const items = useNostrInboxStore
      .getState()
      .items.filter(
        (item) =>
          item.type !== 'request' &&
          (item.status === 'pending' ||
            item.status === 'contact_required' ||
            item.status === 'failed') &&
          (!item.nextRetryAt || item.nextRetryAt <= now) &&
          item.failure?.retryable !== false,
      )
      .sort((a, b) => a.receivedAt - b.receivedAt);

    for (const item of items) {
      await this.enqueue(item.id);
    }
    this.scheduleNextRetry();
  }

  private enqueueTask(task: () => Promise<NostrClaimResult>): Promise<NostrClaimResult> {
    const result = this.queue.then(task, task);
    this.queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private reserveClaimSlot(): boolean {
    const now = Date.now();
    this.recentClaims = this.recentClaims.filter(
      (timestamp) => now - timestamp < AUTO_CLAIM_WINDOW_MS,
    );
    if (this.recentClaims.length >= MAX_AUTO_CLAIMS_PER_WINDOW) return false;
    this.recentClaims.push(now);
    return true;
  }

  private canUseWallet(): NostrClaimFailure | null {
    if (!this.running || !this.privateKeyHex || !initService.isInitialized()) {
      return {
        code: 'wallet_unavailable',
        message: 'Wallet is not ready yet.',
        retryable: true,
      };
    }
    try {
      const { useSettingsStore } = require('~/state/settingsStore');
      const { useAuthStore } = require('~/state/authStore');
      const settings = useSettingsStore.getState();
      if (settings.initialized === false) {
        return {
          code: 'wallet_unavailable',
          message: 'Wallet settings are still loading.',
          retryable: true,
        };
      }
      if (settings.biometricEnabled && !useAuthStore.getState().isAuthenticated) {
        return {
          code: 'wallet_locked',
          message: 'Unlock the wallet to claim this payment.',
          retryable: true,
        };
      }
    } catch {
      return {
        code: 'wallet_unavailable',
        message: 'Wallet settings are unavailable.',
        retryable: true,
      };
    }
    return null;
  }

  private async claim(eventId: string, options: NostrClaimRetryOptions): Promise<NostrClaimResult> {
    const generation = this.generation;
    const store = useNostrInboxStore.getState();
    const item = store.items.find((candidate) => candidate.id === eventId);
    if (!item || item.type === 'request') return { eventId, status: 'failed' };
    if (item.status === 'claimed' && item.receiptVerified) {
      return { eventId, status: 'claimed', amount: item.amount };
    }
    // Dismissal is a durable user decision. A replayed relay event must never
    // move it back to pending/approval_required or attempt to spend it.
    if (item.status === 'dismissed') return { eventId, status: 'dismissed' };
    if (this.processing.has(eventId)) return { eventId, status: 'deferred' };

    if (!contactPolicyReady()) return { eventId, status: 'deferred' };
    applyIncomingContactPolicy(item.senderPubkey);
    if (!canReceiveFrom(item.senderPubkey)) {
      store.markContactRequired(eventId);
      return { eventId, status: 'contact_required' };
    }

    const walletFailure = this.canUseWallet();
    if (walletFailure) return this.defer(item, walletFailure);
    this.processing.add(eventId);
    try {
      const previousReceipt = await findReceiveReceipt(item);
      if (generation !== this.generation || this.canUseWallet())
        return { eventId, status: 'deferred' };
      if (!canReceiveFrom(item.senderPubkey)) {
        store.markContactRequired(eventId);
        return { eventId, status: 'contact_required' };
      }
      if (previousReceipt) {
        store.markClaimed(eventId, previousReceipt.createdAt);
        await this.afterClaim(item, true, previousReceipt.id);
        return { eventId, status: 'claimed', amount: item.amount };
      }
      if (await networkService.isOffline()) {
        return this.defer(item, {
          code: 'offline',
          message: 'Payment saved. It will retry when the device is online.',
          retryable: true,
        });
      }
      const trusted = await mintManager.isMintTrusted(item.mintUrl);
      if (!canReceiveFrom(item.senderPubkey)) {
        store.markContactRequired(eventId);
        return { eventId, status: 'contact_required' };
      }
      if (!trusted && !options.trustMint) {
        store.markApprovalRequired(eventId);
        return {
          eventId,
          status: 'approval_required',
          failure: useNostrInboxStore.getState().items.find((i) => i.id === eventId)?.failure,
        };
      }
      if (!this.reserveClaimSlot() && !options.force) {
        return this.defer(item, {
          code: 'rate_limited',
          message: 'Automatic claiming paused after too many incoming payments.',
          retryable: true,
        });
      }
      if (!trusted && options.trustMint) {
        if (!canReceiveFrom(item.senderPubkey)) {
          store.markContactRequired(eventId);
          return { eventId, status: 'contact_required' };
        }
        await mintManager.addMint(item.mintUrl, { trusted: true });
      }
      // No async boundary between this permission check and redemption submission.
      if (!canReceiveFrom(item.senderPubkey)) {
        store.markContactRequired(eventId);
        return { eventId, status: 'contact_required' };
      }
      const finalWalletFailure = this.canUseWallet();
      if (finalWalletFailure) return this.defer(item, finalWalletFailure);
      if (generation !== this.generation) return { eventId, status: 'deferred' };
      store.markClaiming(eventId);
      store.recordAttempt(eventId);
      await this.receive(item);
      store.markClaimed(eventId);
      await this.afterClaim(item);
      return { eventId, status: 'claimed', amount: item.amount };
    } catch (error) {
      if (isAlreadySpent(error)) {
        try {
          const receipt = await findReceiveReceipt(item);
          if (generation !== this.generation) return { eventId, status: 'deferred' };
          if (receipt) {
            store.markClaimed(eventId, receipt.createdAt);
            await this.afterClaim(item, true, receipt.id);
            return { eventId, status: 'claimed', amount: item.amount };
          }
        } catch {
          return this.defer(
            item,
            {
              code: 'wallet_unavailable',
              message: 'Receipt history is unavailable. Verification will retry.',
              retryable: true,
            },
            true,
          );
        }
        const result = this.defer(item, unverifiedReceiptFailure, true);
        DeviceEventEmitter.emit('nostr:claim-result', result);
        return result;
      }
      const failure = classifyFailure(error);
      console.warn('[NostrClaimService] Claim deferred or failed', {
        eventId,
        category: failure.code,
      });
      const result = this.defer(item, failure, true);
      DeviceEventEmitter.emit('nostr:claim-result', result);
      return result;
    } finally {
      this.processing.delete(eventId);
      this.scheduleNextRetry();
    }
  }

  private async receive(item: NostrInboxItem): Promise<void> {
    // Inspect the standard metadata without resolving compact keyset IDs. Actual
    // decoding, keyset checks, mint redemption and P2PK validation belong to Coco.
    const metadata = getTokenMetadata(item.tokenString);
    const needsSigning = metadata.incompleteProofs.some((proof) => {
      try {
        const secret = JSON.parse(proof.secret);
        return Array.isArray(secret) && secret[0] === 'P2PK';
      } catch {
        return false;
      }
    });
    if (needsSigning) {
      await walletService.receiveP2PK(item.tokenString, this.privateKeyHex!);
    } else {
      await walletService.receive(item.tokenString);
    }
  }

  private defer(
    item: NostrInboxItem,
    failure: NostrClaimFailure,
    attemptAlreadyRecorded = false,
  ): NostrClaimResult {
    const store = useNostrInboxStore.getState();
    const attempts = item.attemptCount || 0;
    const delay = failure.retryable ? RETRY_DELAYS_MS[Math.min(attempts, 2)] : undefined;
    const nextRetryAt = delay ? Date.now() + delay : undefined;
    if (!attemptAlreadyRecorded) store.recordAttempt(item.id, nextRetryAt);
    else if (nextRetryAt) {
      useNostrInboxStore.setState((state) => ({
        items: state.items.map((candidate) =>
          candidate.id === item.id ? { ...candidate, nextRetryAt } : candidate,
        ),
      }));
    }
    store.markFailed(item.id, failure.message, failure);
    this.scheduleNextRetry();
    return { eventId: item.id, status: failure.retryable ? 'deferred' : 'failed', failure };
  }

  private scheduleNextRetry(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (!this.running) return;
    const next = useNostrInboxStore
      .getState()
      .items.filter(
        (item) => item.status === 'failed' && item.failure?.retryable && item.nextRetryAt,
      )
      .reduce<number | undefined>(
        (earliest, item) =>
          earliest === undefined ? item.nextRetryAt : Math.min(earliest, item.nextRetryAt!),
        undefined,
      );
    if (next === undefined) return;
    this.retryTimer = setTimeout(() => void this.processPending(), Math.max(0, next - Date.now()));
  }

  private async afterClaim(
    item: NostrInboxItem,
    recovered = false,
    historyId?: string,
  ): Promise<void> {
    try {
      const { useWalletStore } = require('~/state/walletStore');
      await useWalletStore.getState().refreshBalance();
    } catch {}

    try {
      const { recordRequestReceipt } =
        require('./requestLifecycleService') as typeof import('./requestLifecycleService');
      const verifiedItem = useNostrInboxStore
        .getState()
        .items.find((entry) => entry.id === item.id);
      if (verifiedItem) await recordRequestReceipt(verifiedItem);
    } catch {}

    try {
      historyId ??= (await findReceiveReceipt(item))?.id;
      const receiptTime = useNostrInboxStore
        .getState()
        .items.find((entry) => entry.id === item.id)?.receiptCreatedAt;
      if (
        historyId &&
        (!recovered || (receiptTime !== undefined && receiptTime >= item.receivedAt))
      )
        await historyService.tagHistoryVia(
          item.mintUrl,
          'receive',
          'nostr',
          {
            nostrPubkey: toNpub(item.senderPubkey),
            nostrUsername: item.senderUsername?.replace(/@bey\.cash$/i, ''),
            nostrEventId: item.id,
            requestId: item.requestId,
          },
          undefined,
          historyId,
        );
    } catch {
      /* Metadata failure cannot undo a verified receipt. */
    }

    try {
      const { useSettingsStore } = require('~/state/settingsStore');
      if (!recovered && useSettingsStore.getState().notificationsEnabled) {
        await notificationService.sendLocalNotification(
          'Nostr payment received',
          `${item.amount.toLocaleString()} sat were added to your wallet.`,
          { eventId: item.id, type: 'nostr-payment' },
        );
      }
    } catch {}

    const result: NostrClaimResult = {
      eventId: item.id,
      status: 'claimed',
      amount: item.amount,
    };
    if (!recovered)
      DeviceEventEmitter.emit('nostr:received', {
        amount: item.amount,
        mintUrl: item.mintUrl,
        eventId: item.id,
        senderPubkey: item.senderPubkey,
        requestId: item.requestId,
      });
    DeviceEventEmitter.emit('nostr:claim-result', result);
  }
}

export const nostrClaimService = new NostrClaimService();

export type { NostrClaimErrorCode, NostrClaimFailure } from '~/state/nostrInboxStore';
