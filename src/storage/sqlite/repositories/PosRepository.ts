import type { ExpoSqliteDb } from '../db';

export type PosOrigin = {
  kind: 'request' | 'quote';
  mintUrl: string;
  reference: string;
};

/** Local provenance only; never changes quotes, proofs, or payment state. */
export class PosRepository {
  constructor(private db: ExpoSqliteDb) {}

  async mark({ kind, mintUrl, reference }: PosOrigin): Promise<void> {
    await this.db.run(
      'INSERT OR IGNORE INTO bey_pos_origins(kind, mintUrl, reference) VALUES (?, ?, ?)',
      [kind, mintUrl.replace(/\/+$/, ''), reference],
    );
  }

  async list(): Promise<PosOrigin[]> {
    return this.db.all<PosOrigin>('SELECT kind, mintUrl, reference FROM bey_pos_origins');
  }
}
