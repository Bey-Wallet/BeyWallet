import { createOfflineEcash, prepareLocalEcash } from '~/services/wallet/offlineEcash';
import { prepareEcash } from '~/services/wallet/ecashPayment';
import { LocalSendEventsPlugin } from '~/services/wallet/plugins/LocalSendEventsPlugin';
import { encodeToken } from '~/services/wallet/tokenUtils';
import type { ExpoSqliteRepositories } from '~/storage/sqlite';

jest.mock('~/services/wallet/tokenUtils', () => ({ encodeToken: jest.fn(() => 'encoded-token') }));

function harness() {
  let rows = [
    {
      id: '01' + 'ab'.repeat(32),
      amount: 4,
      secret: 'synthetic',
      C: 'signature',
      state: 'ready',
      usedByOperationId: null as string | null,
      dleq: { e: 'e', s: 's', r: 'r' },
      witness: 'witness',
    },
  ];
  let operations: any[] = [],
    history: any[] = [];
  let queue: Promise<unknown> = Promise.resolve();
  const proofRepository = {
    getProofsByOperationId: jest.fn(async (_mint: string, id: string) =>
      rows.filter((p) => p.usedByOperationId === id),
    ),
    releaseProofs: jest.fn(async (_mint: string, secrets: string[]) => {
      rows
        .filter((p) => secrets.includes(p.secret))
        .forEach((p) => {
          p.usedByOperationId = null;
        });
    }),
    getAvailableProofs: jest.fn(async () =>
      rows.filter((p) => p.state === 'ready' && !p.usedByOperationId),
    ),
    reserveProofs: jest.fn(async (_mint: string, secrets: string[], operationId: string) => {
      for (const secret of secrets) {
        const proof = rows.find((p) => p.secret === secret)!;
        if (proof.state !== 'ready' || proof.usedByOperationId) throw new Error('Already reserved');
        proof.usedByOperationId = operationId;
      }
    }),
    setProofState: jest.fn(async (_mint: string, secrets: string[], state: string) => {
      rows
        .filter((p) => secrets.includes(p.secret))
        .forEach((p) => {
          p.state = state;
        });
    }),
  };
  const mintRepository = { isTrustedMint: jest.fn(async () => true) };
  const historyRepository = {
    addHistoryEntry: jest.fn(async (entry) => {
      history.push(entry);
    }),
  };
  const sendOperationRepository = {
    getById: jest.fn(async (id: string) => operations.find((op) => op.id === id) ?? null),
    update: jest.fn(async (operation) => {
      operations = operations.map((op) => (op.id === operation.id ? operation : op));
    }),
    create: jest.fn(async (operation) => {
      operations.push(operation);
    }),
  };
  const repos = { proofRepository, mintRepository, historyRepository, sendOperationRepository };
  const repositories = {
    withTransaction: (fn: (scope: any) => Promise<unknown>) => {
      const result = queue.then(async () => {
        const snapshot = rows.map((p) => ({ ...p }));
        const oldOperations = [...operations],
          oldHistory = [...history];
        try {
          return await fn(repos);
        } catch (error) {
          rows = snapshot;
          operations = oldOperations;
          history = oldHistory;
          throw error;
        }
      });
      queue = result.catch(() => {});
      return result;
    },
  } as unknown as Pick<ExpoSqliteRepositories, 'withTransaction'>;
  return {
    repositories,
    ...repos,
    rows: () => rows,
    operations: () => operations,
    history: () => history,
  };
}

beforeEach(() => jest.mocked(encodeToken).mockReset().mockReturnValue('encoded-token'));

it('persists one pending send and history entry atomically with inflight proofs and original verification data', async () => {
  const state = harness();
  const result = await createOfflineEcash('https://mint.test', 4, 'offline-op', state.repositories);
  expect(result.encoded).toBe('encoded-token');
  expect(result.token.proofs[0]).toMatchObject({
    amount: 4,
    dleq: { e: 'e', s: 's', r: 'r' },
    witness: 'witness',
  });
  expect(state.rows()[0]).toMatchObject({ state: 'inflight', usedByOperationId: 'offline-op' });
  expect(state.operations()).toEqual([
    expect.objectContaining({
      id: 'offline-op',
      state: 'pending',
      needsSwap: false,
      fee: 0,
      inputProofSecrets: ['synthetic'],
    }),
  ]);
  expect(state.history()).toEqual([
    expect.objectContaining({
      operationId: 'offline-op',
      amount: 4,
      state: 'pending',
      token: result.token,
    }),
  ]);
});

it('keeps full keyset IDs in History when encoding shortens the outgoing copy', async () => {
  const state = harness();
  jest.mocked(encodeToken).mockImplementation((token) => {
    token.proofs[0].id = token.proofs[0].id.slice(0, 16);
    return 'encoded-token';
  });
  const result = await createOfflineEcash('https://mint.test', 4, 'offline-op', state.repositories);
  expect(result.token.proofs[0].id).toHaveLength(66);
  expect(state.history()[0].token.proofs[0].id).toHaveLength(66);
});

it.each(['encoding', 'history', 'operation'] as const)(
  'rolls back local spending when %s fails',
  async (stage) => {
    const state = harness();
    if (stage === 'encoding')
      jest.mocked(encodeToken).mockImplementation(() => {
        throw new Error('encoding failed');
      });
    if (stage === 'history')
      state.historyRepository.addHistoryEntry.mockRejectedValueOnce(new Error('history failed'));
    if (stage === 'operation')
      state.sendOperationRepository.create.mockRejectedValueOnce(new Error('operation failed'));
    await expect(
      createOfflineEcash('https://mint.test', 4, 'offline-op', state.repositories),
    ).rejects.toThrow('failed');
    expect(state.rows()[0]).toMatchObject({ state: 'ready', usedByOperationId: null });
    expect(state.history()).toHaveLength(0);
    expect(state.operations()).toHaveLength(0);
  },
);

