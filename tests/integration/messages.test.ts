import {
  MessageRepository,
  type ChatMessage,
} from '~/storage/sqlite/repositories/MessageRepository';
import { MIGRATIONS } from '~/storage/sqlite/schema';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unlinkSync } from 'node:fs';

// Exercise the actual SQL using Node's built-in SQLite, without native Expo bindings.
const { DatabaseSync } = require('node:sqlite');

describe('persistent message repository', () => {
  it('preserves legacy data, deduplicates, paginates and recovers interrupted publication after restart', async () => {
    const path = join(tmpdir(), `bey-chat-test-${randomUUID()}.db`);
    let raw = new DatabaseSync(path);
    const db = {
      run: async (sql: string, params: unknown[] = []) => raw.prepare(sql).run(...params),
      all: async (sql: string, params: unknown[] = []) => raw.prepare(sql).all(...params),
    };
    try {
      raw.exec(
        "CREATE TABLE legacy_test (value TEXT); INSERT INTO legacy_test VALUES ('preserved');",
      );
      raw.exec(MIGRATIONS.find((migration) => migration.id === '016_messages')!.sql);
      let repo = new MessageRepository(db as any);
      const message: ChatMessage = {
        id: 'logical-1',
        conversation: 'alice',
        direction: 'outgoing',
        createdAt: 1,
        receivedAt: 1,
        text: 'Hello',
        read: true,
        publication: 'sending',
        transport: 'nip17',
        envelopes: [
          {
            event: { id: 'encrypted-wrap', content: 'encrypted' } as any,
            relays: ['wss://relay.example'],
          },
        ],
      };
      await repo.insert(message);
      const storedText = (await repo.page('alice'))[0];
      expect(storedText.paymentId).toBeUndefined();
      expect(storedText.paymentAmount).toBeUndefined();
      expect(storedText.paymentType).toBeUndefined();
      expect((await repo.recent())[0].paymentAmount).toBeUndefined();
      await repo.insert({
        ...message,
        text: 'Duplicate must not overwrite',
        publication: 'sent',
        envelopes: undefined,
      });
      for (let index = 2; index <= 55; index++)
        await repo.insert({
          ...message,
          id: `logical-${index}`,
          createdAt: index,
          direction: 'incoming',
          read: false,
          publication: 'sent',
          envelopes: undefined,
        });
      expect(await repo.unread()).toEqual({ alice: 54 });
      expect(await repo.recent()).toMatchObject([{ id: 'logical-55' }]);
      expect(await repo.page('alice')).toHaveLength(50);
      expect(await repo.page('alice', 50)).toHaveLength(5);
      raw.close();
      raw = new DatabaseSync(path);
      repo = new MessageRepository(db as any);
      await repo.recover();
      expect((await repo.page('alice', 50)).find((entry) => entry.id === message.id)).toMatchObject(
        {
          text: 'Hello',
          publication: 'failed',
          envelopes: message.envelopes,
        },
      );
      await repo.setPublication(message.id, 'sent');
      const resolvedEnvelopes = message.envelopes!.map((envelope) => ({
        ...envelope,
        relays: ['wss://resolved-inbox.example'],
      }));
      await repo.setEnvelopes(message.id, resolvedEnvelopes);
      raw.close();
      raw = new DatabaseSync(path);
      repo = new MessageRepository(db as any);
      expect(
        (await repo.page('alice', 50)).find((entry) => entry.id === message.id)?.envelopes,
      ).toEqual(resolvedEnvelopes);
      await repo.markRead('alice');
      expect(await repo.unread()).toEqual({});
      expect(raw.prepare('SELECT value FROM legacy_test').get().value).toBe('preserved');
    } finally {
      raw.close();
      unlinkSync(path);
    }
  });
});
