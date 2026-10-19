import {
  reserveNfcReceipt,
  completeNfcReceipt,
} from '~/storage/sqlite/repositories/nfcRequestReceipts';
import { MIGRATIONS } from '~/storage/sqlite/schema';

let mockDatabase: any;
jest.mock('~/services/wallet/initService', () => ({ getSharedDb: () => mockDatabase }));

// Use the real SQLite engine when the host Node version provides it; no test dependency is added.
const sqlite = (() => {
  try {
    return require('node:sqlite');
  } catch {
    return undefined;
  }
})();

(sqlite ? describe : describe.skip)('durable NFC receipt associations in SQLite', () => {
  let raw: any;
  beforeEach(() => {
    raw = new sqlite.DatabaseSync(':memory:');
    raw.exec(MIGRATIONS.find((migration) => migration.id === '018_nfc_request_receipts')!.sql);
    raw.exec(
      'CREATE TABLE coco_cashu_history (id TEXT PRIMARY KEY, type TEXT, state TEXT, metadata TEXT, amount INTEGER, unit TEXT)',
    );
    raw
      .prepare('INSERT INTO coco_cashu_history VALUES (?, ?, NULL, ?, 8, ?)')
      .run('receipt', 'receive', JSON.stringify({ note: 'keep' }), 'sat');
    mockDatabase = {
      runAsync: async (sql: string, ...params: any[]) => raw.prepare(sql).run(...params),
      getFirstAsync: async (sql: string, ...params: any[]) => raw.prepare(sql).get(...params),
      withExclusiveTransactionAsync: async (work: (tx: any) => Promise<void>) => {
        raw.exec('BEGIN');
        try {
          await work(mockDatabase);
          raw.exec('COMMIT');
        } catch (error) {
          raw.exec('ROLLBACK');
          throw error;
        }
      },
    };
  });
  afterEach(() => raw.close());

  it('deduplicates a fingerprint durably and prevents reassignment to another request', async () => {
    await reserveNfcReceipt('fingerprint', 'request');
    await reserveNfcReceipt('fingerprint', 'request');
    await expect(reserveNfcReceipt('fingerprint', 'another')).rejects.toThrow();
    expect(raw.prepare('SELECT COUNT(*) AS count FROM bey_nfc_request_receipts').get().count).toBe(
      1,
    );
  });

  it('preserves history metadata and prevents a receipt from settling another request', async () => {
    await reserveNfcReceipt('fingerprint', 'request');
    await completeNfcReceipt('fingerprint', 'request', 'receipt');
    expect(
      JSON.parse(raw.prepare('SELECT metadata FROM coco_cashu_history').get().metadata),
    ).toEqual({ note: 'keep', requestId: 'request', via: 'nfc' });
    await reserveNfcReceipt('another-fingerprint', 'another-request');
    await expect(
      completeNfcReceipt('another-fingerprint', 'another-request', 'receipt'),
    ).rejects.toThrow();
    expect(
      raw
        .prepare('SELECT receiptId FROM bey_nfc_request_receipts WHERE fingerprint = ?')
        .get('another-fingerprint').receiptId,
    ).toBeNull();
  });

  it('rolls back history tagging when the durable reservation is missing', async () => {
    await expect(completeNfcReceipt('missing', 'request', 'receipt')).rejects.toThrow();
    expect(
      JSON.parse(raw.prepare('SELECT metadata FROM coco_cashu_history').get().metadata),
    ).toEqual({ note: 'keep' });
  });

  it('never associates an unsuccessful receive', async () => {
    raw.exec("UPDATE coco_cashu_history SET state = 'unclaimed'");
    await reserveNfcReceipt('fingerprint', 'request');
    await expect(completeNfcReceipt('fingerprint', 'request', 'receipt')).rejects.toThrow();
    expect(
      raw.prepare('SELECT receiptId FROM bey_nfc_request_receipts').get().receiptId,
    ).toBeNull();
  });

  it('records the validated receiving fee and net amount on the same successful receipt', async () => {
    await reserveNfcReceipt('fingerprint', 'request');
    const amounts = { requestedAmount: 8, fee: 1, netAmount: 7, receivingFeeCovered: false };
    await completeNfcReceipt('fingerprint', 'request', 'receipt', amounts);
    expect(
      JSON.parse(raw.prepare('SELECT metadata FROM coco_cashu_history').get().metadata),
    ).toEqual({
      note: 'keep',
      requestId: 'request',
      via: 'nfc',
      ...amounts,
    });
    expect(
      raw.prepare('SELECT COUNT(*) AS count, amount FROM coco_cashu_history').get(),
    ).toMatchObject({ count: 1, amount: 8 });
  });

  it('rolls back tagging if the recorded gross amount differs from the validated amounts', async () => {
    await reserveNfcReceipt('fingerprint', 'request');
    await expect(
      completeNfcReceipt('fingerprint', 'request', 'receipt', {
        requestedAmount: 8,
        fee: 1,
        netAmount: 8,
        receivingFeeCovered: true,
      }),
    ).rejects.toThrow();
    expect(
      JSON.parse(raw.prepare('SELECT metadata FROM coco_cashu_history').get().metadata),
    ).toEqual({ note: 'keep' });
    expect(
      raw.prepare('SELECT receiptId FROM bey_nfc_request_receipts').get().receiptId,
    ).toBeNull();
  });
});
