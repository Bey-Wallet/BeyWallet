import type { ExpoSqliteDb } from '../db';
import type { HistoryEntry } from 'coco-cashu-core';

export interface MintTransferRecord {
  id: string;
  sourceMintUrl: string;
  targetMintUrl: string;
  mintQuoteId: string;
  meltQuoteId: string | null;
  operationId: string | null;
  amount: number;
  feeReserve: number;
  feePaid: number | null;
  expiresAt: number | null;
  state: 'draft' | 'prepared' | 'committed' | 'completed' | 'failed' | 'discarded';
  stage: 'payment' | 'issuance';
  createdAt: number;
}

export class MintTransferRepository {
  constructor(private db: ExpoSqliteDb) {}

  async insert(record: MintTransferRecord): Promise<void> {
    await this.db.run(
      `INSERT INTO bey_mint_transfers
       (id, sourceMintUrl, targetMintUrl, mintQuoteId, meltQuoteId, operationId,
        amount, feeReserve, feePaid, expiresAt, state, stage, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.id,
        record.sourceMintUrl,
        record.targetMintUrl,
        record.mintQuoteId,
        record.meltQuoteId,
        record.operationId,
        record.amount,
        record.feeReserve,
        record.feePaid,
        record.expiresAt,
        record.state,
        record.stage,
        record.createdAt,
      ],
    );
  }

  async get(id: string): Promise<MintTransferRecord | undefined> {
    return this.db.get<MintTransferRecord>('SELECT * FROM bey_mint_transfers WHERE id = ?', [id]);
  }

  async unfinished(): Promise<MintTransferRecord[]> {
    return this.db.all<MintTransferRecord>(
      "SELECT * FROM bey_mint_transfers WHERE state IN ('draft', 'prepared', 'committed')",
    );
  }

  async save(record: MintTransferRecord): Promise<void> {
    await this.db.run(
      `UPDATE bey_mint_transfers SET meltQuoteId = ?, operationId = ?, feeReserve = ?,
       feePaid = COALESCE(?, feePaid), expiresAt = ?, state = ?, stage = ? WHERE id = ?`,
      [
        record.meltQuoteId,
        record.operationId,
        record.feeReserve,
        record.feePaid,
        record.expiresAt,
        record.state,
        record.stage,
        record.id,
      ],
    );
  }

  async commit(id: string): Promise<boolean> {
    const result = await this.db.run(
      "UPDATE bey_mint_transfers SET state = 'committed' WHERE id = ? AND state = 'prepared'",
      [id],
    );
    return result.changes === 1;
  }

  async ensureAnchor(record: MintTransferRecord): Promise<void> {
    await this.db.run(
      `INSERT INTO coco_cashu_history
       (mintUrl, type, unit, amount, createdAt, quoteId, state, operationId)
       SELECT ?, 'melt', 'sat', ?, ?, ?, 'UNPAID', ?
       WHERE NOT EXISTS (SELECT 1 FROM coco_cashu_history
         WHERE type = 'melt' AND mintUrl = ? AND quoteId = ?)`,
      [
        record.sourceMintUrl,
        record.amount,
        record.createdAt,
        record.meltQuoteId,
        record.operationId,
        record.sourceMintUrl,
        record.meltQuoteId,
      ],
    );
  }

  async saveFee(id: string, fee: number): Promise<void> {
    await this.db.run('UPDATE bey_mint_transfers SET feePaid = ? WHERE id = ?', [fee, id]);
  }

  async project(entry: HistoryEntry): Promise<HistoryEntry> {
    if (entry.type !== 'melt') return entry;
    const record = await this.db.get<MintTransferRecord>(
      `SELECT * FROM bey_mint_transfers WHERE sourceMintUrl = ? AND meltQuoteId = ?
       AND state IN ('committed', 'completed', 'failed')`,
      [entry.mintUrl, entry.quoteId],
    );
    if (!record) return entry;
    return {
      ...entry,
      amount: record.amount,
      state:
        record.state === 'completed' ? 'PAID' : record.state === 'failed' ? 'failed' : 'PENDING',
      metadata: {
        ...entry.metadata,
        via: 'swap',
        transferId: record.id,
        sourceMintUrl: record.sourceMintUrl,
        targetMintUrl: record.targetMintUrl,
        transferStage: record.stage,
        fee: String(record.feePaid ?? record.feeReserve),
      },
    } as HistoryEntry;
  }
}
