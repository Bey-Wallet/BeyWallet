/**
 * NostrInboxStore
 *
 * In-memory Zustand store for incoming Nostr ecash payments that haven't
 * been claimed yet. Tokens are queued here by NostrService and claimed
 * manually by the user via the NostrClaimSheet.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { sqliteStorage } from './sqliteStorage';
import { DeviceEventEmitter } from 'react-native';

// ─── Types ────────────────────────────────────────────────────────────────

export type NostrInboxStatus = 'pending' | 'claiming' | 'claimed' | 'failed';

export interface NostrInboxItem {
    id: string;               // Nostr event ID
    tokenString: string;      // Raw cashuA/cashuB token
    amount: number;
    mintUrl: string;
    senderPubkey: string;
    senderUsername?: string;   // Resolved from bey.cash directory
    receivedAt: number;
    status: NostrInboxStatus;
    error?: string;
    seen: boolean;             // Whether user has seen this notification
}

interface NostrInboxState {
    items: NostrInboxItem[];
    activeClaimId: string | null; // ID of the item currently being claimed

    // Actions
    addIncoming: (item: Omit<NostrInboxItem, 'status' | 'receivedAt' | 'seen'>) => void;
    markClaiming: (id: string) => void;
    markClaimed: (id: string) => void;
    markFailed: (id: string, error: string) => void;
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
        if (get().items.some(existing => existing.id === item.id)) {
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
            import('./contactsStore').then(({ useContactsStore }) => {
                useContactsStore.getState().addContact({
                    npub: item.senderPubkey,
                    username: item.senderUsername
                });
            });
        }

        set(s => ({ items: [newItem, ...s.items] }));
        console.log(`[NostrInboxStore] Queued incoming: ${item.amount} sats from ${item.senderPubkey.slice(0, 8)}…`);
    },

    markClaiming: (id) => {
        set(s => ({
            items: s.items.map(i =>
                i.id === id ? { ...i, status: 'claiming' as NostrInboxStatus } : i
            ),
            activeClaimId: id,
        }));
    },

    markClaimed: (id) => {
        set(s => ({
            items: s.items.map(i =>
                i.id === id ? { ...i, status: 'claimed' as NostrInboxStatus, seen: true } : i
            ),
            activeClaimId: null,
        }));
    },

    markFailed: (id, error) => {
        set(s => ({
            items: s.items.map(i =>
                i.id === id ? { ...i, status: 'failed' as NostrInboxStatus, error } : i
            ),
            activeClaimId: null,
        }));
    },

    dismiss: (id) => {
        set(s => ({
            items: s.items.filter(i => i.id !== id),
            activeClaimId: s.activeClaimId === id ? null : s.activeClaimId,
        }));
    },

    markSeen: (id) => {
        set(s => ({
            items: s.items.map(i =>
                i.id === id ? { ...i, seen: true } : i
            ),
        }));
    },

    markAllSeen: () => {
        set(s => ({
            items: s.items.map(i => ({ ...i, seen: true })),
        }));
    },

    getUnclaimed: () => {
        return get().items.filter(i => i.status === 'pending' || i.status === 'failed');
    },

    getUnseenCount: () => {
        return get().items.filter(i => !i.seen && (i.status === 'pending' || i.status === 'failed')).length;
    },

    setActiveClaimId: (id) => {
        set({ activeClaimId: id });
    },

    refreshPendingStates: async () => {
        const pending = get().items.filter(i => i.status === 'pending' || i.status === 'failed');
        if (pending.length === 0) return 0;

        let markedCount = 0;
        try {
            const { proofService } = await import('../services/core');
            for (const item of pending) {
                try {
                    const states = await proofService.checkProofStates(item.tokenString);
                    if (states.length > 0 && states.every((s: any) => s.state === 'SPENT')) {
                        console.log(`[NostrInboxStore] Token ${item.id.slice(0, 8)} already spent — marking claimed`);
                        set(s => ({
                            items: s.items.map(i =>
                                i.id === item.id ? { ...i, status: 'claimed' as NostrInboxStatus, seen: true } : i
                            ),
                        }));
                        markedCount++;
                    }
                } catch (err) {
                    // Non-fatal — skip this item
                    console.warn(`[NostrInboxStore] Failed to check state for ${item.id.slice(0, 8)}:`, err);
                }
            }
        } catch (importErr) {
            console.warn('[NostrInboxStore] Could not import proofService:', importErr);
        }
        if (markedCount > 0) {
            console.log(`[NostrInboxStore] Refreshed: ${markedCount} pending items marked as claimed`);
        }
        return markedCount;
    },
}),
{
    name: 'bey-nostr-inbox-storage',
    storage: createJSONStorage(() => sqliteStorage),
}
));
