import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider, notifyManager } from '@tanstack/react-query';
import { useConversationMessages } from '~/features/people/hooks/useConversationMessages';
import type { ChatMessage, MessageCursor } from '~/storage/sqlite/repositories/MessageRepository';

const mockPage = jest.fn();
jest.mock('~/services/wallet/initService', () => ({
  initService: {
    getRepo: () => ({
      messageRepository: { pageBefore: (...args: unknown[]) => mockPage(...args) },
    }),
  },
}));

const message = (i: number, conversation = 'alice'): ChatMessage => ({
  id: `message-${i}`,
  conversation,
  createdAt: i,
  receivedAt: i,
  text: `Text ${i}`,
  publication: 'sent',
  direction: 'incoming',
  transport: 'nip17',
  read: true,
});
let source: ChatMessage[];
let tree: ReactTestRenderer;
let client: QueryClient;
let result: ReturnType<typeof useConversationMessages>;
function Harness({ npub = 'alice', session = 0, revision = 0 }) {
  result = useConversationMessages(npub, session, revision);
  return null;
}
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}
async function mount(props = {}) {
  await act(async () => {
    tree = create(
      <QueryClientProvider client={client}>
        <Harness {...props} />
      </QueryClientProvider>,
    );
  });
  await settle();
}
beforeEach(() => {
  notifyManager.setScheduler((callback) => callback());
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  source = Array.from({ length: 120 }, (_, i) => message(120 - i));
  mockPage
    .mockReset()
    .mockImplementation(async (npub: string, before: MessageCursor | null) =>
      source
        .filter(
          (item) => item.conversation === npub && (!before || item.createdAt < before.createdAt),
        )
        .slice(0, 50),
    );
});
afterEach(async () => {
  await act(async () => tree?.unmount());
  client.clear();
  notifyManager.setScheduler((callback) => setTimeout(callback, 0));
});

it('fetches only the newest page initially and lazily appends older pages without rereading the head', async () => {
  await mount();
  expect(mockPage).toHaveBeenCalledTimes(1);
  expect(mockPage).toHaveBeenLastCalledWith('alice', null);
  expect(result.messages.map((item) => item.createdAt)).toEqual(
    source.slice(0, 50).map((item) => item.createdAt),
  );
  await act(async () => {
    await result.fetchNextPage();
  });
  expect(mockPage).toHaveBeenCalledTimes(2);
  expect(mockPage).toHaveBeenLastCalledWith('alice', {
    id: 'message-71',
    createdAt: 71,
    receivedAt: 71,
  });
  expect(result.messages).toHaveLength(100);
  await act(async () => {
    await result.fetchNextPage();
  });
  expect(result.messages).toHaveLength(120);
  expect(result.hasNextPage).toBe(false);
});

it('uses a stable older-page boundary when a newer message arrives', async () => {
  await mount();
  source.unshift(message(121));
  await act(async () => {
    await result.fetchNextPage();
  });
  expect(result.messages).toHaveLength(100);
  expect(new Set(result.messages.map((item) => item.id)).size).toBe(100);
  expect(result.messages.at(-1)?.createdAt).toBe(21);
  await act(async () => {
    tree.update(
      <QueryClientProvider client={client}>
        <Harness revision={1} />
      </QueryClientProvider>,
    );
  });
  await settle();
  expect(result.messages[0].createdAt).toBe(121);
});

it('retains loaded messages after an older-page failure and retries the same cursor', async () => {
  await mount();
  mockPage.mockRejectedValueOnce(new Error('Storage unavailable'));
  await act(async () => {
    await result.fetchNextPage();
  });
  expect(result.isError).toBe(true);
  expect(result.messages).toHaveLength(50);
  await act(async () => {
    await result.fetchNextPage();
  });
  expect(result.messages).toHaveLength(100);
});

it('starts fresh when changing person or wallet session and ignores stale responses', async () => {
  let resolve!: (value: ChatMessage[]) => void;
  mockPage.mockImplementationOnce(
    () =>
      new Promise<ChatMessage[]>((done) => {
        resolve = done;
      }),
  );
  await mount();
  await act(async () => {
    tree.update(
      <QueryClientProvider client={client}>
        <Harness npub="bob" session={1} />
      </QueryClientProvider>,
    );
  });
  await settle();
  await act(async () => resolve([message(99)]));
  expect(result.messages).toEqual([]);
  expect(mockPage).toHaveBeenLastCalledWith('bob', null);
});
