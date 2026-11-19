import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useBeyDirectory } from '~/shared/hooks/useBeyDirectory';
import { SearchDirectoryFeedback } from '~/shared/ui/SearchDirectoryFeedback';

jest.mock('tamagui', () => ({ Text: 'Text', XStack: 'XStack', YStack: 'YStack' }));
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'Button' }));
jest.mock('~/shared/ui/Spinner', () => ({ Spinner: 'Spinner' }));

let query: ReturnType<typeof useBeyDirectory>;
function Harness() {
  query = useBeyDirectory();
  return (
    <SearchDirectoryFeedback
      loading={query.isPending}
      failed={query.isError}
      refreshing={query.isFetching}
      onRetry={() => void query.refetch()}
    />
  );
}
let tree: ReactTestRenderer;
let client: QueryClient;
const originalFetch = global.fetch;
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false } } });
  global.fetch = jest.fn();
});
afterEach(async () => {
  await act(async () => tree?.unmount());
  client.clear();
  global.fetch = originalFetch;
});
const render = async () => {
  await act(async () => {
    tree = create(
      <QueryClientProvider client={client}>
        <Harness />
      </QueryClientProvider>,
    );
  });
  await act(async () => {
    await settle();
  });
};

it('separates a pending directory request from failure and recovers through retry', async () => {
  let reject!: (reason: Error) => void;
  jest.mocked(fetch).mockReturnValueOnce(
    new Promise((_resolve, fail) => {
      reject = fail;
    }),
  );
  await render();
  expect(tree.root.findAllByType('Spinner' as any)).toHaveLength(1);
  expect(tree.root.findAllByProps({ accessibilityRole: 'alert' })).toHaveLength(0);
  await act(async () => {
    reject(new Error('Offline'));
    await settle();
  });
  expect(query.isError).toBe(true);
  expect(tree.root.findAllByType('Spinner' as any)).toHaveLength(0);
  expect(JSON.stringify(tree.toJSON())).toContain('People directory unavailable');
  jest.mocked(fetch).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ names: { alice: 'a'.repeat(64) } }),
  } as Response);
  await act(async () => {
    tree.root.findByType('Button' as any).props.onPress();
    await settle();
  });
  expect(query.isSuccess).toBe(true);
  expect(query.data).toEqual({ alice: 'a'.repeat(64) });
  expect(tree.toJSON()).toBeNull();
});

it.each([
  { ok: false, json: async () => ({ names: {} }) },
  { ok: true, json: async () => ({ message: 'Unavailable' }) },
])(
  'does not turn an unavailable or malformed directory into successful empty results',
  async (response) => {
    jest.mocked(fetch).mockResolvedValueOnce(response as Response);
    await render();
    expect(query.isError).toBe(true);
    expect(query.data).toBeUndefined();
    expect(tree.root.findAllByType('Button' as any)).toHaveLength(1);
  },
);

it('keeps saved directory entries when a refresh fails', async () => {
  client.setQueryData(['bey-directory'], { alice: 'a'.repeat(64) });
  await render();
  jest.mocked(fetch).mockRejectedValueOnce(new Error('Offline'));
  await act(async () => {
    await query.refetch();
    await settle();
  });
  expect(query.isError).toBe(true);
  expect(query.data).toEqual({ alice: 'a'.repeat(64) });
  expect(JSON.stringify(tree.toJSON())).toContain('Saved people and direct public keys still work');
});
