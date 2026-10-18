import { ChangePreparation } from '~/services/wallet/changePreparationService';
import { ChangeOperationRepository } from '~/storage/sqlite/repositories/ChangeOperationRepository';
import { OutputData, getKeepAmounts, createBlindSignature, pointFromHex } from '@cashu/cashu-ts';
import { Buffer } from 'buffer';

jest.mock('~/storage/sqlite/repositories/ProofRepository', () => ({
  ExpoProofRepository: jest.fn().mockImplementation((db) => db.proofs),
}));

const mint = 'https://mint.test';
const keys = {
  id: '0011223344556677',
  unit: 'sat',
  keys: Object.fromEntries(
    Array.from({ length: 10 }, (_, i) => [
      2 ** i,
      '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
    ]),
  ),
};

function setup() {
  let rows: any[] = [
    {
      id: keys.id,
      mintUrl: mint,
      amount: 32,
      secret: 'synthetic-input',
      C: 'signature',
      state: 'ready',
      usedByOperationId: null,
    },
  ];
  let records = new Map<string, any>();
  let counter = 0;
  let mintOutputs: any[] = [];
  let signatures: any[] = [];
  const proofRepository = {
    getAvailableProofs: jest.fn(async () =>
      rows.filter((p) => p.state === 'ready' && !p.usedByOperationId),
    ),
    getProofsByOperationId: jest.fn(async (_mint, id) =>
      rows.filter((p) => p.usedByOperationId === id),
    ),
    reserveProofs: jest.fn(async (_mint, secrets, id) => {
      for (const secret of secrets) {
        const proof = rows.find((p) => p.secret === secret);
        if (!proof || proof.state !== 'ready' || proof.usedByOperationId)
          throw new Error('Unavailable');
        proof.usedByOperationId = id;
      }
    }),
    releaseProofs: jest.fn(async (_mint, secrets) => {
      rows
        .filter((p) => secrets.includes(p.secret))
        .forEach((p) => {
          p.usedByOperationId = null;
        });
    }),
    saveProofs: jest.fn(async (_mint, proofs) => {
      rows.push(...proofs);
    }),
    setProofState: jest.fn(async (_mint, secrets, state) => {
      rows
        .filter((p) => secrets.includes(p.secret))
        .forEach((p) => {
          p.state = state;
        });
    }),
  };
  const db: any = {
    proofs: proofRepository,
    transaction: async (fn: any) => {
      const snapshot = JSON.stringify(rows),
        ops = new Map(records);
      try {
        return await fn(db);
      } catch (error) {
        rows = JSON.parse(snapshot);
        records = ops;
        throw error;
      }
    },
    get: jest.fn(async (_sql, params) => records.get(params[0]) ?? null),
    all: jest.fn(async (_sql, params) =>
      [...records.values()].filter(
        (r) =>
          ['prepared', 'submitted'].includes(r.state) &&
          (!params?.length || r.mintUrl === params[0]),
      ),
    ),
    run: jest.fn(async (_sql, [id, mintUrl, state, data, createdAt]) => {
      if (
        ['prepared', 'submitted'].includes(state) &&
        [...records.values()].some(
          (op) =>
            op.id !== id && op.mintUrl === mintUrl && ['prepared', 'submitted'].includes(op.state),
        )
      )
        throw new Error('Duplicate mint operation');
      records.set(id, { id, mintUrl, state, data, createdAt });
    }),
  };
  const wallet = {
    getFeesForProofs: jest.fn(() => 1),
    mint: {
      getInfo: jest.fn(async () => ({ nuts: { 9: { supported: true } } })),
      restore: jest.fn(async () => ({ outputs: mintOutputs, signatures })),
    },
    checkProofsStates: jest.fn(async (proofs) => proofs.map(() => ({ state: 'UNSPENT' }))),
    receive: jest.fn(async (_token, _config, outputType) => {
      mintOutputs = outputType.data.map((output: OutputData) => output.blindedMessage);
      const privateKey = new Uint8Array(32);
      privateKey[31] = 1;
      signatures = mintOutputs.map((message) => {
        const signed = createBlindSignature(
          pointFromHex(message.B_),
          privateKey,
          message.amount,
          message.id,
        );
        return { id: message.id, amount: message.amount, C_: signed.C_.toHex(true) };
      });
      return outputType.data.map((output: OutputData, i: number) =>
        output.toProof(signatures[i], keys),
      );
    }),
  };
  const services: any = {
    walletService: { getWalletWithActiveKeysetId: jest.fn(async () => ({ wallet, keys })) },
    proofService: {
      createOutputsAndIncrementCounters: jest.fn(async (_mint, amount) => {
        const keep = OutputData.createDeterministicData(
          amount.keep,
          new Uint8Array(64).fill(1),
          counter,
          keys,
          getKeepAmounts([], amount.keep, keys.keys, 4),
        );
        counter += keep.length;
        return { keep, send: [] };
      }),
    },
    eventBus: { emit: jest.fn(async () => {}) },
  };
  const repositories: any = {
    db,
    proofRepository,
    mintRepository: { isTrustedMint: jest.fn(async () => true) },
    keysetRepository: { getKeysetById: jest.fn(async () => ({ ...keys, keypairs: keys.keys })) },
  };
  const online = jest.fn(async () => {});
  const authorize = jest.fn(() => {});
  return {
    engine: () => new ChangePreparation(repositories, services, online, authorize),
    db,
    wallet,
    services,
    online,
    authorize,
    repositories,
    proofRepository,
    rows: () => rows,
    records: () => records,
    restore: (outputs: any[], sigs: any[]) => {
      mintOutputs = outputs;
      signatures = sigs;
    },
  };
}

