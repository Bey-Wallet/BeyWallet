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
  const payment = new LightningPayment('https://mint.example', 'invoice', async () => manager);
  return { payment, quotes, operation };
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
  await Promise.resolve();
  await payment.dispose();
  complete({ id: 'stale', state: 'prepared' });
  await expect(result).rejects.toThrow('changed');
  expect(quotes.rollbackMelt).toHaveBeenCalledWith('stale');
});
