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

// ─── Types ────────────────────────────────────────────────────────────────

export type NostrInboxStatus =
  'pending' | 'claiming' | 'claimed' | 'failed' | 'approval_required' | 'dismissed';

export type NostrClaimErrorCode =
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
  receivedAt: number;
  status: NostrInboxStatus;
  error?: string;
  failure?: NostrClaimFailure;
  attemptCount?: number;
  lastAttemptAt?: number;
  nextRetryAt?: number;
  seen: boolean; // Whether user has seen this notification
}

interface NostrInboxState {
  items: NostrInboxItem[];
  activeClaimId: string | null; // ID of the item currently being claimed

  // Actions
  addIncoming: (item: Omit<NostrInboxItem, 'status' | 'receivedAt' | 'seen'>) => void;
  markClaiming: (id: string) => void;
  markClaimed: (id: string) => void;
  markFailed: (id: string, error: string, failure?: NostrClaimFailure) => void;
  markApprovalRequired: (id: string) => void;
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
          return;
        }

        const newItem: NostrInboxItem = {
          ...item,
          status: 'pending',
          receivedAt: Date.now(),
          seen: false,
        };

        if (item.senderUsername) {
          import('~/state/contactsStore').then(({ useContactsStore }) => {
            useContactsStore.getState().updatePerson({
              npub: item.senderPubkey,
              username: item.senderUsername,
            });
          });
        }

        set((s) => ({ items: [newItem, ...s.items] }));
        console.log(
          `[NostrInboxStore] Queued incoming: ${item.amount} sats from ${item.senderPubkey.slice(0, 8)}…`,
        );
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

      markClaimed: (id) => {
        set((s) => ({
          items: s.items.map((i) =>
            i.id === id
              ? {
                  ...i,
                  status: 'claimed' as NostrInboxStatus,
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
            i.status === 'pending' || i.status === 'failed' || i.status === 'approval_required',
        );
      },

      getUnseenCount: () => {
        return get().items.filter(
          (i) =>
            !i.seen &&
            (i.status === 'pending' || i.status === 'failed' || i.status === 'approval_required'),
        ).length;
      },

      setActiveClaimId: (id) => {
        set({ activeClaimId: id });
      },

      refreshPendingStates: async () => {
        const pending = get().items.filter((i) => i.status === 'pending' || i.status === 'failed');
        if (pending.length === 0) return 0;

        let markedCount = 0;
        try {
          const { proofService } = await import('~/services/wallet');
          for (const item of pending) {
            try {
              const states = await proofService.checkProofStates(item.tokenString);
              if (states.length > 0 && states.every((s: any) => s.state === 'SPENT')) {
                console.log(
                  `[NostrInboxStore] Token ${item.id.slice(0, 8)} already spent — marking claimed`,
                );
                set((s) => ({
                  items: s.items.map((i) =>
                    i.id === item.id
                      ? { ...i, status: 'claimed' as NostrInboxStatus, seen: true }
                      : i,
                  ),
                }));
                markedCount++;
              }
            } catch (err) {
              // Non-fatal — skip this item
              console.warn(
                `[NostrInboxStore] Failed to check state for ${item.id.slice(0, 8)}:`,
                err,
              );
            }
          }
        } catch (importErr) {
          console.warn('[NostrInboxStore] Could not import proofService:', importErr);
        }
        if (markedCount > 0) {
          console.log(
            `[NostrInboxStore] Refreshed: ${markedCount} pending items marked as claimed`,
          );
        }
        return markedCount;
      },
    }),
    {
      name: 'bey-nostr-inbox-storage',
      storage: createJSONStorage(() => sqliteStorage),
    },
  ),
);
