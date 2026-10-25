import { MintTransferService, TRANSFER_WAIT_MS } from '~/services/wallet/mintTransferService';
import { ExpoHistoryRepository } from '~/storage/sqlite/repositories/HistoryRepository';
import { MIGRATIONS } from '~/storage/sqlite/schema';
import { filterHistory, defaultHistoryFilters } from '~/features/history/historyList';

const { DatabaseSync } = require('node:sqlite');
const source = 'https://source.example';
const target = 'https://target.example';
const capabilities = {
  nuts: {
    '4': { methods: [{ method: 'bolt11', unit: 'sat' }] },
    '5': { methods: [{ method: 'bolt11', unit: 'sat' }] },
  },
};
let raw: any;
let db: any;
let manager: any;
let repositories: any;
let service: MintTransferService;
let operation: any;
let quoteState: string;
let history: ExpoHistoryRepository;

beforeEach(() => {
  jest.useFakeTimers();
  raw = new DatabaseSync(':memory:');
  raw.exec(MIGRATIONS.find((m) => m.id === '003_history')!.sql);
  raw.exec('ALTER TABLE coco_cashu_history ADD COLUMN operationId TEXT');
  raw.exec(MIGRATIONS.find((m) => m.id === '020_mint_transfers')!.sql);
  db = {
    run: async (sql: string, params: unknown[] = []) => {
      const result = raw.prepare(sql).run(...params);
      return { changes: Number(result.changes), lastID: Number(result.lastInsertRowid) };
    },
    get: async (sql: string, params: unknown[] = []) => raw.prepare(sql).get(...params),
    all: async (sql: string, params: unknown[] = []) => raw.prepare(sql).all(...params),
  };
  history = new ExpoHistoryRepository(db);
  operation = {
    id: 'operation',
    quoteId: 'melt-quote',
    mintUrl: source,
    state: 'prepared',
    amount: 100,
    fee_reserve: 2,
    swap_fee: 1,
    methodData: { invoice: 'lnbc-fixture' },
  };
  quoteState = 'UNPAID';
  repositories = {
    db,
    proofRepository: { getAvailableProofs: jest.fn(async () => [{ amount: 200 }]) },
    mintQuoteRepository: {
      getMintQuote: jest.fn(async () => ({ state: quoteState, request: 'lnbc-fixture' })),
    },
    meltQuoteRepository: {
      getMeltQuote: jest.fn(async () => ({
        amount: 100,
        unit: 'sat',
        expiry: Date.now() / 1000 + 300,
      })),
    },
  };
  manager = {
    mint: {
      isTrustedMint: jest.fn(async () => true),
      getMintInfo: jest.fn(async () => capabilities),
    },
    recoverPendingMeltOperations: jest.fn(async () => {}),
    quotes: {
      createMintQuote: jest.fn(async () => {
        await history.addHistoryEntry({
          type: 'mint',
          mintUrl: target,
          amount: 100,
          unit: 'sat',
          quoteId: 'mint-quote',
          paymentRequest: 'lnbc-fixture',
          state: 'UNPAID' as any,
          createdAt: 1,
        });
        return {
          quote: 'mint-quote',
          request: 'lnbc-fixture',
          amount: 100,
          unit: 'sat',
          expiry: Date.now() / 1000 + 300,
        };
      }),
      prepareMeltBolt11: jest.fn(async () => {
        return { ...operation };
      }),
      executeMelt: jest.fn(async () => {
        operation.state = 'pending';
        return { ...operation };
      }),
      getMeltOperation: jest.fn(async () => ({ ...operation })),
      getPreparedMeltOperations: jest.fn(async () =>
        operation.state === 'prepared' ? [{ ...operation }] : [],
      ),
      checkPendingMelt: jest.fn(async () => 'stay_pending'),
      requeuePaidMintQuotes: jest.fn(async () => {}),
      rollbackMelt: jest.fn(async () => {
        operation.state = 'rolled_back';
      }),
    },
  };
  service = new MintTransferService(manager, repositories, () => {});
});

afterEach(() => {
  service.stop();
  jest.useRealTimers();
  raw.close();
});

it('reviews amount plus fees, hides drafts, and discards without submitting', async () => {
  const review = await service.prepare(source + '/', target, 100);
  expect(review.feeReserve).toBe(3);
  expect(await history.getPaginatedHistoryEntries(10, 0)).toEqual([]);
  await service.discard(review.id);
  expect(operation.state).toBe('rolled_back');
  expect(manager.quotes.executeMelt).not.toHaveBeenCalled();
  expect((await service.journal.get(review.id))?.state).toBe('discarded');
});

