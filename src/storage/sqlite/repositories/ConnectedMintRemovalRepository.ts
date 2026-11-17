import type { ExpoSqliteDb } from '../db';

export type MintRemovalBlock =
  'funds' | 'pending' | 'unclaimed' | 'recovery' | 'missing' | 'unknown';

/** Check persisted wallet state, never just the screen's cached balance. */
export async function mintRemovalBlock(
  db: Pick<ExpoSqliteDb, 'get'>,
  mintUrl: string,
  now = Math.floor(Date.now() / 1000),
): Promise<MintRemovalBlock | null> {
  const row = await db.get<{ reason: MintRemovalBlock | null }>(
    `WITH target AS (SELECT ? AS url, ? AS now)
     SELECT CASE
       WHEN NOT EXISTS (SELECT 1 FROM coco_cashu_mints WHERE mintUrl = target.url)
         THEN 'missing'
       WHEN EXISTS (SELECT 1 FROM coco_cashu_proofs
         WHERE mintUrl = target.url AND (state <> 'spent' OR usedByOperationId IS NOT NULL))
         THEN 'funds'
       WHEN EXISTS (SELECT 1 FROM coco_cashu_mint_quotes WHERE mintUrl = target.url
         AND (state = 'PAID' OR (state = 'UNPAID' AND (expiry IS NULL OR expiry > target.now))))
         THEN 'pending'
       WHEN EXISTS (SELECT 1 FROM coco_cashu_melt_quotes WHERE mintUrl = target.url
         AND (state = 'PENDING' OR (state = 'UNPAID' AND (expiry IS NULL OR expiry > target.now))))
         THEN 'pending'
       WHEN EXISTS (SELECT 1 FROM coco_cashu_send_operations WHERE mintUrl = target.url
         AND state NOT IN ('finalized', 'rolled_back')) THEN 'pending'
       WHEN EXISTS (SELECT 1 FROM coco_cashu_melt_operations WHERE mintUrl = target.url
         AND state NOT IN ('finalized', 'rolled_back')) THEN 'pending'
       WHEN EXISTS (SELECT 1 FROM bey_change_operations WHERE mintUrl = target.url
         AND state NOT IN ('completed', 'canceled')) THEN 'pending'
       WHEN EXISTS (SELECT 1 FROM coco_cashu_history WHERE mintUrl = target.url
         AND LOWER(COALESCE(state, '')) IN
           ('unclaimed', 'pending', 'prepared', 'preparing', 'executing', 'rolling_back', 'review'))
         THEN 'unclaimed'
       WHEN EXISTS (SELECT 1 FROM coco_cashu_nostr_receive_requests
         WHERE mintUrl = target.url AND state = 'pending') THEN 'pending'
       WHEN EXISTS (SELECT 1 FROM bey_mint_transfers
         WHERE (sourceMintUrl = target.url OR targetMintUrl = target.url)
         AND state NOT IN ('completed', 'discarded')) THEN 'pending'
       WHEN EXISTS (SELECT 1 FROM bey_wallet_activity
         WHERE state IN ('pending', 'review') AND (mintUrl = target.url
           OR EXISTS (SELECT 1 FROM json_each(mintUrls) WHERE value = target.url)))
         THEN 'recovery'
       ELSE NULL END AS reason FROM target`,
    [mintUrl, now],
  );
  if (!row || !Object.prototype.hasOwnProperty.call(row, 'reason'))
    throw new Error('Mint state could not be checked.');
  return row.reason;
}

export class ConnectedMintRemovalRepository {
  constructor(private db: ExpoSqliteDb) {}

  async inspect(mintUrl: string) {
    return mintRemovalBlock(this.db, mintUrl);
  }

  async removeIfEmpty(mintUrl: string): Promise<MintRemovalBlock | null> {
    return this.db.transaction(async (tx) => {
      const blocked = await mintRemovalBlock(tx, mintUrl);
      if (blocked) return blocked;
      // Forget the connection only. Preserve counters, proofs, quotes and history,
      // including records needed if a late payment requires reconnecting the mint.
      const result = await tx.run('DELETE FROM coco_cashu_mints WHERE mintUrl = ?', [mintUrl]);
      return result.changes === 1 ? null : 'missing';
    });
  }
}
