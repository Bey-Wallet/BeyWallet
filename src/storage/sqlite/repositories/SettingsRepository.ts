import { ExpoSqliteDb } from '~/storage/sqlite/db';

export class ExpoSettingsRepository {
  private readonly db: ExpoSqliteDb;

  constructor(db: ExpoSqliteDb) {
    this.db = db;
  }

  async getSetting(key: string): Promise<string | null> {
    const row = await this.db.get<{ value: string }>(
      'SELECT value FROM coco_cashu_settings WHERE key = ?',
      [key],
    );
    return row ? row.value : null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    await this.db.run('INSERT OR REPLACE INTO coco_cashu_settings (key, value) VALUES (?, ?)', [
      key,
      value,
    ]);
  }

  async deleteSetting(key: string): Promise<void> {
    await this.db.run('DELETE FROM coco_cashu_settings WHERE key = ?', [key]);
  }
}
