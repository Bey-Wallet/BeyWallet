import { LightningAddressService } from '~/services/wallet/lightningAddressService';
import { useLightningAddressStore, lightningAddressDefaults } from '~/state/lightningAddressStore';
import { OutputData, createBlindSignature, pointFromHex } from '@cashu/cashu-ts';

jest.mock('~/storage/sqlite/repositories/ProofRepository', () => ({
  ExpoProofRepository: jest.fn().mockImplementation((db) => db.proofs),
}));
jest.mock('~/storage/sqlite/repositories/HistoryRepository', () => ({
  ExpoHistoryRepository: jest.fn().mockImplementation((db) => db.history),
}));
jest.mock('npubcash-sdk', () => ({}));

const mint = 'https://mint.test';
const provider = 'https://npub.cash';
const legacy = 'https://npubx.cash';
const owner = '79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';
const keys = { id: '0011223344556677', unit: 'sat', keys: { 8: '02' + owner } };
const quote = (quoteId = 'synthetic-quote', paidAt = 100) => ({
  mintUrl: mint,
  quoteId,
  paidAt,
  createdAt: 99,
  expiresAt: 999,
  request: 'synthetic-invoice',
  amount: 8,
  locked: false,
  state: 'PAID',
});

function setup(options: { enabled?: boolean; autoCollect?: boolean } = {}) {
  let records = new Map<string, string>();
  let checkpoints = new Map<string, number>();
  let history: any[] = [];
  let proofs: any[] = [];
  const settings = new Map<string, string>();
  settings.set(
    `lightningAddress:${owner}`,
    JSON.stringify({
      enabled: options.enabled ?? true,
      autoCollect: options.autoCollect ?? true,
      receivingMint: mint,
      lastChecked: 0,
    }),
  );
  const key = (params: any[]) => JSON.stringify(params.slice(0, 3));
  const db: any = {
    get: jest.fn(async (sql, params) =>
      sql.includes('bey_lightning_receipts')
        ? records.has(key(params))
          ? { data: records.get(key(params)) }
          : undefined
        : checkpoints.has(params[1])
          ? { checkpoint: checkpoints.get(params[1]) }
          : undefined,
    ),
    all: jest.fn(async () => [...records.values()].map((data) => ({ data }))),
    run: jest.fn(async (sql, params) => {
      if (sql.includes('bey_lightning_receipts')) records.set(key(params), params[3]);
      else checkpoints.set(params[1], Math.max(checkpoints.get(params[1]) ?? 0, params[2]));
      return { changes: 1 };
    }),
    transaction: async (work: any) => {
      const snapshot = [new Map(records), new Map(checkpoints), [...history], [...proofs]] as const;
      try {
        return await work(db);
      } catch (error) {
        [records, checkpoints, history, proofs] = snapshot as any;
        throw error;
      }
    },
    proofs: {
      saveProofs: jest.fn(async (_mint, received) => {
        proofs.push(...received);
      }),
    },
    history: {
      addHistoryEntry: jest.fn(async (entry) => {
        const saved = { ...entry, id: String(history.length + 1) };
        history.push(saved);
        return saved;
      }),
    },
  };
  let issued: any[] = [];
  let signatures: any[] = [];
  let quoteState = 'PAID';
  const wallet = {
    mint: {
      getInfo: jest.fn(async () => ({
        nuts: {
          4: { disabled: false, methods: [{ method: 'bolt11', unit: 'sat' }] },
          9: { supported: true },
        },
      })),
      checkMintQuoteBolt11: jest.fn(async (id) => ({
        quote: id,
        unit: 'sat',
        amount: 8,
        state: quoteState,
        request: 'synthetic-invoice',
      })),
      restore: jest.fn(async () => ({ outputs: issued, signatures })),
    },
    mintProofsBolt11: jest.fn(async (_amount, _quote, _config, outputType) => {
      const record = [...records.values()]
        .map((data) => JSON.parse(data))
        .find((r) => r.quoteId === _quote.quote);
      expect(record.state).toBe('submitted');
      expect(record.outputs.map((o: any) => o.blindedMessage)).toEqual(
        outputType.data.map((o: any) => o.blindedMessage),
      );
      issued = outputType.data.map((o: OutputData) => o.blindedMessage);
      const sk = new Uint8Array(32);
      sk[31] = 1;
      signatures = issued.map((o) => ({
        id: o.id,
        amount: o.amount,
        C_: createBlindSignature(pointFromHex(o.B_), sk, o.amount, o.id).C_.toHex(true),
      }));
      quoteState = 'ISSUED';
      return outputType.data.map((o: OutputData, i: number) => o.toProof(signatures[i], keys));
    }),
    checkProofsStates: jest.fn(async (items) => items.map(() => ({ state: 'UNSPENT' }))),
  };
  let counter = 0;
  const services: any = {
    walletService: { getWalletWithActiveKeysetId: jest.fn(async () => ({ wallet })) },
    proofService: {
      createOutputsAndIncrementCounters: jest.fn(async () => ({
        keep: OutputData.createDeterministicData(
          8,
          new Uint8Array(64).fill(1),
          counter++,
          keys,
          [8],
        ),
        send: [],
      })),
    },
    eventBus: { emit: jest.fn(async () => {}) },
  };
  const repos: any = {
    db,
    mintRepository: { isTrustedMint: jest.fn(async () => true) },
    keysetRepository: { getKeysetById: jest.fn(async () => ({ ...keys, keypairs: keys.keys })) },
    settingsRepository: {
      getSetting: jest.fn(async (id) => settings.get(id)),
      setSetting: jest.fn(async (id, value) => {
        settings.set(id, value);
      }),
    },
  };
  const clients: any = Object.fromEntries(
    [provider, legacy].map((url) => [
      url,
      {
        getQuotesSince: jest.fn(async () => [quote()]),
        getInfo: jest.fn(async () => ({ mintUrl: mint, lockQuote: true })),
        settings: {
          setMintUrl: jest.fn(async (url) => ({
            error: false,
            data: { user: { mintUrl: url, lockQuote: true } },
          })),
        },
      },
    ]),
  );
  let active = true;
  const create = () =>
    new LightningAddressService(
      repos,
      services,
      owner,
      'synthetic-key',
      (url) => clients[url],
      () => active,
    );
  return {
    create,
    repos,
    db,
    wallet,
    clients,
    services,
    records: () => [...records.values()].map((s) => JSON.parse(s)),
    history: () => history,
    proofs: () => proofs,
    settings,
    checkpoints: () => checkpoints,
    active: (value: boolean) => {
      active = value;
    },
    state: (value: string) => {
      quoteState = value;
    },
  };
}
beforeEach(() => useLightningAddressStore.setState({ ...lightningAddressDefaults }));

