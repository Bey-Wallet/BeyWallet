import { AppState, type AppStateStatus, DeviceEventEmitter } from 'react-native';
import { nip19 } from 'nostr-tools';
import { historyService } from '~/services/wallet/historyService';
import { initService } from '~/services/wallet/initService';
import { mintManager } from '~/services/wallet/mintManager';
import { walletService } from '~/services/wallet/walletService';
import { networkService } from '~/services/platform/networkService';
import { notificationService } from '~/services/platform/notificationService';
import {
  type NostrClaimErrorCode,
  type NostrClaimFailure,
  type NostrInboxItem,
  useNostrInboxStore,
} from '~/state/nostrInboxStore';

export interface NostrClaimResult {
  eventId: string;
  status: 'claimed' | 'approval_required' | 'deferred' | 'failed';
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

function shouldFallbackToStandardReceive(error: unknown): boolean {
  return /not (a )?p2pk|no p2pk|not locked|no spending condition/i.test(errorMessage(error));
}

function classifyFailure(error: unknown): NostrClaimFailure {
  const message = errorMessage(error);
  if (
    /offline|network request failed|fetch failed|timeout|timed out|socket|connection/i.test(message)
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

  public start(privateKeyHex: string): void {
    this.stop();
    this.privateKeyHex = privateKeyHex;
    this.running = true;
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
  }

  public enqueue(eventId: string): Promise<NostrClaimResult> {
    return this.enqueueTask(() => this.claim(eventId, {}));
  }

  public retry(eventId: string, options: NostrClaimRetryOptions = {}): Promise<NostrClaimResult> {
    return this.enqueueTask(() => this.claim(eventId, { ...options, force: true }));
  }

  public async processPending(): Promise<void> {
    if (!this.running || !this.privateKeyHex) return;
    const now = Date.now();
    const items = useNostrInboxStore
      .getState()
      .items.filter(
        (item) =>
          item.type !== 'request' &&
          (item.status === 'pending' || item.status === 'failed') &&
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
      if (settings.biometricEnabled && !useAuthStore.getState().isAuthenticated) {
        return {
          code: 'wallet_locked',
          message: 'Unlock the wallet to claim this payment.',
          retryable: true,
        };
      }
    } catch {
      // Stores may not be hydrated during very early startup; wallet readiness is enough.
    }
    return null;
  }

  private async claim(eventId: string, options: NostrClaimRetryOptions): Promise<NostrClaimResult> {
    const store = useNostrInboxStore.getState();
    const item = store.items.find((candidate) => candidate.id === eventId);
    if (!item || item.type === 'request') return { eventId, status: 'failed' };
    if (item.status === 'claimed') {
      return { eventId, status: 'claimed', amount: item.amount };
    }
    if (this.processing.has(eventId)) return { eventId, status: 'deferred' };

    const walletFailure = this.canUseWallet();
    if (walletFailure) return this.defer(item, walletFailure);
    if (await networkService.isOffline()) {
      return this.defer(item, {
        code: 'offline',
        message: 'Payment saved. It will retry when the device is online.',
        retryable: true,
      });
    }

    const trusted = await mintManager.isMintTrusted(item.mintUrl);
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

    this.processing.add(eventId);
    try {
      if (!trusted && options.trustMint) {
        await mintManager.addMint(item.mintUrl, { trusted: true });
      }
      store.markClaiming(eventId);
      store.recordAttempt(eventId);
      await this.receive(item);
      store.markClaimed(eventId);
      await this.afterClaim(item);
      return { eventId, status: 'claimed', amount: item.amount };
    } catch (error) {
      if (isAlreadySpent(error)) {
        store.markClaimed(eventId);
        await this.afterClaim(item);
        return { eventId, status: 'claimed', amount: item.amount };
      }
      const failure = classifyFailure(error);
      const result = this.defer(item, failure, true);
      DeviceEventEmitter.emit('nostr:claim-result', result);
      return result;
    } finally {
      this.processing.delete(eventId);
      this.scheduleNextRetry();
    }
  }

  private async receive(item: NostrInboxItem): Promise<void> {
    try {
      await walletService.receiveP2PK(item.tokenString, this.privateKeyHex!);
    } catch (error) {
      if (isAlreadySpent(error)) throw error;
      if (shouldFallbackToStandardReceive(error)) {
        await walletService.receive(item.tokenString);
        return;
      }
      throw error;
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

  private async afterClaim(item: NostrInboxItem): Promise<void> {
    try {
      const { useWalletStore } = require('~/state/walletStore');
      await useWalletStore.getState().refreshBalance();
    } catch {}

    try {
      const { useNostrRequestStore } = require('~/state/nostrRequestStore');
      await useNostrRequestStore.getState().loadPendingRequests();
      const pending = useNostrRequestStore.getState().pendingRequests;
      const match = pending.find(
        (request: any) =>
          request.state === 'pending' &&
          ((item.requestId && request.id === item.requestId) ||
            (Number(request.amount) === Number(item.amount) &&
              normalizeMintUrl(request.mintUrl) === normalizeMintUrl(item.mintUrl))),
      );
      if (match) await useNostrRequestStore.getState().markReceived(match.id);
    } catch {}

    await historyService.tagHistoryVia(item.mintUrl, 'receive', 'nostr', {
      nostrPubkey: toNpub(item.senderPubkey),
      nostrUsername: item.senderUsername?.replace(/@bey\.cash$/i, ''),
      nostrEventId: item.id,
    });

    try {
      const { useSettingsStore } = require('~/state/settingsStore');
      if (useSettingsStore.getState().notificationsEnabled) {
        await notificationService.sendLocalNotification(
          'Nostr payment received',
          `${item.amount.toLocaleString()} sats were added to your wallet.`,
          { eventId: item.id, type: 'nostr-payment' },
        );
      }
    } catch {}

    const result: NostrClaimResult = {
      eventId: item.id,
      status: 'claimed',
      amount: item.amount,
    };
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
