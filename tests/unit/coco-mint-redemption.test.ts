import { MintQuoteProcessor, MintQuoteService } from 'coco-cashu-core';

const mint = 'https://mint.example';
const quoteId = 'synthetic-quote';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => (resolve = done));
  return { promise, resolve };
}

function harness() {
  const quote = { quote: quoteId, amount: 32, state: 'PAID' };
  const outputs = [{ synthetic: 'original-outputs' }];
  const proofs = [{ id: 'keyset', amount: 32, secret: 'synthetic', C: 'synthetic' }];
  const events: string[] = [];
  const repository = {
    getMintQuote: jest.fn(async () => quote),
    setMintQuoteState: jest.fn(async (_mint, _quote, state) => {
      events.push('state-saved');
      quote.state = state;
    }),
  };
  const wallet = { mintProofsBolt11: jest.fn(async () => proofs) };
  const proofService = {
    createOutputsAndIncrementCounters: jest.fn(async () => ({ keep: outputs })),
    saveProofs: jest.fn(async () => {
      events.push('proofs-saved');
    }),
  };
  const bus = {
    emit: jest.fn(async (name: string) => {
      if (name === 'mint-quote:redeemed') events.push('redeemed');
    }),
  };
  const service = new MintQuoteService(
    repository as any,
    { isTrustedMint: async () => true } as any,
    { getWalletWithActiveKeysetId: async () => ({ wallet }) } as any,
    proofService as any,
    bus as any,
  );
  return { service, repository, wallet, proofService, bus, events, outputs, proofs };
}

it('shares issuance between the processor, screen and repeated actions', async () => {
  const h = harness();
  const issued = deferred<typeof h.proofs>();
  h.wallet.mintProofsBolt11.mockReturnValue(issued.promise);
  const attempts = Array.from({ length: 6 }, () => h.service.redeemMintQuote(mint, quoteId));
  await Promise.resolve();
  await Promise.resolve();
  issued.resolve(h.proofs);
  await Promise.all(attempts);
  await h.service.redeemMintQuote(mint, quoteId);
  expect(h.wallet.mintProofsBolt11).toHaveBeenCalledTimes(1);
  expect(h.proofService.createOutputsAndIncrementCounters).toHaveBeenCalledTimes(1);
  expect(h.proofService.saveProofs).toHaveBeenCalledTimes(1);
  expect(h.events).toEqual(['proofs-saved', 'state-saved', 'redeemed']);
});

it('does not announce success while proof persistence is pending', async () => {
  const h = harness();
  const saved = deferred<void>();
  h.proofService.saveProofs.mockImplementation(async () => {
    await saved.promise;
    h.events.push('proofs-saved');
  });
  const attempt = h.service.redeemMintQuote(mint, quoteId);
  for (let i = 0; i < 10; i++) await Promise.resolve();
  expect(h.repository.setMintQuoteState).not.toHaveBeenCalled();
  expect(h.bus.emit).not.toHaveBeenCalledWith('mint-quote:redeemed', expect.anything());
  saved.resolve();
  await attempt;
  expect(h.events).toEqual(['proofs-saved', 'state-saved', 'redeemed']);
});

it('coordinates the real processor handler with a foreground redemption', async () => {
  const h = harness();
  const processor = new MintQuoteProcessor(h.service as any, h.bus as any);
  await Promise.all([
    (processor as any).processItem({ mintUrl: mint, quoteId, quoteType: 'bolt11', retryCount: 0 }),
    h.service.redeemMintQuote(mint, quoteId),
  ]);
  expect(h.wallet.mintProofsBolt11).toHaveBeenCalledTimes(1);
  expect(h.events).toEqual(['proofs-saved', 'state-saved', 'redeemed']);
});

it('retries a failed local save using returned proofs without minting again', async () => {
  const h = harness();
  h.proofService.saveProofs.mockRejectedValueOnce(new Error('Storage unavailable'));
  await expect(h.service.redeemMintQuote(mint, quoteId)).rejects.toThrow('Storage unavailable');
  expect(h.events).toEqual([]);
  await h.service.redeemMintQuote(mint, quoteId);
  expect(h.wallet.mintProofsBolt11).toHaveBeenCalledTimes(1);
  expect(h.proofService.saveProofs).toHaveBeenCalledTimes(2);
  expect(h.events).toEqual(['proofs-saved', 'state-saved', 'redeemed']);
});

it('retries a failed state write without saving the same proofs twice', async () => {
  const h = harness();
  h.repository.setMintQuoteState.mockRejectedValueOnce(new Error('State unavailable'));
  await expect(h.service.redeemMintQuote(mint, quoteId)).rejects.toThrow('State unavailable');
  expect(h.events).toEqual(['proofs-saved']);
  await h.service.redeemMintQuote(mint, quoteId);
  expect(h.wallet.mintProofsBolt11).toHaveBeenCalledTimes(1);
  expect(h.proofService.saveProofs).toHaveBeenCalledTimes(1);
  expect(h.events).toEqual(['proofs-saved', 'state-saved', 'redeemed']);
});

it('keeps ambiguous mint errors unresolved and reuses the original outputs on retry', async () => {
  const h = harness();
  const error = Object.assign(new Error('Synthetic mint rejection'), { code: 20006 });
  h.wallet.mintProofsBolt11.mockRejectedValueOnce(error);
  await expect(h.service.redeemMintQuote(mint, quoteId)).rejects.toBe(error);
  expect(h.events).toEqual([]);
  await h.service.redeemMintQuote(mint, quoteId);
  expect(h.proofService.createOutputsAndIncrementCounters).toHaveBeenCalledTimes(1);
  expect(h.wallet.mintProofsBolt11.mock.calls.map((args: any[]) => args[3].data)).toEqual([
    h.outputs,
    h.outputs,
  ]);
});

it('does not report remotely issued quotes as locally recovered funds', async () => {
  const h = harness();
  h.repository.getMintQuote.mockResolvedValue({ quote: quoteId, amount: 32, state: 'ISSUED' });
  await expect(h.service.redeemMintQuote(mint, quoteId)).rejects.toThrow();
  expect(h.wallet.mintProofsBolt11).not.toHaveBeenCalled();
  expect(h.events).toEqual([]);
});

it('keeps matching quote IDs on different mints independent', async () => {
  const h = harness();
  h.repository.getMintQuote.mockImplementation(async () => ({
    quote: quoteId,
    amount: 32,
    state: 'PAID',
  }));
  await Promise.all([
    h.service.redeemMintQuote(mint, quoteId),
    h.service.redeemMintQuote('https://other.example', quoteId),
  ]);
  expect(h.wallet.mintProofsBolt11).toHaveBeenCalledTimes(2);
});