it('refuses mints without SAT Lightning minting and recoverable issuance', async () => {
  const h = setup();
  const service = h.create();
  await service.load();
  h.wallet.mint.getInfo.mockResolvedValueOnce({
    nuts: {
      4: { disabled: false, methods: [{ method: 'bolt11', unit: 'sat' }] },
      9: { supported: false },
    },
  });
  await expect(service.setReceivingMint(mint)).rejects.toThrow('recovery support');
  expect(h.clients[provider].settings.setMintUrl).not.toHaveBeenCalled();
});

it('captures later arrivals with an equal timestamp without issuing older receipts twice', async () => {
  const h = setup({ autoCollect: false });
  const service = h.create();
  await service.load();
  await service.sync();
  h.clients[provider].getQuotesSince.mockResolvedValueOnce([quote(), quote('same-second', 100)]);
  await service.sync();
  expect(h.records()).toHaveLength(2);
  expect(h.clients[provider].getQuotesSince).toHaveBeenLastCalledWith(99);
});

it('does not submit issuance when the prepared output journal cannot be saved', async () => {
  const h = setup({ autoCollect: false });
  const service = h.create();
  await service.load();
  await service.sync();
  h.db.run.mockRejectedValueOnce(new Error('disk unavailable'));
  await service.collectAll();
  expect(h.wallet.mintProofsBolt11).not.toHaveBeenCalled();
  expect(h.history()).toHaveLength(0);
  expect(h.proofs()).toHaveLength(0);
});

