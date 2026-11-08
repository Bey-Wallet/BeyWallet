import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider, notifyManager } from '@tanstack/react-query';
import { useConversationPaymentStatus } from '~/features/people/hooks/useConversationPaymentStatus';
import { readConversationPaymentStatus } from '~/features/people/conversationPaymentStatus';
import type { ConversationActivity } from '~/features/people/conversationActivity';

let mockListening = true;
let mockPoll: () => Promise<void>;
const mockEvents = new Map<string, () => void>();
const mockOff = jest.fn();
jest.mock('~/storage/sqlite/sqliteStorage', () => ({
  sqliteStorage: { getItem: () => null, setItem: jest.fn(), removeItem: jest.fn() },
}));
jest.mock('~/services/wallet/initService', () => ({ initService: { isInitialized: () => true } }));
jest.mock('~/services/wallet/eventService', () => ({
  eventService: {
    on: (event: string, callback: () => void) => {
      mockEvents.set(event, callback);
      return () => {
        mockEvents.delete(event);
        mockOff();
      };
    },
  },
}));
jest.mock('~/shared/hooks/usePendingPaymentPolling', () => ({
  usePaymentListening: () => mockListening,
  usePendingPaymentPolling: (callback: () => Promise<void>) => {
    mockPoll = callback;
  },
}));
jest.mock('~/features/people/conversationPaymentStatus', () => ({
  readConversationPaymentStatus: jest.fn(),
}));

const activity: ConversationActivity[] = [
  {
    id: 'invoice',
    kind: 'payment',
    direction: 'outgoing',
    time: 1,
    status: 'Sent to relay',
    requiresAction: false,
    paymentInput: { value: 'lnbc1invoice', route: 'lightning', type: 'Invoice' },
  },
];
let tree: ReactTestRenderer;
let client: QueryClient;
let result: Record<string, string>;
function Harness({ npub = 'alice', session = 0 }) {
  result = useConversationPaymentStatus(npub, session, activity, []);
  return null;
}
async function render(props = {}) {
  await act(async () => {
    const element = (
      <QueryClientProvider client={client}>
        <Harness {...props} />
      </QueryClientProvider>
    );
    if (tree) tree.update(element);
    else tree = create(element);
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}
beforeEach(() => {
  notifyManager.setScheduler((callback) => callback());
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mockListening = true;
  jest.mocked(readConversationPaymentStatus).mockReset().mockResolvedValue('Awaiting payment');
});
afterEach(async () => {
  await act(async () => tree?.unmount());
  tree = undefined as any;
  client.clear();
  mockEvents.clear();
  mockOff.mockClear();
  notifyManager.setScheduler((callback) => setTimeout(callback, 0));
});
it('loads status on focus and refreshes on a quote event, then removes subscriptions on blur', async () => {
  await render();
  expect(result.invoice).toBe('Awaiting payment');
  jest.mocked(readConversationPaymentStatus).mockResolvedValue('Received');
  await act(async () => {
    mockEvents.get('mint-quote:redeemed')!();
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
  expect(result.invoice).toBe('Received');
  mockListening = false;
  await render();
  expect(mockEvents.size).toBe(0);
  expect(mockOff).toHaveBeenCalledTimes(5);
});
it('retains the last verified state after a failed poll', async () => {
  await render();
  jest.mocked(readConversationPaymentStatus).mockRejectedValue(new Error('Offline'));
  await act(async () => {
    await mockPoll();
  });
  expect(result.invoice).toBe('Awaiting payment');
});
it('keeps payment status isolated between conversations and wallet sessions', async () => {
  await render();
  mockListening = false;
  await render({ npub: 'bob', session: 1 });
  expect(result).toEqual({});
});
