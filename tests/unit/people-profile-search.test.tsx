import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useNostrProfileSearch } from '~/features/people/hooks/useNostrProfileSearch';
import { nostrProfileService, type NostrProfile } from '~/services/api/nostrProfileService';

jest.mock('~/services/api/nostrProfileService', () => ({
  nostrProfileService: { search: jest.fn() },
}));

const profile = (name: string): NostrProfile => ({
  name,
  pubkeyHex: name,
  npub: name,
  source: 'identifier',
});
let current: ReturnType<typeof useNostrProfileSearch>;
function Harness({ query }: { query: string }) {
  current = useNostrProfileSearch(query);
  return null;
}

describe('People remote search', () => {
  let tree: ReactTestRenderer;
  beforeEach(() => {
    jest.useFakeTimers();
    jest.mocked(nostrProfileService.search).mockReset();
  });
  afterEach(async () => {
    if (tree) await act(async () => tree.unmount());
    jest.useRealTimers();
  });

  it('debounces queries and ignores responses from an older query', async () => {
    let finishFirst!: (profiles: NostrProfile[]) => void;
    jest
      .mocked(nostrProfileService.search)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishFirst = resolve;
          }),
      )
      .mockResolvedValueOnce([profile('second')]);
    await act(async () => {
      tree = create(<Harness query="first" />);
    });
    await act(async () => jest.advanceTimersByTime(349));
    expect(nostrProfileService.search).not.toHaveBeenCalled();
    await act(async () => jest.advanceTimersByTime(1));
    await act(async () => tree.update(<Harness query="second" />));
    await act(async () => jest.advanceTimersByTime(350));
    await act(async () => finishFirst([profile('first')]));
    expect(current.results).toEqual([profile('second')]);
    expect(current.isSearching).toBe(false);
  });

  it('retries the same failed query without editing the search input', async () => {
    jest
      .mocked(nostrProfileService.search)
      .mockRejectedValueOnce(new Error('Offline'))
      .mockResolvedValueOnce([profile('alice')]);
    await act(async () => {
      tree = create(<Harness query="alice" />);
    });
    await act(async () => jest.advanceTimersByTime(350));
    expect(current.error).toBeTruthy();
    await act(async () => current.retry());
    await act(async () => jest.advanceTimersByTime(350));
    expect(current.error).toBeNull();
    expect(current.results).toEqual([profile('alice')]);
    expect(nostrProfileService.search).toHaveBeenCalledTimes(2);
  });

  it('clears search and ignores a pending response after the query is cleared', async () => {
    let finish!: (profiles: NostrProfile[]) => void;
    jest.mocked(nostrProfileService.search).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    await act(async () => {
      tree = create(<Harness query="alice" />);
    });
    await act(async () => jest.advanceTimersByTime(350));
    await act(async () => tree.update(<Harness query="" />));
    await act(async () => finish([profile('alice')]));
    expect(current.results).toEqual([]);
    expect(current.isSearching).toBe(false);
  });
});
