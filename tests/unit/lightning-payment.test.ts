import type { Manager } from 'coco-cashu-core';
import { LightningPayment } from '~/services/wallet/lightningPayment';

function harness(expiry = Math.floor(Date.now() / 1000) + 60) {
  const operation = {
    id: 'operation',
    quoteId: 'quote',
    amount: 1,
    fee_reserve: 2,
    swap_fee: 0,
    state: 'prepared',
  };
  const quotes = {
    prepareMeltBolt11: jest.fn(async () => operation),
    executeMelt: jest.fn(async () => ({ ...operation, state: 'pending' })),
    rollbackMelt: jest.fn(async () => {}),
    getMeltOperation: jest.fn(async () => operation),
    checkPendingMelt: jest.fn(async () => 'keep'),
  };
  const checkMeltQuoteBolt11 = jest.fn(async () => ({ expiry }));
  const manager = {
    quotes,
    walletService: { getWallet: async () => ({ checkMeltQuoteBolt11 }) },
  } as unknown as Manager;
  const services = {
    walletService: (manager as any).walletService,
    meltOperationService: {
      init: jest.fn(async () => ({ id: 'operation', state: 'init' })),
      prepare: quotes.prepareMeltBolt11,
    },
  } as any;
  const payment = new LightningPayment(
    'https://mint.example',
    'invoice',
    async () => manager,
    () => services,
  );
  return { payment, quotes, operation, manager, services, checkMeltQuoteBolt11 };
}

it('reuses the preview quote and submits once for double taps', async () => {
  const { payment, quotes } = harness();
  await Promise.all([payment.preview(), payment.preview()]);
  expect(await Promise.all([payment.pay(), payment.pay()])).toEqual(['pending', 'pending']);
  expect(quotes.prepareMeltBolt11).toHaveBeenCalledTimes(1);
  expect(quotes.executeMelt).toHaveBeenCalledTimes(1);
});
it('never pays an expired quote', async () => {
  const { payment, quotes } = harness(1);
  await expect(payment.pay()).rejects.toThrow('expired');
  expect(quotes.executeMelt).not.toHaveBeenCalled();
  expect(quotes.rollbackMelt).toHaveBeenCalledWith('operation');
});

