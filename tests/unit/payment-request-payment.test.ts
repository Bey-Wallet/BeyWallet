jest.mock('~/services/platform/seedService', () => ({
  seedService: { getMnemonic: jest.fn(), getNostrKeys: jest.fn() },
}));
jest.mock('~/services/wallet/initService', () => ({
  initService: { getManager: jest.fn(), getRepo: jest.fn() },
}));

import {
  PaymentRequestPayment,
  calculatePaymentRequestCost,
  areAllPaymentProofsSpent,
} from '~/services/wallet/paymentRequestPayment';
import { initService } from '~/services/wallet/initService';
import { seedService } from '~/services/platform/seedService';
import type { ParsedPaymentRequest } from '~/services/wallet/paymentRequestModel';
import type { CoreProof } from 'coco-cashu-core';
import { getEncodedToken, type Token } from '@cashu/cashu-ts';

it('pending, empty, and partial proof states never produce success', () => {
  expect(areAllPaymentProofsSpent([], 1)).toBe(false);
  expect(areAllPaymentProofsSpent([{ state: 'PENDING' }], 1)).toBe(false);
  expect(areAllPaymentProofsSpent([{ state: 'SPENT' }], 2)).toBe(false);
  expect(areAllPaymentProofsSpent([{ state: 'SPENT' }, { state: 'UNSPENT' }], 2)).toBe(false);
  expect(areAllPaymentProofsSpent([{ state: 'SPENT' }], 1)).toBe(true);
});

function harness() {
  const proof = { amount: 4, id: 'keyset', C: 'signature', secret: 'synthetic' } as CoreProof;
  const wallet = {
    selectProofsToSend: jest.fn(() => ({ send: [proof], keep: [] })),
    getFeesForProofs: jest.fn((_proofs: CoreProof[]) => 0),
    getFeesForKeyset: jest.fn(() => 0),
    checkProofsStates: jest.fn(async () => [{ state: 'PENDING' }]),
  };
  const prepareSend = jest.fn(async () => ({ id: 'operation', fee: 0 }));
  const executePreparedSend = jest.fn(async () => ({
    token: { mint: 'https://mint.example', proofs: [proof] },
  }));
  const manager = {
    mint: { isTrustedMint: async () => true },
    walletService: {
      getWalletWithActiveKeysetId: async () => ({
        wallet,
        keys: { keys: { '1': 'key', '2': 'key', '4': 'key' } },
        keysetId: 'keyset',
      }),
      getWallet: async () => wallet,
    },
    wallet: { encodeToken: (_token: Token) => 'synthetic-token' },
    send: {
      prepareSend,
      executePreparedSend,
      rollback: jest.fn(),
      checkPendingOperation: jest.fn(),
      getOperation: async () => ({ state: 'pending' }),
    },
  };
  jest.mocked(initService.getManager).mockReturnValue(manager as any);
  jest
    .mocked(initService.getRepo)
    .mockReturnValue({ proofRepository: { getAvailableProofs: async () => [proof] } } as any);
  const request = {
    raw: 'request',
    amount: 4,
    unit: 'sat',
    mints: ['https://mint.example'],
    mintPolicy: 'strict',
    transports: [],
    singleUse: true,
    delivery: 'nfc',
  } as ParsedPaymentRequest;
  const cost = {
    mintUrl: 'https://mint.example',
    amount: 4,
    grossAmount: 4,
    receiverFee: 0,
    senderFee: 0,
    totalDebit: 4,
  };
  return {
    payment: new PaymentRequestPayment(request, cost),
    prepareSend,
    executePreparedSend,
    wallet,
    proof,
    manager,
  };
}

it('contact loss, double taps and retry deliver the existing token with one operation', async () => {
  const { payment, prepareSend, executePreparedSend } = harness();
  let fail!: () => void;
  const write = jest.fn(
    () =>
      new Promise<void>((_, reject) => {
        fail = () => reject(new Error('contact lost'));
      }),
  );
  const first = payment.deliver(write);
  const assertion = expect(first).rejects.toThrow('contact lost');
  for (let i = 0; i < 20 && !fail; i++) await Promise.resolve();
  await payment.deliver(write);
  fail();
  await assertion;
  await payment.deliver(async () => {});
  expect(prepareSend).toHaveBeenCalledTimes(1);
  expect(executePreparedSend).toHaveBeenCalledTimes(1);
  expect(payment.operationId).toBe('operation');
  expect(await payment.refresh()).toBe(false);
});

