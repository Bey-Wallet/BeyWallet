import {
  FeedbackCoordinator,
  quoteFeedbackId,
  type FeedbackEvent,
  type FeedbackStorage,
} from '~/services/feedback/feedbackCoordinator';
import { feedbackCatalog } from '~/services/feedback/feedbackCatalog';
import {
  NotificationResponseQueue,
  isFeedbackTarget,
} from '~/services/feedback/notificationNavigation';

const receipt: FeedbackEvent = {
  walletId: 'wallet-a',
  entity: { type: 'nostr', id: 'event-1' },
  kind: 'received',
  state: 'completed',
  origin: 'live',
  details: { amount: 25 },
};

it('canonicalizes quote identities without collapsing distinct mint paths or quote IDs', () => {
  expect(quoteFeedbackId('https://MINT.example/path/', 'quote')).toBe(
    quoteFeedbackId('https://mint.example/path', 'quote'),
  );
  expect(quoteFeedbackId('https://mint.example/Path', 'quote')).not.toBe(
    quoteFeedbackId('https://mint.example/path', 'quote'),
  );
  expect(quoteFeedbackId('https://mint.example/path', 'other')).not.toBe(
    quoteFeedbackId('https://mint.example/path', 'quote'),
  );
});
function durableStorage() {
  const markers = new Set<string>();
  return {
    reserve: jest.fn(async (_event, key: string) => {
      if (markers.has(key)) return false;
      markers.add(key);
      return true;
    }),
  } satisfies FeedbackStorage;
}
function setup(storage: FeedbackStorage = durableStorage()) {
  const coordinator = new FeedbackCoordinator();
  const presenter = {
    foreground: () => true,
    unlocked: () => true,
    toast: jest.fn(),
    notification: jest.fn(),
  };
  coordinator.bind('wallet-a', storage);
  coordinator.connect(presenter);
  return { coordinator, presenter, storage };
}
afterEach(() => jest.useRealTimers());

it('still delivers the screen and toast if the haptic presenter throws', async () => {
  const coordinator = new FeedbackCoordinator();
  coordinator.bind('wallet-a', durableStorage());
  const toast = jest.fn();
  const outcome = jest.fn();
  coordinator.connect({
    hapticEpoch: () => 1,
    haptic: () => {
      throw new Error('Native unavailable');
    },
    foreground: () => true,
    unlocked: () => true,
    toast,
    notification: jest.fn(),
  });
  const release = coordinator.claim(receipt.entity.id, outcome);
  await expect(coordinator.publish(receipt)).resolves.toBeUndefined();
  expect(outcome).toHaveBeenCalledTimes(1);
  release();
  await coordinator.publish({ ...receipt, entity: { type: 'receipt', id: 'other' } });
  await coordinator.flush();
  expect(toast).toHaveBeenCalledTimes(1);
});

it.each(['background', 'disabled', 'locked'])(
  'discards queued haptics across a %s transition without replay',
  async () => {
    const coordinator = new FeedbackCoordinator();
    coordinator.bind('wallet-a', durableStorage());
    let epoch: number | undefined = 1;
    const haptic = jest.fn();
    coordinator.connect({
      hapticEpoch: () => epoch,
      haptic,
      foreground: () => true,
      unlocked: () => true,
      toast: jest.fn(),
      notification: jest.fn(),
    });
    await coordinator.publish(receipt);
    epoch = undefined;
    epoch = 2;
    await coordinator.flush();
    expect(haptic).not.toHaveBeenCalled();
    await coordinator.publish(receipt);
    await coordinator.flush();
    expect(haptic).not.toHaveBeenCalled();
  },
);

it('does not replay an event received while feedback was disabled after it is enabled', async () => {
  const coordinator = new FeedbackCoordinator();
  coordinator.bind('wallet-a', durableStorage());
  let epoch: number | undefined;
  const haptic = jest.fn();
  coordinator.connect({
    hapticEpoch: () => epoch,
    haptic,
    foreground: () => true,
    unlocked: () => true,
    toast: jest.fn(),
    notification: jest.fn(),
  });
  await coordinator.publish(receipt);
  epoch = 1;
  await coordinator.flush();
  expect(haptic).not.toHaveBeenCalled();
});

it('aggregates a live burst into one haptic and excludes catch-up outcomes', async () => {
  const coordinator = new FeedbackCoordinator();
  coordinator.bind('wallet-a', durableStorage());
  const haptic = jest.fn();
  coordinator.connect({
    hapticEpoch: () => 1,
    haptic,
    foreground: () => true,
    unlocked: () => true,
    toast: jest.fn(),
    notification: jest.fn(),
  });
  await coordinator.publish(receipt);
  await coordinator.publish({ ...receipt, entity: { type: 'receipt', id: 'second' } });
  await coordinator.publish({
    ...receipt,
    entity: { type: 'receipt', id: 'old' },
    origin: 'catch-up',
  });
  await coordinator.flush();
  expect(haptic).toHaveBeenCalledTimes(1);
  expect(haptic.mock.calls[0][0]).toHaveLength(2);
});