it('stops quote loading at the deadline and discards a late preparation', async () => {
  let finish!: (value: any) => void;
  const prepare = manager.quotes.prepareMeltBolt11.getMockImplementation();
  manager.quotes.prepareMeltBolt11.mockImplementation(async () => {
    const value = await prepare();
    return new Promise((resolve) => {
      finish = () => resolve(value);
    });
  });
  const result = service.prepare(source, target, 100);
  const rejected = expect(result).rejects.toThrow('in time');
  await jest.advanceTimersByTimeAsync(TRANSFER_WAIT_MS);
  await rejected;
  finish(operation);
  await jest.advanceTimersByTimeAsync(0);
  expect(operation.state).toBe('rolled_back');
  expect(manager.quotes.executeMelt).not.toHaveBeenCalled();
});

it('hands a stalled submitted payment over as pending and never submits it twice', async () => {
  const review = await service.prepare(source, target, 100);
  let finish!: () => void;
  manager.quotes.executeMelt.mockImplementation(() => {
    operation.state = 'executing';
    return new Promise((resolve) => {
      finish = () => {
        operation.state = 'pending';
        resolve(operation);
      };
    });
  });
  const first = service.execute(review.id);
  const second = service.execute(review.id);
  await jest.advanceTimersByTimeAsync(TRANSFER_WAIT_MS);
  expect((await first).state).toBe('committed');
  expect((await second).state).toBe('committed');
  expect(manager.quotes.executeMelt).toHaveBeenCalledTimes(1);
  expect((await history.getPaginatedHistoryEntries(10, 0))[0]).toEqual(
    expect.objectContaining({ state: 'PENDING' }),
  );
  finish();
  await jest.advanceTimersByTimeAsync(0);
  await service.execute(review.id);
  expect(manager.quotes.executeMelt).toHaveBeenCalledTimes(1);
});

it('keeps a lost response pending instead of reporting failure or retrying payment', async () => {
  const review = await service.prepare(source, target, 100);
  manager.quotes.executeMelt.mockImplementation(async () => {
    operation.state = 'executing';
    throw new Error('Lost response');
  });
  expect((await service.execute(review.id)).state).toBe('committed');
  expect(manager.quotes.rollbackMelt).not.toHaveBeenCalled();
});

it('uses one stable history row across issuance, reopening, filters and pagination', async () => {
  const review = await service.prepare(source, target, 100);
  manager.quotes.executeMelt.mockImplementation(async () => {
    operation.state = 'finalized';
    return operation;
  });
  quoteState = 'PAID';
  expect((await service.execute(review.id)).stage).toBe('issuance');
  const pending = await history.getPaginatedHistoryEntries(1, 0);
  expect(pending).toHaveLength(1);
  expect(pending[0]).toEqual(expect.objectContaining({ state: 'PENDING' }));
  expect((pending[0].metadata as any).via).toBe('swap');
  expect(filterHistory(pending, { ...defaultHistoryFilters, mint: target })).toHaveLength(1);
  expect(await history.getPaginatedHistoryEntries(1, 1)).toEqual([]);
  await expect(history.deleteHistoryEntriesByIds([pending[0].id])).rejects.toThrow(
    'pending transfer',
  );
  service.stop();
  service = new MintTransferService(manager, repositories, () => {});
  quoteState = 'ISSUED';
  expect((await service.refresh(review.id)).state).toBe('completed');
  const completed = await history.getHistoryEntryById(pending[0].id);
  expect(completed?.id).toBe(pending[0].id);
  expect(completed).toEqual(expect.objectContaining({ state: 'PAID' }));
  await history.addHistoryEntry({
    type: 'mint',
    mintUrl: target,
    amount: 100,
    unit: 'sat',
    quoteId: 'independent',
    paymentRequest: 'other-invoice',
    state: 'ISSUED' as any,
    createdAt: Date.now() + 1,
  });
  expect((await history.getPaginatedHistoryEntries(1, 0))[0].type).toBe('mint');
  expect((await history.getPaginatedHistoryEntries(1, 1))[0].id).toBe(pending[0].id);
});

