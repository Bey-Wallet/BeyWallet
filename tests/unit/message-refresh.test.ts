import { useMessageStore } from '~/state/messageStore';

const mockRecent = jest.fn();
const mockUnread = jest.fn();
jest.mock('~/services/wallet/initService', () => ({
  initService: {
    getRepo: () => ({ messageRepository: { recent: mockRecent, unread: mockUnread } }),
  },
}));
const message = { id: 'synthetic', text: 'hello' };
beforeEach(() => {
  useMessageStore.getState().clear();
  mockRecent.mockReset().mockResolvedValue([message]);
  mockUnread.mockReset().mockResolvedValue({ alice: 1 });
});

it('runs one trailing refresh for updates arriving during a read, without redundant revisions', async () => {
  let resolve!: (value: unknown[]) => void;
  mockRecent.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const first = useMessageStore.getState().refresh();
  await Promise.resolve();
  const second = useMessageStore.getState().refresh();
  const third = useMessageStore.getState().refresh();
  expect(second).toBe(first);
  expect(third).toBe(first);
  expect(mockRecent).toHaveBeenCalledTimes(1);
  resolve([message]);
  await first;
  expect(mockRecent).toHaveBeenCalledTimes(2);
  expect(useMessageStore.getState().revision).toBe(1);
  await useMessageStore.getState().refresh();
  expect(useMessageStore.getState().revision).toBe(1);
});

it('publishes the final changed result and ignores reads from a cleared wallet', async () => {
  let resolve!: (value: unknown[]) => void;
  mockRecent.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const old = useMessageStore.getState().refresh();
  await Promise.resolve();
  useMessageStore.getState().clear();
  mockRecent.mockResolvedValue([{ ...message, id: 'new-wallet' }]);
  await useMessageStore.getState().refresh();
  resolve([message]);
  await old;
  expect(useMessageStore.getState().recent[0].id).toBe('new-wallet');
  expect(useMessageStore.getState().revision).toBe(1);
});

it('releases a failed read so a subsequent refresh can retry', async () => {
  mockRecent.mockRejectedValueOnce(new Error('busy'));
  await expect(useMessageStore.getState().refresh()).rejects.toThrow('busy');
  await useMessageStore.getState().refresh();
  expect(useMessageStore.getState().recent).toEqual([message]);
});
