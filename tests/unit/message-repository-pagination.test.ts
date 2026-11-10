import { MessageRepository } from '~/storage/sqlite/repositories/MessageRepository';

it('uses a descending tuple cursor with bound values and a fixed page size', async () => {
  const all = jest.fn(async (_sql: string, _args: unknown[]) => []);
  const repository = new MessageRepository({ all } as any);
  await repository.pageBefore('person', null);
  expect(all.mock.calls[0][0]).toContain(
    'ORDER BY createdAt DESC, receivedAt DESC, id DESC LIMIT 50',
  );
  expect(all.mock.calls[0][1]).toEqual(['person']);
  await repository.pageBefore('person', { createdAt: 30, receivedAt: 40, id: 'message-id' });
  expect(all.mock.calls[1][0]).toContain('(createdAt, receivedAt, id) < (?, ?, ?)');
  expect(all.mock.calls[1][1]).toEqual(['person', 30, 40, 'message-id']);
});
