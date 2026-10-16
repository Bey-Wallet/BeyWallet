import { create } from 'zustand';
import type * as SQLite from 'expo-sqlite';
import type { PaymentRequestPublication } from '~/services/wallet/paymentRequestPublisher';
import { normalizeNpub } from '~/shared/utils/nostr';
import type { NostrInboxItem } from './nostrInboxStore';

export type NostrRequestState = 'pending' | 'received' | 'expired' | 'cancelled';
export interface NostrReceiveRequest {
  id: string;
  mintUrl: string;
  amount: number;
  unit: string;
  creqString: string;
  nostrPubkey: string;
  recipient?: string;
  description?: string;
  state: NostrRequestState;
  createdAt: number;
  updatedAt: number;
}

export interface RequestPayment {
  id: string;
  requestId?: string;
  conversation?: string;
  inboxId?: string;
  operationId?: string;
  state: 'preparing' | 'pending' | 'paid' | 'rolled_back';
  publication?: PaymentRequestPublication;
  published: boolean;
}

export function findRequestPayment(
  item: NostrInboxItem,
  payments: RequestPayment[],
): RequestPayment | undefined {
  if (item.type !== 'request') return;
  return payments.find(
    (payment) =>
      payment.inboxId === item.id ||
      (!!item.requestId &&
        payment.requestId === item.requestId &&
        payment.conversation === normalizeNpub(item.senderPubkey)),
  );
}

// Deferred access avoids a static dependency on wallet initialization.
function getDb(): SQLite.SQLiteDatabase {
  const { getSharedDb } =
    require('~/services/wallet/initService') as typeof import('~/services/wallet/initService');
  const shared = getSharedDb?.();
  if (shared) return shared;
  const { getDb: getSqliteDb } =
    require('~/storage/sqlite/sqliteStorage') as typeof import('~/storage/sqlite/sqliteStorage');
  return getSqliteDb();
}

const TABLE = 'coco_cashu_nostr_receive_requests';
let generation = 0;
let loadQueue: Promise<void> = Promise.resolve();
interface RequestStore {
  requests: NostrReceiveRequest[];
  pendingRequests: NostrReceiveRequest[];
  payments: RequestPayment[];
  addRequest: (
    request: Omit<NostrReceiveRequest, 'state' | 'createdAt' | 'updatedAt'>,
  ) => Promise<void>;
  markReceived: (id: string) => Promise<void>;
  markCancelled: (id: string) => Promise<void>;
  loadPendingRequests: () => Promise<void>;
  clearExpiredRequests: (olderThanMs?: number) => Promise<void>;
  savePayment: (payment: RequestPayment) => Promise<void>;
  clear: () => void;
}

export const useNostrRequestStore = create<RequestStore>((set, get) => {
  const updateState = async (id: string, state: NostrRequestState) => {
    await getDb().runAsync(
      `UPDATE ${TABLE} SET state = ?, updatedAt = ? WHERE id = ?`,
      state,
      Date.now(),
      id,
    );
    await get().loadPendingRequests();
  };
  return {
    requests: [],
    pendingRequests: [],
    payments: [],
    addRequest: async (request) => {
      const now = Date.now();
      await getDb().runAsync(
        `INSERT OR IGNORE INTO ${TABLE}
        (id, mintUrl, amount, unit, creqString, nostrPubkey, recipient, description, state, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
        ON CONFLICT(id) DO UPDATE SET recipient = COALESCE(${TABLE}.recipient, excluded.recipient)
        WHERE ${TABLE}.creqString = excluded.creqString`,
        request.id,
        request.mintUrl,
        request.amount,
        request.unit,
        request.creqString,
        request.nostrPubkey,
        request.recipient ? normalizeNpub(request.recipient) : null,
        request.description ?? null,
        now,
        now,
      );
      await get().loadPendingRequests();
    },
    markReceived: (id) => updateState(id, 'received'),
    markCancelled: (id) => updateState(id, 'cancelled'),
    loadPendingRequests: async () => {
      const currentGeneration = generation;
      // Each caller must await its own fresh read, including payment controllers
      // checking for an existing operation before reserving any funds.
      const load = loadQueue.then(async () => {
        if (generation !== currentGeneration) return;
        const db = getDb();
        const requests = await db.getAllAsync<NostrReceiveRequest>(
          `SELECT * FROM ${TABLE} ORDER BY createdAt DESC`,
        );
        const rows = await db.getAllAsync<
          Omit<RequestPayment, 'publication' | 'published'> & {
            publication: string | null;
            published: number;
          }
        >('SELECT * FROM bey_request_payments');
        if (generation !== currentGeneration) return;
        set({
          requests,
          pendingRequests: requests.filter((request) => request.state === 'pending'),
          payments: rows.map((row) => ({
            ...row,
            published: !!row.published,
            publication: row.publication ? JSON.parse(row.publication) : undefined,
          })),
        });
      });
      loadQueue = load.catch(() => undefined);
      await load;
    },
    // NUT-18 requests created here have no expiry. Age alone is not an expiry signal.
    clearExpiredRequests: async () => {
      await get().loadPendingRequests();
    },
    savePayment: async (payment) => {
      await getDb().runAsync(
        `INSERT INTO bey_request_payments (id, requestId, conversation, inboxId, operationId, state, publication, published)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET operationId = COALESCE(bey_request_payments.operationId, excluded.operationId),
           state = CASE WHEN bey_request_payments.state IN ('paid', 'rolled_back') THEN bey_request_payments.state ELSE excluded.state END,
           publication = COALESCE(excluded.publication, bey_request_payments.publication),
           published = MAX(excluded.published, bey_request_payments.published)`,
        payment.id,
        payment.requestId ?? null,
        payment.conversation ?? null,
        payment.inboxId ?? null,
        payment.operationId ?? null,
        payment.state,
        payment.publication ? JSON.stringify(payment.publication) : null,
        payment.published ? 1 : 0,
      );
      await get().loadPendingRequests();
    },
    clear: () => {
      generation++;
      set({ requests: [], pendingRequests: [], payments: [] });
    },
  };
});

export const nostrRequestStore = {
  markReceived: (id: string) => useNostrRequestStore.getState().markReceived(id),
  getPending: () => useNostrRequestStore.getState().pendingRequests,
};