it('reserves the full available balance, quotes one fee, and commits one self-swap with no payment history', async () => {
  const h = setup(),
    engine = h.engine();
  const review = await engine.prepare(mint);
  expect(review).toMatchObject({ inputAmount: 32, fee: 1, outputAmount: 31 });
  expect(h.rows()[0]).toMatchObject({ state: 'ready', usedByOperationId: review.id });
  expect(h.wallet.receive).not.toHaveBeenCalled();
  const journal = new ChangeOperationRepository(h.db);
  expect((await journal.get(review.id))!.outputs.keep.length).toBeGreaterThan(1);
  const results = await Promise.all([review.execute(), review.execute()]);
  expect(results[0]).toEqual(results[1]);
  expect(results[0].amount).toBe(31);
  expect(h.wallet.receive).toHaveBeenCalledTimes(1);
  expect(h.rows()[0].state).toBe('spent');
  expect(
    h
      .rows()
      .filter((p) => p.state === 'ready')
      .reduce((sum, p) => sum + p.amount, 0),
  ).toBe(31);
  expect((await journal.get(review.id))!.state).toBe('completed');
  expect(h.services.eventBus.emit.mock.calls.map((args: any[]) => args[0])).toEqual([
    'proofs:saved',
  ]);
});

it('cancels unsubmitted reviews and never releases submitted coins after an ambiguous error', async () => {
  const h = setup(),
    engine = h.engine();
  const canceled = await engine.prepare(mint);
  await canceled.dispose();
  await expect(canceled.execute()).rejects.toThrow('Review');
  expect(h.rows()[0].usedByOperationId).toBeNull();
  const review = await engine.prepare(mint);
  h.wallet.receive.mockRejectedValueOnce(new Error('synthetic bearer data'));
  await expect(review.execute()).rejects.toThrow('unfinished');
  await review.dispose();
  expect(h.rows()[0].usedByOperationId).toBe(review.id);
  expect((await new ChangeOperationRepository(h.db).get(review.id))!.state).toBe('submitted');
});

it('recovers a lost mint response after restart by unblinding the saved outputs without a second swap', async () => {
  const h = setup(),
    engine = h.engine();
  const review = await engine.prepare(mint);
  const receive = h.wallet.receive.getMockImplementation()!;
  h.wallet.receive.mockImplementationOnce(async (...args) => {
    await receive(...args);
    throw new Error('response lost');
  });
  await expect(review.execute()).rejects.toThrow('unfinished');
  const restarted = h.engine();
  await restarted.recoverPending();
  expect(h.wallet.receive).toHaveBeenCalledTimes(1);
  expect((await new ChangeOperationRepository(h.db).get(review.id))!.state).toBe('completed');
  const proofs = h.rows().filter((p) => p.state === 'ready');
  expect(proofs.reduce((sum, p) => sum + p.amount, 0)).toBe(31);
  // Mint blinded signatures must never be saved as spendable proof signatures.
  const restored = await h.wallet.mint.restore();
  expect(proofs[0].C).not.toBe(restored.signatures[0].C_);
});

