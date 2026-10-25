import type { ExpoSqliteDb } from '../db';
import type { ChangeOutputs } from './ChangeOperationRepository';

export interface LightningReceipt {
  mintUrl: string;
  quoteId: string;
  request: string;
  amount: number;
  paidAt: number;
  locked: boolean;
  providers: string[];
  state: 'pending' | 'prepared' | 'submitted' | 'completed';
  outputs?: ChangeOutputs['keep'];
  issue?: string;
}

/** Collection markers are deliberately independent of deletable History entries. */
export class LightningAddressRepository {
  constructor(
    private db: ExpoSqliteDb,
    private owner: string,
  ) {}

  async get(mintUrl: string, quoteId: string): Promise<LightningReceipt | undefined> {
    const row = await this.db.get<{ data: string }>(
      'SELECT data FROM bey_lightning_receipts WHERE owner = ? AND mintUrl = ? AND quoteId = ?',
      [this.owner, mintUrl, quoteId],
    );
    return row ? JSON.parse(row.data) : undefined;
  }

  async list(): Promise<LightningReceipt[]> {
    const rows = await this.db.all<{ data: string }>(
      'SELECT data FROM bey_lightning_receipts WHERE owner = ?',
      [this.owner],
    );
    return rows.map((row) => JSON.parse(row.data));
  }

  async save(receipt: LightningReceipt): Promise<void> {
    await this.db.run(
      'INSERT OR REPLACE INTO bey_lightning_receipts (owner, mintUrl, quoteId, data) VALUES (?, ?, ?, ?)',
      [this.owner, receipt.mintUrl, receipt.quoteId, JSON.stringify(receipt)],
    );
  }

  async checkpoint(provider: string): Promise<number> {
    return (
      (
        await this.db.get<{ checkpoint: number }>(
          'SELECT checkpoint FROM bey_lightning_discovery WHERE owner = ? AND provider = ?',
          [this.owner, provider],
        )
      )?.checkpoint ?? 0
    );
  }

  async advance(provider: string, checkpoint: number): Promise<void> {
    await this.db.run(
      'INSERT INTO bey_lightning_discovery (owner, provider, checkpoint) VALUES (?, ?, ?) ON CONFLICT(owner, provider) DO UPDATE SET checkpoint = MAX(checkpoint, excluded.checkpoint)',
      [this.owner, provider, checkpoint],
    );
  }
}