it('defaults to disabled and requires an explicitly selected, remotely saved receiving mint', async () => {
  const h = setup();
  h.settings.clear();
  const service = h.create();
  await service.load();
  expect(useLightningAddressStore.getState()).toMatchObject({
    loaded: true,
    enabled: false,
    autoCollect: true,
    receivingMint: '',
  });
  await expect(service.enable()).rejects.toThrow('Choose a receiving mint');
  h.clients[provider].settings.setMintUrl.mockRejectedValueOnce(new Error('offline'));
  await expect(service.setReceivingMint(mint)).rejects.toThrow();
  expect(useLightningAddressStore.getState().receivingMint).toBe('');
  await service.setReceivingMint(mint);
  await service.enable();
  expect(useLightningAddressStore.getState()).toMatchObject({ enabled: true, receivingMint: mint });
  expect(h.clients[provider].settings.setMintUrl).toHaveBeenCalledWith(mint);
});

it('persists prepared outputs before issuance and credits exactly once across providers and concurrent requests', async () => {
  const h = setup();
  const service = h.create();
  await service.load();
  await Promise.all([
    service.sync(),
    service.sync(),
    service.collect(mint, quote().quoteId),
    service.sync(legacy),
  ]);
  expect(h.wallet.mintProofsBolt11).toHaveBeenCalledTimes(1);
  expect(h.history()).toHaveLength(1);
  expect(h.proofs()).toHaveLength(1);
  expect(h.records()[0]).toMatchObject({ state: 'completed', providers: [provider, legacy] });
  expect(h.services.eventBus.emit).toHaveBeenCalledWith('history:updated', expect.anything());
  h.history().splice(0); // Visible History deletion must not erase the collection marker.
  await service.sync();
  expect(h.history()).toHaveLength(0);
  expect(h.wallet.mintProofsBolt11).toHaveBeenCalledTimes(1);
});

it('keeps manual receipts pending and collects all on request', async () => {
  const h = setup({ autoCollect: false });
  const service = h.create();
  await service.load();
  await service.sync();
  expect(h.wallet.mintProofsBolt11).not.toHaveBeenCalled();
  expect(useLightningAddressStore.getState().pending).toHaveLength(1);
  await service.collectAll();
  expect(h.history()).toHaveLength(1);
  expect(useLightningAddressStore.getState().pending).toHaveLength(0);
  await service.setAutoCollect(true);
  const reopened = h.create();
  await reopened.load();
  expect(useLightningAddressStore.getState().autoCollect).toBe(true);
});

it('never trusts an unknown mint and preserves locked quotes without disabling their locks', async () => {
  const h = setup();
  const service = h.create();
  await service.load();
  h.repos.mintRepository.isTrustedMint.mockResolvedValue(false);
  await service.sync();
  expect(h.wallet.mintProofsBolt11).not.toHaveBeenCalled();
  expect(h.records()[0].issue).toContain('trust');
  h.repos.mintRepository.isTrustedMint.mockResolvedValue(true);
  h.clients[provider].getQuotesSince.mockResolvedValue([quote('locked')]);
  h.wallet.mint.checkMintQuoteBolt11.mockImplementation(
    async (id) =>
      ({ quote: id, unit: 'sat', amount: 8, state: 'PAID', pubkey: 'different-key' }) as any,
  );
  await service.sync();
  expect(h.records().find((r) => r.quoteId === 'locked').issue).toContain('different key');
  expect(h.wallet.mintProofsBolt11).not.toHaveBeenCalled();
});