it('never substitutes a nearby amount or modifies proofs when the exact value is unavailable', async () => {
  const state = harness();
  await expect(
    createOfflineEcash('https://mint.test', 3, 'offline-op', state.repositories),
  ).rejects.toThrow('Go online once');
  expect(state.proofRepository.reserveProofs).not.toHaveBeenCalled();
  expect(state.history()).toHaveLength(0);
});

it('prevents concurrent sends from sharing the same proofs', async () => {
  const state = harness();
  const results = await Promise.allSettled([
    createOfflineEcash('https://mint.test', 4, 'one', state.repositories),
    createOfflineEcash('https://mint.test', 4, 'two', state.repositories),
  ]);
  expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
  expect(state.history()).toHaveLength(1);
  expect(state.operations()).toHaveLength(1);
});

it('rejects untrusted mints before selecting or spending proofs', async () => {
  const state = harness();
  state.mintRepository.isTrustedMint.mockResolvedValue(false);
  await expect(
    createOfflineEcash('https://mint.test', 4, 'offline-op', state.repositories),
  ).rejects.toThrow('not trusted');
  expect(state.proofRepository.getAvailableProofs).not.toHaveBeenCalled();
});

it('never exposes a repository proof secret in the user-facing storage failure', async () => {
  const state = harness();
  state.proofRepository.reserveProofs.mockRejectedValueOnce(
    new Error('Proof secret synthetic is reserved'),
  );
  await expect(
    createOfflineEcash('https://mint.test', 4, 'offline-op', state.repositories),
  ).rejects.toThrow('Offline payment storage failed. No ecash was created.');
  expect(state.rows()[0]).toMatchObject({ state: 'ready', usedByOperationId: null });
});

it('uses local coins online without loading the manager, and spends only on confirmation', async () => {
  const state = harness();
  const manager = jest.fn();
  const review = await prepareEcash('https://mint.test', 4, manager, () => state.repositories);
  expect(manager).not.toHaveBeenCalled();
  expect(review.fee).toBe(0);
  expect(state.rows()[0].state).toBe('ready');
  expect(state.rows()[0].usedByOperationId).toBeTruthy();
  expect(state.operations()[0].state).toBe('prepared');
  expect(state.history()).toHaveLength(0);
  const [first, second] = await Promise.all([review.execute(), review.execute()]);
  expect(first).toEqual(second);
  await review.dispose();
  expect(state.rows()[0].state).toBe('inflight');
  expect(state.operations()[0].state).toBe('pending');
  expect(state.history()).toHaveLength(1);
});

it('releases a canceled local review and prevents its later execution', async () => {
  const state = harness();
  const review = (await prepareLocalEcash('https://mint.test', 4, 'local', state.repositories))!;
  await expect(
    prepareLocalEcash('https://mint.test', 4, 'other', state.repositories),
  ).resolves.toBeNull();
  await review.dispose();
  await review.dispose();
  await expect(review.execute()).rejects.toThrow('replaced');
  expect(state.rows()[0]).toMatchObject({ state: 'ready', usedByOperationId: null });
  expect(state.operations()[0].state).toBe('rolled_back');
  expect(state.history()).toHaveLength(0);
});

it('rolls back a failed local confirmation without losing its reservation or creating history', async () => {
  const state = harness();
  const review = (await prepareLocalEcash('https://mint.test', 4, 'local', state.repositories))!;
  state.historyRepository.addHistoryEntry.mockRejectedValueOnce(new Error('synthetic'));
  await expect(review.execute()).rejects.toThrow('storage failed');
  expect(state.rows()[0]).toMatchObject({ state: 'ready', usedByOperationId: 'local' });
  expect(state.operations()[0].state).toBe('prepared');
  expect(state.history()).toHaveLength(0);
  await review.dispose();
  expect(state.rows()[0]).toMatchObject({ state: 'ready', usedByOperationId: null });
  expect(state.operations()[0].state).toBe('rolled_back');
});

it('notifies receipt watchers only after commit without creating history through SDK events again', async () => {
  const state = harness();
  const emit = jest.fn(async () => {
    expect(state.rows()[0].state).toBe('inflight');
    expect(state.operations()[0].state).toBe('pending');
    expect(state.history()).toHaveLength(1);
  });
  const cleanup = await LocalSendEventsPlugin.onInit!({ services: { eventBus: { emit } } } as any);
  try {
    await createOfflineEcash('https://mint.test', 4, 'local', state.repositories);
    expect(emit.mock.calls.map((args: any[]) => args[0])).toEqual([
      'proofs:state-changed',
      'send:created',
    ]);
    expect(state.history()).toHaveLength(1);
  } finally {
    if (typeof cleanup === 'function') await cleanup();
  }
});

it('does not notify watchers on rollback or fail a committed send when a watcher rejects', async () => {
  const state = harness();
  const emit = jest.fn().mockRejectedValue(new Error('watcher unavailable'));
  const cleanup = await LocalSendEventsPlugin.onInit!({ services: { eventBus: { emit } } } as any);
  try {
    await expect(
      createOfflineEcash('https://mint.test', 3, 'no-change', state.repositories),
    ).rejects.toThrow();
    expect(emit).not.toHaveBeenCalled();
    await expect(
      createOfflineEcash('https://mint.test', 4, 'local', state.repositories),
    ).resolves.toMatchObject({ id: 'local' });
    expect(emit).toHaveBeenCalledTimes(2);
  } finally {
    if (typeof cleanup === 'function') await cleanup();
  }
});
