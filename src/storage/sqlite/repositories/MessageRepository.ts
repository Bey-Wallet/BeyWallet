import type { Event } from 'nostr-tools';
import type { ExpoSqliteDb } from '~/storage/sqlite/db';

export interface ChatEnvelope {
  event: Event;
  relays: string[];
}

export interface ChatMessage {
  id: string;
  conversation: string;
  direction: 'incoming' | 'outgoing';
  createdAt: number;
  receivedAt: number;
  /** Chat body, or the note shown inside a payment card when paymentId is set. */
  text: string;
  read: boolean;
  publication: 'sending' | 'sent' | 'failed';
  transport: 'nip17' | 'nip04';
  envelopes?: ChatEnvelope[];
  paymentId?: string;
  paymentAmount?: number;
  paymentType?: 'token' | 'request';
  requestId?: string;
}

type MessageRow = Omit<
  ChatMessage,
  'read' | 'envelopes' | 'paymentId' | 'paymentAmount' | 'paymentType' | 'requestId'
> & {
  read: number;
  envelopes: string | null;
  paymentId: string | null;
  paymentAmount: number | null;
  paymentType: ChatMessage['paymentType'] | null;
  requestId: string | null;
};
const decode = (row: MessageRow): ChatMessage => ({
  ...row,
  read: !!row.read,
  envelopes: row.envelopes ? JSON.parse(row.envelopes) : undefined,
  paymentId: row.paymentId ?? undefined,
  paymentAmount: row.paymentAmount ?? undefined,
  paymentType: row.paymentType ?? undefined,
  requestId: row.requestId ?? undefined,
});

export class MessageRepository {
  constructor(private readonly db: ExpoSqliteDb) {}

  async insert(message: ChatMessage): Promise<void> {
    await this.db.run(
      `INSERT OR IGNORE INTO bey_messages
      (id, conversation, direction, createdAt, receivedAt, text, read, publication, transport, envelopes, paymentId, paymentAmount, paymentType, requestId)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        message.id,
        message.conversation,
        message.direction,
        message.createdAt,
        message.receivedAt,
        message.text,
        message.read ? 1 : 0,
        message.publication,
        message.transport,
        message.envelopes ? JSON.stringify(message.envelopes) : null,
        message.paymentId ?? null,
        message.paymentAmount ?? null,
        message.paymentType ?? null,
        message.requestId ?? null,
      ],
    );
  }

  async page(conversation: string, offset = 0): Promise<ChatMessage[]> {
    const rows = await this.db.all<MessageRow>(
      'SELECT * FROM bey_messages WHERE conversation = ? ORDER BY createdAt DESC, receivedAt DESC, id DESC LIMIT 50 OFFSET ?',
      [conversation, offset],
    );
    return rows.map(decode);
  }

  async findRequest(conversation: string, requestId: string): Promise<ChatMessage | undefined> {
    const rows = await this.db.all<MessageRow>(
      'SELECT * FROM bey_messages WHERE conversation = ? AND requestId = ? LIMIT 1',
      [conversation, requestId],
    );
    return rows[0] ? decode(rows[0]) : undefined;
  }

  async recent(): Promise<ChatMessage[]> {
    return (
      await this.db.all<MessageRow>(`SELECT m.* FROM bey_messages m WHERE m.id =
      (SELECT id FROM bey_messages WHERE conversation = m.conversation ORDER BY createdAt DESC, receivedAt DESC, id DESC LIMIT 1)
      ORDER BY createdAt DESC`)
    ).map(decode);
  }

  async unread(): Promise<Record<string, number>> {
    const rows = await this.db.all<{ conversation: string; count: number }>(
      "SELECT conversation, COUNT(*) AS count FROM bey_messages WHERE direction = 'incoming' AND read = 0 GROUP BY conversation",
    );
    return Object.fromEntries(rows.map((row) => [row.conversation, row.count]));
  }

  async markRead(conversation: string): Promise<void> {
    await this.db.run('UPDATE bey_messages SET read = 1 WHERE conversation = ?', [conversation]);
  }

  async setPublication(id: string, publication: ChatMessage['publication']): Promise<void> {
    await this.db.run('UPDATE bey_messages SET publication = ? WHERE id = ?', [publication, id]);
  }

  async setEnvelopes(id: string, envelopes: ChatEnvelope[]): Promise<void> {
    await this.db.run('UPDATE bey_messages SET envelopes = ? WHERE id = ?', [
      JSON.stringify(envelopes),
      id,
    ]);
  }

  async recover(): Promise<void> {
    await this.db.run(
      "UPDATE bey_messages SET publication = 'failed' WHERE publication = 'sending'",
    );
  }
}
