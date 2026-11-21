import { createMintMetadataQueue } from '~/services/api/mintMetadataQueue';

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

it('bounds active metadata requests and releases capacity after success or failure', async () => {
  const run = createMintMetadataQueue(2);
  const finish: ((value: number) => void)[] = [];
  let active = 0;
  let peak = 0;
  const jobs = Array.from({ length: 5 }, (_, index) =>
    run(async () => {
      active++;
      peak = Math.max(peak, active);
      try {
        if (index === 2) throw new Error('Unavailable');
        return await new Promise<number>((resolve) => {
          finish[index] = resolve;
        });
      } finally {
        active--;
      }
    }, new AbortController().signal),
  );
  const results = Promise.allSettled(jobs);
  await flush();
  expect(active).toBe(2);
  expect(finish[3]).toBeUndefined();
  finish[0](0);
  await flush();
  expect(finish[3]).toBeDefined();
  finish[1](1);
  await flush();
  finish[3](3);
  finish[4](4);
  expect((await results).map((result) => result.status)).toEqual([
    'fulfilled',
    'fulfilled',
    'rejected',
    'fulfilled',
    'fulfilled',
  ]);
  expect(peak).toBe(2);
});

it('removes queued work when its row disappears without starting a network request', async () => {
  const run = createMintMetadataQueue(1);
  let release!: () => void;
  const active = run(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
    new AbortController().signal,
  );
  const controller = new AbortController();
  const request = jest.fn(async () => 'unused');
  const queued = run(request, controller.signal);
  const cancelled = expect(queued).rejects.toMatchObject({ name: 'AbortError' });
  controller.abort();
  await cancelled;
  await flush();
  release();
  await active;
  await flush();
  expect(request).not.toHaveBeenCalled();
  await expect(run(async () => 'next', new AbortController().signal)).resolves.toBe('next');
});

it('does not start work cancelled before it begins', async () => {
  const run = createMintMetadataQueue();
  const controller = new AbortController();
  const request = jest.fn(async () => 'unused');
  const job = run(request, controller.signal);
  const cancelled = expect(job).rejects.toMatchObject({ name: 'AbortError' });
  controller.abort();
  await cancelled;
  expect(request).not.toHaveBeenCalled();
});

it('runs interactive then visible work ahead of background scans, preserving FIFO within a priority', async () => {
  const run = createMintMetadataQueue(1);
  let release!: () => void;
  const active = run(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
    new AbortController().signal,
  );
  const order: string[] = [];
  const add = (name: string, priority: 'background' | 'visible' | 'interactive') =>
    run(
      async () => {
        order.push(name);
      },
      new AbortController().signal,
      { key: name, priority },
    );
  const jobs = [
    add('background-1', 'background'),
    add('background-2', 'background'),
    add('visible-1', 'visible'),
    add('visible-2', 'visible'),
    add('detail', 'interactive'),
  ];
  await flush();
  release();
  await Promise.all([active, ...jobs]);
  expect(order).toEqual(['detail', 'visible-1', 'visible-2', 'background-1', 'background-2']);
});

it('promotes the existing queued lookup without duplicating its request', async () => {
  const run = createMintMetadataQueue(1);
  let release!: () => void;
  const active = run(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
    new AbortController().signal,
  );
  const order: string[] = [];
  const original = run(
    async () => {
      order.push('first');
    },
    new AbortController().signal,
    { key: 'first', priority: 'background' },
  );
  const request = jest.fn(async () => {
    order.push('opened');
  });
  const promoted = run(request, new AbortController().signal, {
    key: 'opened',
    priority: 'background',
  });
  run.promote('opened', 'interactive');
  run.promote('opened', 'visible');
  await flush();
  release();
  await Promise.all([active, original, promoted]);
  expect(order).toEqual(['opened', 'first']);
  expect(request).toHaveBeenCalledTimes(1);
});
