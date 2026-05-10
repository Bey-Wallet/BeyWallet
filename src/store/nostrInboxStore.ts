/**
 * NostrInboxStore
 *
 * In-memory Zustand store for incoming Nostr ecash payments that haven't
 * been claimed yet. Tokens are queued here by NostrService and claimed
 * manually by the user via the NostrClaimSheet.
 */

import { create } from 'zustand';
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
}

// ─── Store ────────────────────────────────────────────────────────────────

export const useNostrInboxStore = create<NostrInboxState>((set, get) => ({
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
}));
