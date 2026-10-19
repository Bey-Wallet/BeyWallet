/**
 * NostrInboxStore
 *
 * In-memory Zustand store for incoming Nostr ecash payments that haven't
 * been claimed yet. Tokens are queued here by NostrService and claimed
 * manually by the user via the NostrClaimSheet.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { sqliteStorage } from '~/storage/sqlite/sqliteStorage';
import { DeviceEventEmitter } from 'react-native';
import { unverifiedReceiptFailure } from '~/services/wallet/nostrReceiptService';

// ─── Types ────────────────────────────────────────────────────────────────

export type NostrInboxStatus =
  | 'pending'
  | 'contact_required'
  | 'claiming'
  | 'claimed'
  | 'failed'
  | 'approval_required'
  | 'dismissed';

export type NostrClaimErrorCode =
  | 'receipt_unverified'
  | 'offline'
  | 'wallet_locked'
  | 'wallet_unavailable'
  | 'unknown_mint'
  | 'p2pk'
  | 'validation'
  | 'rate_limited'
  | 'network'
  | 'unknown';

export interface NostrClaimFailure {
  code: NostrClaimErrorCode;
  message: string;
  retryable: boolean;
}

export interface NostrInboxItem {
  id: string; // Nostr event ID
  type?: 'token' | 'request'; // 'token' = incoming P2PK ecash, 'request' = incoming payment request
  tokenString: string; // Raw cashuA/cashuB token OR creqA/creqB request string
  amount: number;
  mintUrl: string;
  senderPubkey: string;
  senderUsername?: string; // Resolved from bey.cash directory
  requestId?: string; // Optional Cashu payment-request correlation ID
  unit?: string; // Legacy inbox records default to sat.
  receivedAt: number;
  status: NostrInboxStatus;
  error?: string;
  failure?: NostrClaimFailure;
  attemptCount?: number;
  lastAttemptAt?: number;
  nextRetryAt?: number;
  seen: boolean; // Whether user has seen this notification
  receiptVerified?: boolean; // Set only after successful redemption or exact local receipt verification.
  receiptCreatedAt?: number; // Actual redemption time, never the relay replay time.
}

interface NostrInboxState {
  items: NostrInboxItem[];
  activeClaimId: string | null; // ID of the item currently being claimed

  // Actions
  /** Returns false when this persisted Nostr event is already known. */
  addIncoming: (
    item: Omit<
      NostrInboxItem,
      'status' | 'receivedAt' | 'seen' | 'receiptVerified' | 'receiptCreatedAt'
    >,
  ) => boolean;
  markClaiming: (id: string) => void;
  markClaimed: (id: string, receiptCreatedAt?: number) => void;
  markFailed: (id: string, error: string, failure?: NostrClaimFailure) => void;
  markApprovalRequired: (id: string) => void;
  markContactRequired: (id: string) => void;
  recordAttempt: (id: string, nextRetryAt?: number) => void;
  dismiss: (id: string) => void;
  markSeen: (id: string) => void;
  markAllSeen: () => void;
  getUnclaimed: () => NostrInboxItem[];
  getUnseenCount: () => number;
  setActiveClaimId: (id: string | null) => void;
  refreshPendingStates: () => Promise<number>;
}

// ─── Store ────────────────────────────────────────────────────────────────