it('reserves concurrent SDK/Nostr/screen reports once and survives restart', async () => {
  const { coordinator, presenter, storage } = setup();
  await Promise.all(Array.from({ length: 6 }, () => coordinator.publish(receipt)));
  await coordinator.flush();
  expect(presenter.toast).toHaveBeenCalledTimes(1);
  const restarted = setup(storage);
  await restarted.coordinator.publish(receipt);
  await restarted.coordinator.flush();
  expect(restarted.presenter.toast).not.toHaveBeenCalled();
});

it('gives a focused owner exactly one outcome and no global surface; late events use a toast after release', async () => {
  const { coordinator, presenter } = setup();
  const outcome = jest.fn();
  const release = coordinator.claim('request-1', outcome);
  const correlated = { ...receipt, parentOperationId: 'request-1' };
  await coordinator.publish(correlated);
  await coordinator.publish(correlated);
  await coordinator.flush();
  expect(outcome).toHaveBeenCalledTimes(1);
  expect(presenter.toast).not.toHaveBeenCalled();
  expect(presenter.notification).not.toHaveBeenCalled();
  release();
  await coordinator.publish({ ...receipt, entity: { type: 'nostr', id: 'late' } });
  await coordinator.flush();
  expect(presenter.toast).toHaveBeenCalledTimes(1);
});

it.each(['catch-up'] as const)(
  'reserves %s/import/recovery events without presenting',
  async (origin) => {
    const { coordinator, presenter } = setup();
    await coordinator.publish({ ...receipt, origin });
    await coordinator.publish(receipt);
    await coordinator.flush();
    expect(presenter.toast).not.toHaveBeenCalled();
    expect(presenter.notification).not.toHaveBeenCalled();
  },
);

it('allows pending → completed, without deriving success from amount or copy', async () => {
  const { coordinator, presenter } = setup();
  await coordinator.publish({ ...receipt, kind: 'pending', state: 'pending' });
  await coordinator.flush();
  await coordinator.publish(receipt);
  await coordinator.flush();
  expect(presenter.toast).toHaveBeenCalledTimes(2);
});

it('coalesces receipts, routes locked/background events only to OS, and clears wallet queues', async () => {
  const { coordinator, presenter } = setup();
  presenter.unlocked = () => false;
  await coordinator.publish(receipt);
  await coordinator.publish({ ...receipt, entity: { type: 'nostr', id: 'event-2' } });
  await coordinator.flush();
  expect(presenter.notification).toHaveBeenCalledTimes(1);
  expect(presenter.notification.mock.calls[0][0]).toHaveLength(2);
  expect(presenter.toast).not.toHaveBeenCalled();
  await coordinator.publish({ ...receipt, entity: { type: 'nostr', id: 'event-3' } });
  coordinator.clear();
  await coordinator.flush();
  expect(presenter.notification).toHaveBeenCalledTimes(1);
});

it('does not reject a wallet result when storage or delivery fails', async () => {
  const { coordinator } = setup({ reserve: jest.fn().mockRejectedValue(new Error('storage')) });
  await expect(coordinator.publish(receipt)).resolves.toBeUndefined();
});

it('rechecks ownership when a review opens during the burst window', async () => {
  const { coordinator, presenter } = setup();
  await coordinator.publish(receipt);
  const outcome = jest.fn();
  coordinator.claim(receipt.entity.id, outcome);
  await coordinator.flush();
  expect(outcome).toHaveBeenCalledTimes(1);
  expect(presenter.toast).not.toHaveBeenCalled();
});

it('silences maintenance/restored balances and retains their durable reservations', async () => {
  const { coordinator, presenter } = setup();
  const resume = coordinator.suppress();
  await coordinator.publish(receipt);
  resume();
  await coordinator.publish(receipt);
  await coordinator.flush();
  expect(presenter.toast).not.toHaveBeenCalled();
});

it('ignores old-wallet in-flight reservations after switching wallets', async () => {
  let resolve!: (reserved: boolean) => void;
  const { coordinator, presenter } = setup({
    reserve: jest.fn(
      () =>
        new Promise<boolean>((done) => {
          resolve = done;
        }),
    ),
  });
  const pending = coordinator.publish(receipt);
  coordinator.bind('wallet-b', durableStorage());
  resolve(true);
  await pending;
  await coordinator.flush();
  expect(presenter.toast).not.toHaveBeenCalled();
});

it('queues cold/warm taps until ready, deduplicates callbacks, rejects URLs and clears stale targets', () => {
  const queue = new NotificationResponseQueue();
  const id = 'a'.repeat(64);
  queue.enqueue(id);
  queue.enqueue(id);
  queue.enqueue('https://example.org/pay');
  expect(queue.take(false)).toBeUndefined();
  expect(queue.take(true)).toBe(id);
  expect(queue.take(true)).toBeUndefined();
  queue.enqueue('b'.repeat(64));
  queue.clear();
  expect(queue.take(true)).toBeUndefined();
  expect(isFeedbackTarget({ type: 'url', id: 'https://example.org' })).toBe(false);
  expect(isFeedbackTarget({ type: 'transaction', id: '12' })).toBe(true);
});

it('keeps default OS copy private and accurately labels token preparation', () => {
  expect(feedbackCatalog.received.body).toBe('Open Bey to view your payment.');
  expect(feedbackCatalog.prepared.title).toBe('Ecash ready to share');
  for (const copy of Object.values(feedbackCatalog)) {
    expect(copy.body).not.toMatch(/sat|invoice|token|proof|key/i);
  }
});