it('signs locked quotes with the existing identity and refuses remote ISSUED as local credit', async () => {
  const h = setup();
  const service = h.create();
  await service.load();
  h.state('ISSUED');
  await service.sync();
  expect(h.history()).toHaveLength(0);
  expect(h.wallet.mintProofsBolt11).not.toHaveBeenCalled();
  h.state('PAID');
  h.wallet.mint.checkMintQuoteBolt11.mockResolvedValue({
    quote: quote().quoteId,
    unit: 'sat',
    amount: 8,
    state: 'PAID',
    pubkey: owner,
  } as any);
  await service.collectAll();
  expect(h.wallet.mintProofsBolt11.mock.calls[0][2]).toEqual({ privkey: 'synthetic-key' });
});

it('recovers the exact outputs after issuance succeeds but proof persistence fails', async () => {
  const h = setup();
  const service = h.create();
  await service.load();
  h.db.proofs.saveProofs.mockRejectedValueOnce(new Error('disk unavailable'));
  await service.sync();
  expect(h.history()).toHaveLength(0);
  expect(h.proofs()).toHaveLength(0);
  expect(h.services.eventBus.emit).not.toHaveBeenCalled();
  expect(h.records()[0].state).toBe('submitted');
  const outputs = h.records()[0].outputs;
  await service.dispose();
  const reopened = h.create();
  await reopened.load();
  await reopened.sync();
  expect(h.wallet.mintProofsBolt11).toHaveBeenCalledTimes(1);
  expect(h.services.proofService.createOutputsAndIncrementCounters).toHaveBeenCalledTimes(1);
  expect(h.wallet.mint.restore).toHaveBeenLastCalledWith({
    outputs: outputs.map((o: any) => o.blindedMessage),
  });
  expect(h.proofs()).toHaveLength(1);
  expect(h.history()).toHaveLength(1);
});

it('reuses prepared outputs after an ambiguous issuance error instead of generating new secrets', async () => {
  const h = setup();
  const service = h.create();
  await service.load();
  h.wallet.mintProofsBolt11.mockRejectedValueOnce(new Error('network timeout'));
  await service.sync();
  const outputs = h.records()[0].outputs;
  await service.collectAll();
  expect(h.services.proofService.createOutputsAndIncrementCounters).toHaveBeenCalledTimes(1);
  expect(h.wallet.mintProofsBolt11.mock.calls[1][3].data.map((o: any) => o.blindedMessage)).toEqual(
    outputs.map((o: any) => o.blindedMessage),
  );
  expect(h.history()).toHaveLength(1);
});

it('rejects stale discovery and never advances a checkpoint before receipts are durable', async () => {
  const h = setup({ autoCollect: false });
  const service = h.create();
  await service.load();
  h.clients[provider].getQuotesSince.mockImplementationOnce(async () => {
    service.invalidate();
    return [quote()];
  });
  await expect(service.sync()).rejects.toThrow();
  expect(h.records()).toHaveLength(0);
  const run = h.db.run.getMockImplementation();
  h.db.run.mockImplementationOnce(async () => {
    throw new Error('disk');
  });
  await expect(service.sync()).rejects.toThrow();
  expect(h.checkpoints().get(provider)).toBeUndefined();
  h.db.run.mockImplementation(run);
  await service.sync();
  await service.sync();
  expect(h.clients[provider].getQuotesSince).toHaveBeenLastCalledWith(99);
});

it('disabling preserves receipts and prevents new issuance while submitted work can finish saving', async () => {
  const h = setup({ autoCollect: false });
  const service = h.create();
  await service.load();
  await service.sync();
  await service.disable();
  await service.collectAll();
  expect(h.wallet.mintProofsBolt11).not.toHaveBeenCalled();
  expect(h.records()).toHaveLength(1);
  await service.enable();
  const original = h.wallet.mintProofsBolt11.getMockImplementation()!;
  let disabled: Promise<void> | undefined;
  h.wallet.mintProofsBolt11.mockImplementation(async (...args) => {
    disabled = service.disable();
    return original(...args);
  });
  await service.collectAll();
  await disabled;
  expect(h.history()).toHaveLength(1);
  expect(useLightningAddressStore.getState().enabled).toBe(false);
});