it('labels rollback after a failed quote check as a preparation failure, without submitting', async () => {
  const { payment, quotes, checkMeltQuoteBolt11 } = harness();
  checkMeltQuoteBolt11.mockRejectedValueOnce(new Error('offline'));
  await expect(payment.preview()).rejects.toThrow('offline');
  await payment.dispose();
  expect(quotes.rollbackMelt).toHaveBeenCalledWith('operation', 'Bey: preparation failed');
  expect(quotes.executeMelt).not.toHaveBeenCalled();
});
it('reconciles already paid or pending without a replacement quote', async () => {
  const { payment, quotes, operation } = harness();
  quotes.executeMelt.mockRejectedValue(new Error('already paid or pending'));
  quotes.getMeltOperation.mockResolvedValue({ ...operation, state: 'finalized' });
  expect(await payment.pay()).toBe('paid');
  expect(await payment.pay()).toBe('paid');
  expect(quotes.prepareMeltBolt11).toHaveBeenCalledTimes(1);
  expect(quotes.executeMelt).toHaveBeenCalledTimes(1);
});
it('keeps ambiguous network errors unresolved', async () => {
  const { payment, quotes } = harness();
  quotes.executeMelt.mockRejectedValue(new Error('timeout'));
  quotes.getMeltOperation.mockRejectedValue(new Error('offline'));
  expect(await payment.pay()).toBe('unresolved');
  expect(quotes.rollbackMelt).not.toHaveBeenCalled();
});
it('rolls back a stale preview after mint changes, including a late async response', async () => {
  const { payment, quotes } = harness();
  let complete!: (value: any) => void;
  quotes.prepareMeltBolt11.mockImplementation(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  const result = payment.preview();
  for (let i = 0; i < 8; i++) await Promise.resolve();
  const cancellation = payment.dispose();
  quotes.getMeltOperation.mockResolvedValue({ id: 'stale', state: 'prepared' } as any);
  complete({ id: 'stale', state: 'prepared' });
  await expect(result).rejects.toThrow('changed');
  await cancellation;
  expect(quotes.rollbackMelt).toHaveBeenCalledWith('stale');
  expect(quotes.rollbackMelt).toHaveBeenCalledTimes(1);
  expect(payment.canRetry).toBe(true);
});

it('joins duplicate cancellation calls while a quote check finishes and releases the reservation once', async () => {
  const { payment, quotes, checkMeltQuoteBolt11 } = harness();
  let complete!: (quote: any) => void;
  checkMeltQuoteBolt11.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  const preview = payment.preview();
  for (let i = 0; i < 8; i++) await Promise.resolve();
  const first = payment.dispose();
  const second = payment.dispose();
  expect(first).toBe(second);
  expect(payment.canRetry).toBe(false);
  complete({ expiry: Date.now() / 1000 + 60 });
  await preview;
  await first;
  expect(quotes.rollbackMelt).toHaveBeenCalledTimes(1);
  expect(quotes.executeMelt).not.toHaveBeenCalled();
  expect(payment.canRetry).toBe(true);
  await expect(payment.pay()).rejects.toThrow('changed');
});

it('does not submit if cancellation happens while acquiring the manager for submission', async () => {
  const { manager, quotes, services } = harness();
  let resolveManager!: (value: Manager) => void;
  let calls = 0;
  const payment = new LightningPayment(
    'mint',
    'invoice',
    async () => {
      calls++;
      if (calls === 2)
        return new Promise<Manager>((resolve) => {
          resolveManager = resolve;
        });
      return manager;
    },
    () => services,
  );
  await payment.preview();
  const submission = payment.pay();
  for (let i = 0; i < 5; i++) await Promise.resolve();
  await payment.dispose();
  resolveManager(manager);
  await expect(submission).rejects.toThrow('changed');
  expect(quotes.executeMelt).not.toHaveBeenCalled();
  expect(quotes.rollbackMelt).toHaveBeenCalledTimes(1);
});

it('retains a submitted payment and never offers a fresh retry on cancellation', async () => {
  const { payment, quotes, operation } = harness();
  let complete!: (value: any) => void;
  quotes.executeMelt.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  const submission = payment.pay();
  for (let i = 0; i < 15; i++) await Promise.resolve();
  await payment.dispose();
  complete({ ...operation, state: 'pending' });
  await expect(submission).resolves.toBe('pending');
  expect(payment.canRetry).toBe(false);
  expect(quotes.rollbackMelt).not.toHaveBeenCalled();
  await payment.pay();
  expect(quotes.executeMelt).toHaveBeenCalledTimes(1);
});

it('allows retry when failed preparation was cleaned up by Coco', async () => {
  const { payment, quotes } = harness();
  quotes.prepareMeltBolt11.mockRejectedValueOnce(new Error('network interrupted'));
  quotes.getMeltOperation.mockResolvedValue(null as any);
  await expect(payment.preview()).rejects.toThrow('interrupted');
  await payment.dispose();
  expect(quotes.getMeltOperation).toHaveBeenCalledWith('operation');
  expect(payment.canRetry).toBe(true);
  expect(quotes.executeMelt).not.toHaveBeenCalled();
});

it('keeps an init operation unresolved when Coco could not clean up its reservations', async () => {
  const { payment, quotes } = harness();
  quotes.prepareMeltBolt11.mockRejectedValueOnce(new Error('network interrupted'));
  quotes.getMeltOperation.mockResolvedValue({ id: 'operation', state: 'init' } as any);
  await expect(payment.preview()).rejects.toThrow();
  await payment.dispose();
  expect(payment.canRetry).toBe(false);
  quotes.getMeltOperation.mockResolvedValue(null as any);
  await payment.refresh();
  expect(payment.canRetry).toBe(true);
  expect(quotes.executeMelt).not.toHaveBeenCalled();
});

it('refresh retries a failed rollback of the same preparation', async () => {
  const { payment, quotes } = harness();
  await payment.preview();
  quotes.rollbackMelt.mockRejectedValueOnce(new Error('offline'));
  await expect(payment.dispose()).rejects.toThrow('offline');
  expect(payment.canRetry).toBe(false);
  await payment.refresh();
  expect(payment.canRetry).toBe(true);
  expect(quotes.rollbackMelt.mock.calls).toEqual([['operation'], ['operation']]);
  expect(quotes.executeMelt).not.toHaveBeenCalled();
});

it('reports a repeated quote storage conflict without exposing the SDK error or invoice', async () => {
  const { payment, quotes } = harness();
  quotes.prepareMeltBolt11.mockRejectedValueOnce(
    new Error(
      'UNIQUE constraint failed: coco_cashu_melt_operations.mintUrl, coco_cashu_melt_operations.quoteId; private-invoice',
    ),
  );
  await expect(payment.preview()).rejects.toThrow('UNIQUE');
  expect(payment.preparationDiagnostic).toMatchObject({
    stage: 'preparing',
    failure: 'quote_conflict',
  });
  expect(JSON.stringify(payment.preparationDiagnostic)).not.toContain('private-invoice');
  expect(quotes.executeMelt).not.toHaveBeenCalled();
});
