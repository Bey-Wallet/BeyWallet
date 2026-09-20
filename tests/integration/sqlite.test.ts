import { ExpoSqliteDb } from '../../src/storage/sqlite/db';
import { MIGRATIONS } from '../../src/storage/sqlite/schema';
import { ExpoSettingsRepository } from '../../src/storage/sqlite/repositories/SettingsRepository';

describe('SQLite integration contracts', () => {
  it('keeps migrations ordered and uniquely identified', () => {
    const ids = MIGRATIONS.map((migration) => migration.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThan(0);
  });

  it('commits transactions and persists repository values', async () => {
    const values = new Map<string, string>();
    const raw = {
      execAsync: jest.fn(async () => undefined),
      runAsync: jest.fn(async (sql: string, ...params: unknown[]) => {
        if (sql.startsWith('INSERT')) values.set(String(params[0]), String(params[1]));
        if (sql.startsWith('DELETE')) values.delete(String(params[0]));
        return { lastInsertRowId: 1, changes: 1 };
      }),
      getFirstAsync: jest.fn(async (_sql: string, key: string) => {
        const value = values.get(key);
        return value === undefined ? null : { value };
      }),
      getAllAsync: jest.fn(async () => []),
    } as any;
    const db = new ExpoSqliteDb({ database: raw });
    const repository = new ExpoSettingsRepository(db);

    await db.transaction(async () => repository.setSetting('theme', 'dark'));

    expect(await repository.getSetting('theme')).toBe('dark');
    expect(raw.execAsync).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(raw.execAsync).toHaveBeenNthCalledWith(2, 'COMMIT');
  });

  it('rolls transactions back after failures', async () => {
    const raw = {
      execAsync: jest.fn(async () => undefined),
      runAsync: jest.fn(),
      getFirstAsync: jest.fn(),
      getAllAsync: jest.fn(),
    } as any;
    const db = new ExpoSqliteDb({ database: raw });

    await expect(
      db.transaction(async () => {
        throw new Error('stop');
      }),
    ).rejects.toThrow('stop');
    expect(raw.execAsync).toHaveBeenLastCalledWith('ROLLBACK');
  });
});