it('includes receiver fees in net value and fails insufficient funding before preparation', () => {
  const { wallet, proof } = harness();
  wallet.getFeesForKeyset.mockReturnValue(1);
  wallet.getFeesForProofs.mockReturnValue(1);
  const cost = calculatePaymentRequestCost(
    1,
    'https://mint.example',
    wallet as any,
    [proof],
    { '1': 'key', '2': 'key', '4': 'key' },
    'keyset',
  );
  expect(cost.grossAmount - cost.receiverFee).toBeGreaterThanOrEqual(1);
  expect(cost.totalDebit).toBe(3);
  expect(() =>
    calculatePaymentRequestCost(
      4,
      'https://mint.example',
      wallet as any,
      [proof],
      { '1': 'key', '2': 'key', '4': 'key' },
      'keyset',
    ),
  ).toThrow('funded');
});

it('missing signing keys fail before send preparation', async () => {
  const { payment: original, prepareSend } = harness();
  jest.mocked(seedService.getMnemonic).mockResolvedValue(null);
  const payment = new PaymentRequestPayment(
    { ...original.request, delivery: 'nip17', nostrTarget: '12'.repeat(32) },
    original.cost,
  );
  await expect(payment.deliver()).rejects.toThrow('signing keys');
  expect(prepareSend).not.toHaveBeenCalled();
});

it('a disallowed mint fails before send preparation', async () => {
  const { payment: original, prepareSend } = harness();
  const payment = new PaymentRequestPayment(
    { ...original.request, mints: ['https://other.example'] },
    original.cost,
  );
  await expect(payment.deliver(async () => {})).rejects.toThrow('not accepted');
  expect(prepareSend).not.toHaveBeenCalled();
});

it('an ambiguous send failure cannot create a second operation', async () => {
  const { payment, prepareSend, executePreparedSend } = harness();
  executePreparedSend.mockRejectedValueOnce(new Error('network timeout'));
  await expect(payment.deliver(async () => {})).rejects.toThrow('timeout');
  await expect(payment.deliver(async () => {})).rejects.toThrow('unresolved');
  expect(prepareSend).toHaveBeenCalledTimes(1);
});

it('recognizes finalized operations after a background watcher wins the race', async () => {
  const { payment, wallet, manager } = harness();
  await payment.deliver(async () => {});
  wallet.checkProofsStates.mockResolvedValue([{ state: 'SPENT' }]);
  manager.send.getOperation = async () => ({ state: 'finalized' });
  expect(await payment.refresh()).toBe(true);
  expect(manager.send.checkPendingOperation).not.toHaveBeenCalled();
});

it('retries failed encoding using the existing token without preparing again', async () => {
  const { payment, manager, prepareSend, executePreparedSend } = harness();
  manager.wallet.encodeToken = jest
    .fn()
    .mockImplementationOnce(() => {
      throw new Error('temporary encoder failure');
    })
    .mockReturnValue('synthetic-token');
  const write = jest.fn(async () => {});
  await expect(payment.deliver(write)).rejects.toThrow('encoder failure');
  expect(payment.failureMessage).toContain('Token encoding failed');
  expect(write).not.toHaveBeenCalled();
  await payment.deliver(write);
  expect(write).toHaveBeenCalledWith('synthetic-token');
  expect(prepareSend).toHaveBeenCalledTimes(1);
  expect(executePreparedSend).toHaveBeenCalledTimes(1);
});

it('preserves full keyset IDs when the V4 encoder replaces proofs with short IDs', async () => {
  const { payment, manager, wallet, proof } = harness();
  proof.id = '01' + 'ab'.repeat(32);
  proof.C = '02' + '11'.repeat(32);
  const fullId = proof.id;
  const encode = jest.fn((token: Token) => getEncodedToken(token));
  manager.wallet.encodeToken = encode;
  wallet.getFeesForProofs.mockImplementation((proofs) => {
    if (proofs.some((p) => p.id !== fullId)) throw new Error('No keyset found');
    return 0;
  });
  const write = jest.fn(async () => {});
  await payment.deliver(write);
  expect(write).toHaveBeenCalledWith(expect.stringMatching(/^cashuB/));
  expect(encode.mock.calls[0][0].proofs[0].id).toBe(fullId.slice(0, 16));
  expect(payment.token!.proofs[0]).toBe(proof);
  expect(payment.token!.proofs[0].id).toBe(fullId);
  expect(manager.wallet.encodeToken).toHaveBeenCalledTimes(1);
  expect(await payment.refresh()).toBe(false);
  expect(wallet.checkProofsStates).toHaveBeenCalledWith([proof]);
});

it('retries net verification and never delivers insufficient net value', async () => {
  const { payment, wallet, prepareSend } = harness();
  wallet.getFeesForProofs.mockReturnValueOnce(0).mockReturnValueOnce(1);
  const write = jest.fn(async () => {});
  await expect(payment.deliver(write)).rejects.toThrow('insufficient net');
  expect(write).not.toHaveBeenCalled();
  expect(payment.failureMessage).toContain('net value');
  await payment.deliver(write);
  expect(write).toHaveBeenCalledTimes(1);
  expect(prepareSend).toHaveBeenCalledTimes(1);
});
