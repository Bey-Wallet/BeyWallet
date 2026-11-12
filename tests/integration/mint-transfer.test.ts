import { MintTransferService, TRANSFER_WAIT_MS } from '~/services/wallet/mintTransferService';
import { ExpoHistoryRepository } from '~/storage/sqlite/repositories/HistoryRepository';
import { MIGRATIONS } from '~/storage/sqlite/schema';
import { filterHistory, defaultHistoryFilters } from '~/features/history/historyList';
import { publishWalletFeedback } from '~/services/feedback/feedbackCoordinator';

jest.mock('~/services/feedback/feedbackCoordinator', () => ({
  publishWalletFeedback: jest.fn(async () => {}),
}));

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
let destinationReceiptSaved: boolean;
let history: ExpoHistoryRepository;

beforeEach(() => {
  jest.clearAllMocks();
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
  destinationReceiptSaved = true;
  repositories = {
    db,
    historyRepository: history,
    proofRepository: { getAvailableProofs: jest.fn(async () => [{ amount: 200 }]) },
    mintQuoteRepository: {
      getMintQuote: jest.fn(async () => {
        if (quoteState === 'ISSUED' && destinationReceiptSaved) {
          await db.run(
            "UPDATE coco_cashu_history SET state = 'ISSUED' WHERE mintUrl = ? AND quoteId = ?",
            [target, 'mint-quote'],
          );
        }
        return {
          state: quoteState,
          request: 'lnbc-fixture',
          quote: 'mint-quote',
          mintUrl: target,
          amount: 100,
          unit: 'sat',
        };
      }),
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

it('repairs a saved failure once the original source payment and destination issuance complete', async () => {
  const review = await service.prepare(source, target, 100);
  manager.quotes.executeMelt.mockImplementation(async () => {
    operation.state = 'rolled_back';
    throw new Error('Initial failure');
  });
  expect((await service.execute(review.id)).state).toBe('failed');
  const original = (await history.getPaginatedHistoryEntries(10, 0))[0];
  expect(original).toMatchObject({ state: 'failed' });
  operation.state = 'finalized';
  quoteState = 'ISSUED';
  expect((await service.refresh(review.id)).state).toBe('completed');
  const repaired = await history.getHistoryEntryById(original.id);
  expect(repaired).toMatchObject({ state: 'PAID' });
  expect(repaired?.id).toBe(original.id);
  await service.refresh(review.id);
  expect(publishWalletFeedback).toHaveBeenCalledTimes(1);
  expect(manager.quotes.executeMelt).toHaveBeenCalledTimes(1);
  expect(manager.quotes.rollbackMelt).not.toHaveBeenCalled();
});

it.each(['PAID', 'ISSUED'])(
  'shows the destination %s outcome despite stale source rollback without submitting again',
  async (destinationState) => {
    const review = await service.prepare(source, target, 100);
    quoteState = destinationState;
    manager.quotes.executeMelt.mockImplementation(async () => {
      operation.state = 'rolled_back';
      throw new Error('Conflicting source result');
    });
    const expected = destinationState === 'ISSUED' ? 'completed' : 'committed';
    expect((await service.execute(review.id)).state).toBe(expected);
    expect((await service.refresh(review.id)).state).toBe(expected);
    expect((await history.getPaginatedHistoryEntries(10, 0))[0]).toMatchObject({
      state: destinationState === 'ISSUED' ? 'PAID' : 'PENDING',
    });
    await service.execute(review.id);
    expect(manager.quotes.executeMelt).toHaveBeenCalledTimes(1);
    expect(manager.quotes.rollbackMelt).not.toHaveBeenCalled();
    if (destinationState === 'PAID') {
      expect(manager.quotes.requeuePaidMintQuotes).toHaveBeenCalledWith(target);
    }
  },
);

it('keeps missing destination evidence pending rather than declaring failure', async () => {
  const review = await service.prepare(source, target, 100);
  repositories.mintQuoteRepository.getMintQuote.mockResolvedValue(null);
  manager.quotes.executeMelt.mockImplementation(async () => {
    operation.state = 'rolled_back';
    throw new Error('Source rollback');
  });
  expect((await service.execute(review.id)).state).toBe('committed');
});

it('does not let a conflicting unpaid source check roll back a pending payment after destination issuance', async () => {
  const review = await service.prepare(source, target, 100);
  quoteState = 'ISSUED';
  manager.walletService = {
    getWallet: async () => ({ checkMeltQuoteBolt11: async () => ({ state: 'UNPAID' }) }),
  };
  manager.quotes.checkPendingMelt.mockImplementation(async () => {
    operation.state = 'rolled_back';
  });
  expect((await service.execute(review.id)).state).toBe('completed');
  expect(operation.state).toBe('pending');
  expect(manager.quotes.checkPendingMelt).not.toHaveBeenCalled();
  expect(manager.quotes.rollbackMelt).not.toHaveBeenCalled();
});

it('lets Coco finalize a pending source while the paid destination awaits issuance', async () => {
  const review = await service.prepare(source, target, 100);
  quoteState = 'PAID';
  manager.walletService = {
    getWallet: async () => ({ checkMeltQuoteBolt11: async () => ({ state: 'PAID' }) }),
  };
  manager.quotes.checkPendingMelt.mockImplementation(async () => {
    operation.state = 'finalized';
  });
  expect((await service.execute(review.id)).state).toBe('committed');
  expect(manager.quotes.checkPendingMelt).toHaveBeenCalledTimes(1);
  expect(manager.quotes.executeMelt).toHaveBeenCalledTimes(1);
  expect(manager.quotes.rollbackMelt).not.toHaveBeenCalled();
});

it('does not complete an issued quote before its issuance receipt is saved', async () => {
  const review = await service.prepare(source, target, 100);
  quoteState = 'ISSUED';
  destinationReceiptSaved = false;
  manager.quotes.executeMelt.mockImplementation(async () => {
    operation.state = 'finalized';
    return operation;
  });
  expect((await service.execute(review.id)).state).toBe('committed');
  expect((await history.getPaginatedHistoryEntries(10, 0))[0]).toMatchObject({ state: 'PENDING' });
});

it.each([
  ['amount', 101],
  ['unit', 'usd'],
  ['quoteId', 'another-quote'],
  ['mintUrl', source],
])('does not complete from an issuance receipt with mismatched %s', async (field, value) => {
  const review = await service.prepare(source, target, 100);
  quoteState = 'ISSUED';
  jest.spyOn(history, 'getMintHistoryEntry').mockResolvedValue({
    type: 'mint',
    mintUrl: target,
    quoteId: review.mintQuoteId,
    state: 'ISSUED',
    amount: 100,
    unit: 'sat',
    [field]: value,
  } as any);
  expect((await service.execute(review.id)).state).toBe('committed');
  expect(manager.quotes.executeMelt).toHaveBeenCalledTimes(1);
});

it('completes a saved destination issuance even when the source journal cannot be read', async () => {
  const review = await service.prepare(source, target, 100);
  quoteState = 'ISSUED';
  manager.quotes.getMeltOperation.mockRejectedValue(new Error('Source journal unavailable'));
  expect((await service.execute(review.id)).state).toBe('completed');
  expect(manager.quotes.executeMelt).toHaveBeenCalledTimes(1);
  expect(manager.quotes.checkPendingMelt).not.toHaveBeenCalled();
});

it('projects the exact issued destination receipt over a stale failed transfer journal', async () => {
  const review = await service.prepare(source, target, 100);
  manager.quotes.executeMelt.mockImplementation(async () => {
    operation.state = 'rolled_back';
    throw new Error('Stale failure');
  });
  expect((await service.execute(review.id)).state).toBe('failed');
  const original = (await history.getPaginatedHistoryEntries(10, 0))[0];
  await db.run("UPDATE coco_cashu_history SET state = 'ISSUED' WHERE mintUrl = ? AND quoteId = ?", [
    target,
    review.mintQuoteId,
  ]);
  expect(await history.getPaginatedHistoryEntries(10, 0)).toEqual([
    expect.objectContaining({ id: original.id, state: 'PAID' }),
  ]);
  expect((await service.journal.get(review.id))?.state).toBe('failed');
  expect(manager.quotes.executeMelt).toHaveBeenCalledTimes(1);
});

it('does not reopen a confirmed failure because a different destination invoice was paid', async () => {
  const review = await service.prepare(source, target, 100);
  manager.quotes.executeMelt.mockImplementation(async () => {
    operation.state = 'rolled_back';
    throw new Error('No route');
  });
  expect((await service.execute(review.id)).state).toBe('failed');
  await history.addHistoryEntry({
    type: 'mint',
    mintUrl: target,
    amount: 100,
    unit: 'sat',
    quoteId: 'unrelated',
    paymentRequest: 'another-invoice',
    state: 'ISSUED' as any,
    createdAt: Date.now(),
  });
  expect(await service.journal.unfinished()).toEqual([]);
  expect((await service.refresh(review.id)).state).toBe('failed');
  expect(manager.quotes.executeMelt).toHaveBeenCalledTimes(1);
});

it('repairs an old failed history row on restart when later settlement evidence was saved', async () => {
  const review = await service.prepare(source, target, 100);
  manager.quotes.executeMelt.mockImplementation(async () => {
    operation.state = 'rolled_back';
    throw new Error('Initial failure');
  });
  expect((await service.execute(review.id)).state).toBe('failed');
  quoteState = 'ISSUED';
  await db.run("UPDATE coco_cashu_history SET state = 'ISSUED' WHERE mintUrl = ? AND quoteId = ?", [
    target,
    review.mintQuoteId,
  ]);
  service.stop();
  service = new MintTransferService(manager, repositories, () => {});
  service.start();
  await jest.advanceTimersByTimeAsync(0);
  expect((await service.journal.get(review.id))?.state).toBe('completed');
  expect(manager.quotes.executeMelt).toHaveBeenCalledTimes(1);
  expect(manager.quotes.rollbackMelt).not.toHaveBeenCalled();
});

it('keeps a finalized source awaiting issuance pending and never downgrades completion', async () => {
  const review = await service.prepare(source, target, 100);
  manager.quotes.executeMelt.mockImplementation(async () => {
    operation.state = 'finalized';
    return operation;
  });
  quoteState = 'PAID';
  expect((await service.execute(review.id)).state).toBe('committed');
  quoteState = 'ISSUED';
  expect((await service.refresh(review.id)).state).toBe('completed');
  operation.state = 'rolled_back';
  quoteState = 'UNPAID';
  expect((await service.refresh(review.id)).state).toBe('completed');
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
