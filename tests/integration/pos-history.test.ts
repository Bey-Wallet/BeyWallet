import { MIGRATIONS } from '~/storage/sqlite/schema';
import { PosRepository } from '~/storage/sqlite/repositories/PosRepository';
import { scopeHistory, type HistoryListEntry } from '~/features/history/historyList';
import { buildHistorySearchIndex, searchHistory } from '~/features/history/historySearch';

const { DatabaseSync } = require('node:sqlite');

it('persists POS provenance and separates requests, NFC/Nostr receipts and invoices after reopening', async () => {
  const raw = new DatabaseSync(':memory:');
  try {
    raw.exec(MIGRATIONS.find(({ id }) => id === '023_pos_origins')!.sql);
    const db: any = {
      run: async (sql: string, params: unknown[]) => raw.prepare(sql).run(...params),
      all: async (sql: string, params: unknown[] = []) => raw.prepare(sql).all(...params),
    };
    const repo = new PosRepository(db);
    await repo.mark({
      kind: 'request',
      mintUrl: 'https://mint.example/',
      reference: 'pos-request',
    });
    await repo.mark({ kind: 'quote', mintUrl: 'https://mint.example', reference: 'pos-quote' });
    await repo.mark({ kind: 'quote', mintUrl: 'https://mint.example/', reference: 'pos-quote' });
    // A fresh repository instance reads the same provenance, independent of checkout state.
    const origins = await new PosRepository(db).list();
    expect(origins).toHaveLength(2);
    const base = {
      amount: 100,
      unit: 'sat',
      createdAt: Date.now(),
      mintUrl: 'https://mint.example/',
    };
    const entries: HistoryListEntry[] = [
      { ...base, id: 'pos-request', type: 'receive-request', state: 'pending' },
      {
        ...base,
        id: 'nfc',
        type: 'receive',
        metadata: { requestId: 'pos-request', via: 'nfc', note: 'Coffee' },
      },
      {
        ...base,
        id: 'nostr',
        type: 'receive',
        metadata: JSON.stringify({ requestId: 'pos-request', via: 'nostr' }),
      },
      { ...base, id: 'invoice', type: 'mint', quoteId: 'pos-quote', state: 'ISSUED' },
      { ...base, id: 'personal', type: 'receive', metadata: { note: 'Coffee' } },
      { ...base, id: 'old-unknown-pos', type: 'mint', quoteId: 'old-quote' },
      {
        ...base,
        id: 'other-mint',
        type: 'mint',
        quoteId: 'pos-quote',
        mintUrl: 'https://other.example',
      },
      { ...base, id: 'outgoing', type: 'send', metadata: { requestId: 'pos-request' } },
    ];
    const pos = scopeHistory(entries, 'pos', origins);
    const wallet = scopeHistory(entries, 'wallet', origins);
    expect(pos.map(({ id }) => id)).toEqual(['pos-request', 'nfc', 'nostr', 'invoice']);
    expect(wallet.map(({ id }) => id)).toEqual([
      'personal',
      'old-unknown-pos',
      'other-mint',
      'outgoing',
    ]);
    expect(
      searchHistory(buildHistorySearchIndex(pos, { mints: [], people: {} }), 'coffee').map(
        ({ id }) => id,
      ),
    ).toEqual(['nfc']);
    expect(
      searchHistory(buildHistorySearchIndex(wallet, { mints: [], people: {} }), 'coffee').map(
        ({ id }) => id,
      ),
    ).toEqual(['personal']);
  } finally {
    raw.close();
  }
});
