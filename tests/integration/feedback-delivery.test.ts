import { FeedbackRepository } from '~/storage/sqlite/repositories/FeedbackRepository';
import { FeedbackCoordinator, type FeedbackEvent } from '~/services/feedback/feedbackCoordinator';
import { randomUUID, createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unlinkSync } from 'node:fs';
const { DatabaseSync } = require('node:sqlite');
jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'sha256' },
  digestStringAsync: async (_algorithm: string, value: string) =>
    require('node:crypto').createHash('sha256').update(value).digest('hex'),
}));

it('atomically persists delivery markers independently of history across deletion and restart', async () => {
  const file = join(tmpdir(), `bey-feedback-${randomUUID()}.db`);
  let raw = new DatabaseSync(file);
  const db = {
    exec: async (sql: string) => raw.exec(sql),
    run: async (sql: string, params: unknown[]) => raw.prepare(sql).run(...params),
    get: async (sql: string, params: unknown[]) => raw.prepare(sql).get(...params),
  };
  const event: FeedbackEvent = {
    walletId: 'wallet',
    entity: { type: 'quote', id: 'mint:quote' },
    kind: 'received',
    state: 'completed',
    origin: 'live',
    target: { type: 'transaction', id: '1' },
  };
  const toast = jest.fn();
  function bind() {
    const repository = new FeedbackRepository(db as any);
    const coordinator = new FeedbackCoordinator();
    coordinator.bind('wallet', repository);
    coordinator.connect({
      foreground: () => true,
      unlocked: () => true,
      toast,
      notification: jest.fn(),
    });
    return { repository, coordinator };
  }
  try {
    raw.exec("CREATE TABLE history (id TEXT); INSERT INTO history VALUES ('1');");
    let { repository, coordinator } = bind();
    await repository.init();
    await Promise.all(Array.from({ length: 8 }, () => coordinator.publish(event)));
    await coordinator.flush();
    expect(toast).toHaveBeenCalledTimes(1);
    raw.exec('DELETE FROM history');
    raw.close();
    raw = new DatabaseSync(file);
    ({ repository, coordinator } = bind());
    await coordinator.publish(event);
    await coordinator.flush();
    expect(toast).toHaveBeenCalledTimes(1);
    const key = createHash('sha256')
      .update(JSON.stringify(['wallet', 'quote', 'mint:quote', 'completed']))
      .digest('hex');
    expect(await repository.target('wallet', key)).toEqual({ type: 'transaction', id: '1' });
    expect(await repository.target('another-wallet', key)).toBeUndefined();
  } finally {
    raw.close();
    unlinkSync(file);
  }
});
