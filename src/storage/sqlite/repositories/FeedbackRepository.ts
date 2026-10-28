import type { ExpoSqliteDb } from '../db';
import { deliveryIdentifier } from '~/services/feedback/deliveryIdentifier';
import type {
  FeedbackEvent,
  FeedbackStorage,
  FeedbackTarget,
} from '~/services/feedback/feedbackCoordinator';

/** Independent of transaction history: deleting a receipt cannot replay its alert. */
export class FeedbackRepository implements FeedbackStorage {
  constructor(private db: ExpoSqliteDb) {}

  async init() {
    await this.db.exec(`CREATE TABLE IF NOT EXISTS bey_feedback_delivery (
      deliveryKey TEXT PRIMARY KEY NOT NULL,
      walletId TEXT NOT NULL,
      target TEXT
    )`);
  }

  async reserve(event: FeedbackEvent, _key: string) {
    const key = await deliveryIdentifier(event);
    const result = await this.db.run(
      'INSERT OR IGNORE INTO bey_feedback_delivery (deliveryKey, walletId, target) VALUES (?, ?, ?)',
      [key, event.walletId, event.target ? JSON.stringify(event.target) : null],
    );
    return result.changes === 1;
  }

  async target(walletId: string, key: string): Promise<FeedbackTarget | undefined> {
    const row = await this.db.get<{ target: string | null }>(
      'SELECT target FROM bey_feedback_delivery WHERE walletId = ? AND deliveryKey = ?',
      [walletId, key],
    );
    return row?.target ? JSON.parse(row.target) : undefined;
  }
}
