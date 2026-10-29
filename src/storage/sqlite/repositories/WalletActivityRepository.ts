import type { ExpoSqliteDb } from '../db';

export type WalletActivity = {
  id: string;
  kind: 'get-change' | 'optimize' | 'recovery';
  mintUrl: string;
  state: 'pending' | 'review' | 'completed' | 'canceled';
  createdAt: number;
  updatedAt: number;
  inputAmount: number | null;
  fee: number | null;
  balanceDelta: number | null;
  beforeCount: number | null;
  afterCount: number | null;
  operationId: string | null;
  receiveHistoryId: string | null;
  completedCount: number | null;
  totalCount: number | null;
  observedBalance: number | null;
  mintUrls: string[];
  hidden?: boolean;
  /** In-memory guard only; wallet identity is never part of the persisted activity payload. */
  walletId?: string;
};
type ActivityRow = Omit<WalletActivity, 'mintUrls'> & { mintUrls: string; hidden?: boolean };
const numberOrNull = (value: unknown) => (Number.isSafeInteger(value) ? (value as number) : null);
function parse(row: ActivityRow): WalletActivity | undefined {
  try {
    const urls = JSON.parse(row.mintUrls);
    if (
      !['optimize', 'recovery', 'get-change'].includes(row.kind) ||
      !['pending', 'review', 'completed', 'canceled'].includes(row.state) ||
      typeof row.id !== 'string' ||
      !Number.isFinite(row.createdAt) ||
      !Array.isArray(urls) ||
      urls.some((url) => typeof url !== 'string')
    )
      return;
    return { ...row, mintUrls: urls, hidden: !!row.hidden };
  } catch {
    return;
  }
}

/** Public summaries only. Never copy private operation payloads into the activity feed. */
export class WalletActivityRepository {
  constructor(private db: ExpoSqliteDb) {}
  async save(activity: WalletActivity) {
    await this.db.run(
      `INSERT INTO bey_wallet_activity
      (id, kind, mintUrl, state, createdAt, updatedAt, inputAmount, fee, balanceDelta, beforeCount, afterCount,
       operationId, receiveHistoryId, completedCount, totalCount, observedBalance, mintUrls)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET state=excluded.state, updatedAt=excluded.updatedAt,
       inputAmount=excluded.inputAmount, fee=excluded.fee, balanceDelta=excluded.balanceDelta,
       beforeCount=excluded.beforeCount, afterCount=excluded.afterCount, operationId=excluded.operationId,
       receiveHistoryId=excluded.receiveHistoryId, completedCount=excluded.completedCount,
       totalCount=excluded.totalCount, observedBalance=excluded.observedBalance, mintUrls=excluded.mintUrls
      WHERE bey_wallet_activity.state != 'completed' OR excluded.state = 'completed'`,
      [
        activity.id,
        activity.kind,
        activity.mintUrl,
        activity.state,
        activity.createdAt,
        activity.updatedAt,
        activity.inputAmount,
        activity.fee,
        activity.balanceDelta,
        activity.beforeCount,
        activity.afterCount,
        activity.operationId,
        activity.receiveHistoryId,
        activity.completedCount,
        activity.totalCount,
        activity.observedBalance,
        JSON.stringify(activity.mintUrls),
      ],
    );
  }
  async list(limit = 200, id?: string): Promise<WalletActivity[]> {
    const rows = await this.db.all<ActivityRow>(
      `SELECT a.*, EXISTS(SELECT 1 FROM bey_hidden_activity h WHERE h.id=a.id) AS hidden
      FROM bey_wallet_activity a ${id ? 'WHERE a.id = ?' : ''} ORDER BY a.createdAt DESC LIMIT ?`,
      id ? [id, limit] : [limit],
    );
    const changes = await this.db.all<any>(
      `SELECT id, mintUrl, state, createdAt,
      json_extract(data, '$.id') AS dataId, json_extract(data, '$.mintUrl') AS dataMint,
      json_extract(data, '$.state') AS dataState,
      json_extract(data, '$.inputAmount') AS inputAmount, json_extract(data, '$.outputAmount') AS outputAmount,
      json_extract(data, '$.fee') AS fee, json_array_length(data, '$.inputSecrets') AS beforeCount,
      json_array_length(data, '$.outputs.keep') AS afterCount,
      EXISTS(SELECT 1 FROM bey_hidden_activity h WHERE h.id='activity:change:' || c.id) AS hidden
      FROM bey_change_operations c WHERE json_valid(data) AND state IN ('submitted', 'completed')
      ${id ? 'AND c.id = ?' : ''} ORDER BY createdAt DESC LIMIT ?`,
      id
        ? [id.startsWith('activity:change:') ? id.slice('activity:change:'.length) : '', limit]
        : [limit],
    );
    const projected: WalletActivity[] = changes.flatMap((row) => {
      if (
        row.dataId !== row.id ||
        row.dataMint !== row.mintUrl ||
        row.dataState !== row.state ||
        !Number.isSafeInteger(row.inputAmount) ||
        row.inputAmount <= 0 ||
        !Number.isSafeInteger(row.fee) ||
        row.fee < 0 ||
        row.outputAmount !== row.inputAmount - row.fee ||
        row.outputAmount <= 0
      )
        return [];
      const completed = row.state === 'completed';
      return [
        {
          id: `activity:change:${row.id}`,
          kind: 'get-change',
          mintUrl: row.mintUrl,
          state: completed ? 'completed' : 'review',
          createdAt: row.createdAt,
          updatedAt: row.createdAt,
          inputAmount: row.inputAmount,
          fee: completed ? row.fee : null,
          balanceDelta: completed ? -row.fee : null,
          beforeCount: numberOrNull(row.beforeCount),
          afterCount: completed ? numberOrNull(row.afterCount) : null,
          operationId: row.id,
          receiveHistoryId: null,
          completedCount: null,
          totalCount: null,
          observedBalance: null,
          mintUrls: [row.mintUrl],
          hidden: !!row.hidden,
        },
      ];
    });
    return [
      ...rows.flatMap((row) => {
        const value = parse(row);
        return value ? [value] : [];
      }),
      ...projected,
    ].sort((a, b) => b.createdAt - a.createdAt);
  }
  async get(id: string) {
    return (await this.list(1, id)).find((item) => item.id === id && !item.hidden);
  }
  async optimizationLinks() {
    return this.db.all<Pick<WalletActivity, 'mintUrl' | 'operationId' | 'receiveHistoryId'>>(
      "SELECT mintUrl, operationId, receiveHistoryId FROM bey_wallet_activity WHERE kind='optimize'",
    );
  }
  async hide(id: string) {
    // Hiding activity never deletes recovery journals or spendable proofs.
    await this.db.run('INSERT OR IGNORE INTO bey_hidden_activity(id) VALUES (?)', [id]);
  }
}
