import type { ExpoSqliteDb } from '../db';

export type PosOrigin = {
  kind: 'request' | 'quote';
  mintUrl: string;
  reference: string;
  saleId?: string | null;
};

/** Local provenance only; never changes quotes, proofs, or payment state. */
export class PosRepository {
  constructor(private db: ExpoSqliteDb) {}

  async mark({ kind, mintUrl, reference, saleId }: PosOrigin): Promise<void> {
    await this.db.run(
      `INSERT INTO bey_pos_origins(kind, mintUrl, reference, saleId) VALUES (?, ?, ?, ?)
       ON CONFLICT(kind, mintUrl, reference) DO UPDATE SET saleId = COALESCE(bey_pos_origins.saleId, excluded.saleId)`,
      [kind, mintUrl.replace(/\/+$/, ''), reference, saleId || null],
    );
  }

  async list(): Promise<PosOrigin[]> {
    return this.db.all<PosOrigin>('SELECT kind, mintUrl, reference, saleId FROM bey_pos_origins');
  }
}