it('shows confirmed failures and requires a fresh plan for another attempt', async () => {
  const review = await service.prepare(source, target, 100);
  manager.quotes.executeMelt.mockImplementation(async () => {
    operation.state = 'rolled_back';
    throw new Error('No route');
  });
  expect((await service.execute(review.id)).state).toBe('failed');
  expect((await service.execute(review.id)).state).toBe('failed');
  expect(manager.quotes.executeMelt).toHaveBeenCalledTimes(1);
});

it('rejects untrusted mints, same-mint transfers and fee shortfalls without payment', async () => {
  await expect(service.prepare(source, source + '/', 100)).rejects.toThrow('different');
  manager.mint.isTrustedMint.mockResolvedValueOnce(false);
  await expect(service.prepare(source, target, 100)).rejects.toThrow('trusted');
  repositories.proofRepository.getAvailableProofs.mockResolvedValue([{ amount: 102 }]);
  await expect(service.prepare(source, target, 100)).rejects.toThrow('maximum fee');
  expect(operation.state).toBe('rolled_back');
  expect(manager.quotes.executeMelt).not.toHaveBeenCalled();
});

it('does not pay expired quotes', async () => {
  const review = await service.prepare(source, target, 100);
  await jest.advanceTimersByTimeAsync(301_000);
  await expect(service.execute(review.id)).rejects.toThrow('expired');
  expect(operation.state).toBe('rolled_back');
  expect(manager.quotes.executeMelt).not.toHaveBeenCalled();
});

it('keeps a live review but releases an abandoned preparation after restart', async () => {
  const review = await service.prepare(source, target, 100);
  service.start();
  await jest.advanceTimersByTimeAsync(10_001);
  expect(operation.state).toBe('prepared');
  service.stop();
  service = new MintTransferService(manager, repositories, () => {});
  // Simulate a crash before the source operation ID was journaled.
  await db.run(
    "UPDATE bey_mint_transfers SET state = 'draft', operationId = NULL, meltQuoteId = NULL WHERE id = ?",
    [review.id],
  );
  service.start();
  await jest.advanceTimersByTimeAsync(0);
  expect(operation.state).toBe('rolled_back');
  expect((await service.journal.get(review.id))?.state).toBe('discarded');
  expect(manager.quotes.executeMelt).not.toHaveBeenCalled();
});

it('rejects a mismatched quote rather than paying it', async () => {
  repositories.meltQuoteRepository.getMeltQuote.mockResolvedValue({ amount: 101, unit: 'sat' });
  await expect(service.prepare(source, target, 100)).rejects.toThrow('does not match');
  expect(operation.state).toBe('rolled_back');
  expect(manager.quotes.executeMelt).not.toHaveBeenCalled();
});

it('records the paid fee without delaying success or changing terminal status', async () => {
  const review = await service.prepare(source, target, 100);
  operation.inputAmount = 104;
  operation.needsSwap = false;
  manager.walletService = {
    getWallet: async () => ({
      checkMeltQuoteBolt11: async () => ({ state: 'PAID', amount: 100, change: [{ amount: 3 }] }),
    }),
  };
  manager.quotes.executeMelt.mockImplementation(async () => {
    operation.state = 'finalized';
    return operation;
  });
  quoteState = 'ISSUED';
  expect((await service.execute(review.id)).state).toBe('completed');
  await jest.advanceTimersByTimeAsync(0);
  const saved = await service.journal.get(review.id);
  expect(saved?.feePaid).toBe(1);
  expect(saved?.state).toBe('completed');
});

it('recovers an interrupted source operation after restart without a new payment', async () => {
  const review = await service.prepare(source, target, 100);
  manager.quotes.executeMelt.mockImplementation(async () => {
    operation.state = 'executing';
    throw new Error('Disconnected');
  });
  expect((await service.execute(review.id)).state).toBe('committed');
  service.stop();
  service = new MintTransferService(manager, repositories, () => {});
  manager.recoverPendingMeltOperations.mockImplementation(async () => {
    operation.state = 'finalized';
    quoteState = 'ISSUED';
  });
  service.start();
  await jest.advanceTimersByTimeAsync(0);
  expect(manager.recoverPendingMeltOperations).toHaveBeenCalledTimes(1);
  expect((await service.journal.get(review.id))?.state).toBe('completed');
  expect(manager.quotes.executeMelt).toHaveBeenCalledTimes(1);
});
