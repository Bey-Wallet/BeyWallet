import type * as SQLite from 'expo-sqlite';

function database(): SQLite.SQLiteDatabase {
  const { getSharedDb } =
    require('~/services/wallet/initService') as typeof import('~/services/wallet/initService');
  const db = getSharedDb();
  if (!db) throw new Error('Wallet database is unavailable');
  return db;
}

/** A proof fingerprint and a successful receipt can each settle only one NFC request. */
export async function reserveNfcReceipt(fingerprint: string, requestId: string): Promise<void> {
  const db = database();
  await db.runAsync(
    'INSERT OR IGNORE INTO bey_nfc_request_receipts (fingerprint, requestId) VALUES (?, ?)',
    fingerprint,
    requestId,
  );
  const row = await db.getFirstAsync<{ requestId: string }>(
    'SELECT requestId FROM bey_nfc_request_receipts WHERE fingerprint = ?',
    fingerprint,
  );
  if (row?.requestId !== requestId) throw new Error('This NFC payment belongs to another request');
}

export async function completeNfcReceipt(
  fingerprint: string,
  requestId: string,
  receiptId: string,
): Promise<void> {
  await database().withExclusiveTransactionAsync(async (tx) => {
    const tagged = await tx.runAsync(
      `UPDATE coco_cashu_history
       SET metadata = json_set(COALESCE(metadata, '{}'), '$.requestId', ?, '$.via', 'nfc')
       WHERE id = ? AND type = 'receive' AND state IS NULL
       AND (json_extract(metadata, '$.requestId') IS NULL OR json_extract(metadata, '$.requestId') = ?)`,
      requestId,
      receiptId,
      requestId,
    );
    if (tagged.changes !== 1)
      throw new Error('Receipt belongs to another request or is unavailable');
    const result = await tx.runAsync(
      'UPDATE bey_nfc_request_receipts SET receiptId = ? WHERE fingerprint = ? AND requestId = ?',
      receiptId,
      fingerprint,
      requestId,
    );
    if (result.changes !== 1) throw new Error('NFC receipt association is unavailable');
  });
}
