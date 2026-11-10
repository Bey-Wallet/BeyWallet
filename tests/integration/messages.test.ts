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
  it('loads newest first and keeps equal-timestamp cursor pages stable after new arrivals', async () => {
    const raw = new DatabaseSync(':memory:');
    const db = {
      run: async (sql: string, params: unknown[] = []) => raw.prepare(sql).run(...params),
      all: async (sql: string, params: unknown[] = []) => raw.prepare(sql).all(...params),
    };
    try {
      for (const id of ['016_messages', '015_nostr_receive_requests', '017_request_lifecycle'])
        raw.exec(MIGRATIONS.find((migration) => migration.id === id)!.sql);
      const repo = new MessageRepository(db as any);
      const base: ChatMessage = {
        id: '',
        conversation: 'alice',
        direction: 'incoming',
        createdAt: 10,
        receivedAt: 1,
        text: 'Text',
        publication: 'sent',
        transport: 'nip17',
        read: false,
      };
      for (let i = 1; i <= 75; i++)
        await repo.insert({
          ...base,
          id: String(i).padStart(3, '0'),
          receivedAt: Math.floor(i / 3),
        });
      await repo.insert({ ...base, id: 'other-person', conversation: 'bob' });
      const first = await repo.pageBefore('alice', null);
      expect(first).toHaveLength(50);
      expect(first[0].id).toBe('075');
      expect(first.at(-1)!.id).toBe('026');
      await repo.insert({ ...base, id: 'new-arrival', createdAt: 11 });
      const older = await repo.pageBefore('alice', first.at(-1)!);
      expect(older).toHaveLength(25);
      expect(older[0].id).toBe('025');
      expect(older.at(-1)!.id).toBe('001');
      expect(new Set([...first, ...older].map((message) => message.id)).size).toBe(75);
      expect(await repo.pageBefore('alice', older.at(-1)!)).toEqual([]);
      expect((await repo.pageBefore('alice', null))[0].id).toBe('new-arrival');
    } finally {
      raw.close();
    }
  });

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
      raw.exec(MIGRATIONS.find((migration) => migration.id === '015_nostr_receive_requests')!.sql);
      raw.exec(MIGRATIONS.find((migration) => migration.id === '017_request_lifecycle')!.sql);
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
      expect(await repo.insert(message)).toBe(true);
      const storedText = (await repo.page('alice'))[0];
      expect(storedText.paymentId).toBeUndefined();
      expect(storedText.paymentAmount).toBeUndefined();
      expect(storedText.paymentType).toBeUndefined();
      expect((await repo.recent())[0].paymentAmount).toBeUndefined();
      expect(
        await repo.insert({
          ...message,
          text: 'Duplicate must not overwrite',
          publication: 'sent',
          envelopes: undefined,
        }),
      ).toBe(false);
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