it('rolls back storage failures and restores the same outputs on retry', async () => {
  const h = setup(),
    review = await h.engine().prepare(mint);
  h.proofRepository.saveProofs.mockRejectedValueOnce(new Error('db unavailable'));
  await expect(review.execute()).rejects.toThrow('unfinished');
  expect(h.rows()).toHaveLength(1);
  expect(h.rows()[0].state).toBe('ready');
  await review.execute();
  expect(h.wallet.receive).toHaveBeenCalledTimes(1);
  expect(h.rows()[0].state).toBe('spent');
});

it('requires another review when fees change and excludes reserved balances', async () => {
  const h = setup(),
    engine = h.engine();
  const review = await engine.prepare(mint);
  expect((await engine.prepare(mint)).id).toBe(review.id);
  h.wallet.getFeesForProofs.mockReturnValue(2);
  await expect(review.execute()).rejects.toThrow('Review again');
  expect(h.wallet.receive).not.toHaveBeenCalled();
  expect(h.rows()[0].usedByOperationId).toBeNull();
  h.rows()[0].usedByOperationId = 'other-payment';
  await expect(engine.prepare(mint)).rejects.toThrow('No available balance');
});

it('releases abandoned prepared operations on restart without making a mint request', async () => {
  const h = setup(),
    review = await h.engine().prepare(mint);
  h.online.mockRejectedValue(new Error('offline'));
  await h.engine().recoverPending();
  expect((await new ChangeOperationRepository(h.db).get(review.id))!.state).toBe('canceled');
  expect(h.rows()[0].usedByOperationId).toBeNull();
  expect(h.wallet.receive).not.toHaveBeenCalled();
});

it.each(['offline', 'untrusted', 'fees', 'restore support'] as const)(
  'blocks unsafe preparation: %s',
  async (reason) => {
    const h = setup();
    if (reason === 'offline') h.online.mockRejectedValueOnce(new Error('offline'));
    if (reason === 'untrusted')
      h.repositories.mintRepository.isTrustedMint.mockResolvedValue(false);
    if (reason === 'fees') h.wallet.getFeesForProofs.mockReturnValue(32);
    if (reason === 'restore support')
      h.wallet.mint.getInfo.mockResolvedValue({ nuts: { 9: { supported: false } } });
    await expect(h.engine().prepare(mint)).rejects.toThrow();
    expect(h.proofRepository.reserveProofs).not.toHaveBeenCalled();
  },
);

it('rejects partial or unrelated restored outputs and retains the operation for recovery', async () => {
  const h = setup(),
    review = await h.engine().prepare(mint);
  h.wallet.receive.mockRejectedValueOnce(new Error('timeout'));
  await expect(review.execute()).rejects.toThrow('unfinished');
  const op = (await new ChangeOperationRepository(h.db).get(review.id))!;
  h.restore([op.outputs.keep[0].blindedMessage], []);
  await expect(review.execute()).rejects.toThrow('unfinished');
  expect(h.rows()).toHaveLength(1);
  expect(h.rows()[0].usedByOperationId).toBe(review.id);
});

it('does not submit a reviewed operation after the wallet locks', async () => {
  const h = setup(),
    review = await h.engine().prepare(mint);
  h.authorize.mockImplementation(() => {
    throw new Error('locked');
  });
  await expect(review.execute()).rejects.toThrow('locked');
  expect(h.wallet.receive).not.toHaveBeenCalled();
  expect((await new ChangeOperationRepository(h.db).get(review.id))!.state).toBe('prepared');
  await review.dispose();
  expect(h.rows()[0].usedByOperationId).toBeNull();
});