export const useNostrInboxStore = create<NostrInboxState>()(
  persist(
    (set, get) => ({
      items: [],
      activeClaimId: null,

      addIncoming: (item) => {
        // Deduplicate by event ID
        if (get().items.some((existing) => existing.id === item.id)) {
          console.log(`[NostrInboxStore] Duplicate event ${item.id.slice(0, 8)}, skipping`);
          return false;
        }

        const newItem: NostrInboxItem = {
          ...item,
          status: 'pending',
          receivedAt: Date.now(),
          seen: false,
          receiptVerified: undefined,
          receiptCreatedAt: undefined,
        };

        set((s) => ({ items: [newItem, ...s.items] }));

        try {
          const { usePeopleStore } = require('~/state/peopleStore');
          usePeopleStore.getState().savePerson({
            npub: item.senderPubkey,
            username: item.senderUsername,
            hasIncomingActivity: true,
          });
        } catch {
          // The payment is already persisted; contact hydration can retry later.
        }
        console.log(
          `[NostrInboxStore] Queued incoming: ${item.amount} sat from ${item.senderPubkey.slice(0, 8)}…`,
        );
        return true;
      },

      markClaiming: (id) => {
        set((s) => ({
          items: s.items.map((i) =>
            i.id === id
              ? {
                  ...i,
                  status: 'claiming' as NostrInboxStatus,
                  error: undefined,
                  failure: undefined,
                  nextRetryAt: undefined,
                }
              : i,
          ),
          activeClaimId: id,
        }));
      },

      markClaimed: (id, receiptCreatedAt = Date.now()) => {
        set((s) => ({
          items: s.items.map((i) =>
            i.id === id
              ? {
                  ...i,
                  status: 'claimed' as NostrInboxStatus,
                  receiptVerified: true,
                  receiptCreatedAt,
                  seen: true,
                  error: undefined,
                  failure: undefined,
                  nextRetryAt: undefined,
                }
              : i,
          ),
          activeClaimId: null,
        }));
      },

      markFailed: (id, error, failure) => {
        set((s) => ({
          items: s.items.map((i) =>
            i.id === id ? { ...i, status: 'failed' as NostrInboxStatus, error, failure } : i,
          ),
          activeClaimId: null,
        }));
      },

      markContactRequired: (id) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id
              ? {
                  ...item,
                  status: 'contact_required',
                  error: undefined,
                  failure: undefined,
                  nextRetryAt: undefined,
                }
              : item,
          ),
        })),

      markApprovalRequired: (id) => {
        const failure: NostrClaimFailure = {
          code: 'unknown_mint',
          message: 'This payment is from a mint you have not trusted.',
          retryable: false,
        };
        set((s) => ({
          items: s.items.map((i) =>
            i.id === id
              ? {
                  ...i,
                  status: 'approval_required' as NostrInboxStatus,
                  error: failure.message,
                  failure,
                  nextRetryAt: undefined,
                }
              : i,
          ),
        }));
      },

      recordAttempt: (id, nextRetryAt) => {
        const now = Date.now();
        set((s) => ({
          items: s.items.map((i) =>
            i.id === id
              ? {
                  ...i,
                  attemptCount: (i.attemptCount || 0) + 1,
                  lastAttemptAt: now,
                  nextRetryAt,
                }
              : i,
          ),
        }));
      },

      dismiss: (id) => {
        set((s) => ({
          items: s.items.map((i) =>
            i.id === id ? { ...i, status: 'dismissed' as NostrInboxStatus } : i,
          ),
          activeClaimId: s.activeClaimId === id ? null : s.activeClaimId,
        }));
      },

      markSeen: (id) => {
        set((s) => ({
          items: s.items.map((i) => (i.id === id ? { ...i, seen: true } : i)),
        }));
      },

      markAllSeen: () => {
        set((s) => ({
          items: s.items.map((i) => ({ ...i, seen: true })),
        }));
      },

      getUnclaimed: () => {
        return get().items.filter(
          (i) =>
            i.status === 'contact_required' ||
            i.status === 'pending' ||
            i.status === 'failed' ||
            i.status === 'approval_required',
        );
      },

      getUnseenCount: () => {
        return get().items.filter(
          (i) =>
            !i.seen &&
            (i.status === 'contact_required' ||
              i.status === 'pending' ||
              i.status === 'failed' ||
              i.status === 'approval_required'),
        ).length;
      },

      setActiveClaimId: (id) => {
        set({ activeClaimId: id });
      },

      refreshPendingStates: async () => {
        const pending = get().items.filter(
          (item) =>
            item.type !== 'request' &&
            (item.status === 'contact_required' ||
              item.status === 'pending' ||
              item.status === 'failed'),
        );
        const { nostrClaimService } =
          require('~/services/wallet/nostrClaimService') as typeof import('~/services/wallet/nostrClaimService');
        let verified = 0;
        for (const item of pending) {
          const result = await nostrClaimService.reconcileReceipt(item.id, true);
          if (result.status === 'claimed') verified++;
        }
        return verified;
      },
    }),
    {
      name: 'bey-nostr-inbox-storage',
      storage: createJSONStorage(() => sqliteStorage),
      version: 1,
      migrate: (persisted) => migrateNostrInbox(persisted) as NostrInboxState,
    },
  ),
);

export function migrateNostrInbox(persisted: unknown): { items: NostrInboxItem[] } {
  const state = persisted as { items?: NostrInboxItem[] } | undefined;
  return {
    items: (Array.isArray(state?.items) ? state.items : []).map((item) =>
      item.type !== 'request' && item.status === 'claimed' && !item.receiptVerified
        ? {
            ...item,
            status: 'failed' as const,
            error: unverifiedReceiptFailure.message,
            failure: unverifiedReceiptFailure,
            nextRetryAt: undefined,
          }
        : item,
    ),
  };
}
