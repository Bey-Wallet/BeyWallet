import type { ExpoSqliteDb } from '~/storage/sqlite/db';
import type { FileRestorePreview } from '~/state/fileRestoreStore';

/** Presentation data only; never return proof secrets or private keys to the view. */
export async function readFileRestorePreview(
  db: Pick<ExpoSqliteDb, 'all'>,
): Promise<FileRestorePreview> {
  const mints = await db.all<FileRestorePreview['mints'][number]>(`
    SELECT m.mintUrl, COALESCE(NULLIF(m.nickname, ''), NULLIF(m.name, ''), m.mintUrl) AS name,
      COALESCE(SUM(CASE WHEN p.state = 'ready' AND p.usedByOperationId IS NULL THEN p.amount ELSE 0 END), 0) AS balance,
      COALESCE(SUM(CASE WHEN p.state = 'inflight' OR (p.state = 'ready' AND p.usedByOperationId IS NOT NULL) THEN p.amount ELSE 0 END), 0) AS pendingBalance
    FROM coco_cashu_mints m LEFT JOIN coco_cashu_proofs p ON p.mintUrl = m.mintUrl
    GROUP BY m.mintUrl ORDER BY balance DESC, name, m.mintUrl
  `);
  const balance = mints.reduce((total, mint) => total + mint.balance, 0);
  const pendingBalance = mints.reduce((total, mint) => total + mint.pendingBalance, 0);
  if (
    [balance, pendingBalance, ...mints.flatMap((mint) => [mint.balance, mint.pendingBalance])].some(
      (amount) => !Number.isSafeInteger(amount) || amount < 0,
    )
  )
    throw new Error('Invalid restore preview balance.');
  return { balance, pendingBalance, mints };
}
