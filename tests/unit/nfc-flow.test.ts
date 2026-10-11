jest.mock('react-native-hce', () => ({
  HCESession: {
    Events: {
      HCE_STATE_READ: 'read',
      HCE_STATE_CONNECTED: 'connected',
      HCE_STATE_DISCONNECTED: 'disconnected',
    },
  },
}));
jest.mock('~/services/platform/nfcService', () => ({
  nfcService: {
    init: jest.fn(async () => true),
    isEnabled: jest.fn(async () => true),
    openPaymentSession: jest.fn(),
    startHceSimulation: jest.fn(),
    stopHceSimulation: jest.fn(async () => {}),
  },
  decodePaymentNdef: () => 'request',
  assertSameNfcPaymentRequest: jest.fn(),
}));
jest.mock('~/shared/utils/paymentInputParser', () => ({ parsePaymentInput: jest.fn() }));
jest.mock('~/services/wallet/paymentRequestModel', () => ({
  parsePaymentRequest: () => ({ raw: 'request', amount: 4, delivery: 'nfc' }),
  isPaymentMintAllowed: () => true,
}));
jest.mock('~/services/wallet/paymentRequestPayment', () => ({
  ...jest.requireActual('~/services/wallet/paymentRequestPayment'),
  previewPaymentRequest: jest.fn(async () => ({
    mintUrl: 'mint',
    amount: 4,
    receiverFee: 1,
    senderFee: 0,
  })),
  PaymentRequestPayment: jest.fn(),
}));
jest.mock('~/services/wallet/lightningPayment', () => ({ LightningPayment: jest.fn() }));
jest.mock('~/services/wallet', () => ({
  walletService: { receive: jest.fn() },
  decodeToken: () => ({ mint: 'mint', proofs: [{ amount: 2 }, { amount: 2 }] }),
}));
jest.mock('~/services/wallet/proofService', () => ({
  proofService: { checkProofStates: jest.fn() },
}));
jest.mock('~/state/walletStore', () => ({
  useWalletStore: {
    getState: () => ({
      activeMintUrl: 'mint',
      mints: [{ mintUrl: 'mint' }],
      refreshBalance: jest.fn(),
    }),
  },
}));
jest.mock('~/services/wallet/initService', () => ({
  initService: {
    getManager: () => ({
      send: {
        checkPendingOperation: jest.fn(async () => {}),
        getOperation: jest.fn(async () => ({ state: 'finalized' })),
      },
    }),
  },
}));

import { Platform } from 'react-native';
import { NfcFlow, nfcFlow } from '~/features/nfc/nfcFlow';
import { redirectNfcIntent } from '~/features/nfc/nativeIntent';
import { nfcService, assertSameNfcPaymentRequest } from '~/services/platform/nfcService';
import { parsePaymentInput } from '~/shared/utils/paymentInputParser';
import { PaymentRequestPayment } from '~/services/wallet/paymentRequestPayment';
import { LightningPayment } from '~/services/wallet/lightningPayment';
import { proofService } from '~/services/wallet/proofService';
import { walletService } from '~/services/wallet';
import { initService } from '~/services/wallet/initService';

const flush = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};
let flow: NfcFlow;
let close: jest.Mock;
let write: jest.Mock;
let deliver: jest.Mock;
let refresh: jest.Mock;
let events: Record<string, () => void>;
beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
  flow = new NfcFlow();
  flow.setReady(true);
  close = jest.fn(async () => {});
  write = jest.fn(async () => {});
  jest
    .mocked(nfcService.openPaymentSession)
    .mockImplementation(() => ({ read: jest.fn(async () => ({ ndefMessage: [] })), close, write }));
  jest.mocked(parsePaymentInput).mockReturnValue({
    matched: true,
    ok: true,
    value: { primary: { type: 'cashu_request', value: 'request' } },
  } as any);
  deliver = jest.fn(async (writer) => {
    await writer('existing-token');
  });
  refresh = jest.fn(async () => false);
  jest
    .mocked(PaymentRequestPayment)
    .mockImplementation(
      (request, cost) =>
        ({ request, cost, operationId: 'op', encoded: 'existing-token', deliver, refresh }) as any,
    );
  events = {};
  jest.mocked(nfcService.startHceSimulation).mockResolvedValue({
    on: (event: string, cb: () => void) => {
      events[event] = cb;
      return jest.fn();
    },
  } as any);
});
afterEach(async () => {
  flow.background();
  await flush();
  jest.useRealTimers();
});

it('automatically pays once and keeps same-session Numo write-back open', async () => {
  flow.openReader();
  flow.openReader();
  await flush();
  expect(deliver).toHaveBeenCalledTimes(1);
  expect(write).toHaveBeenCalledWith('existing-token');
  expect(close).not.toHaveBeenCalled();
  expect(flow.getSnapshot().status).toBe('pending');
  expect(flow.dismiss()).toBe(true);
  await flush();
  expect(close).toHaveBeenCalledTimes(1);
  flow.openReader();
  await flush();
  expect(deliver).toHaveBeenCalledTimes(1);
  expect(refresh).toHaveBeenCalled();
});
it('blocks dismissal during mutation and retains success until Done', async () => {
  let release!: () => void;
  deliver.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  flow.openReader();
  await flush();
  expect(flow.dismiss()).toBe(false);
  release();
  await flush();
  refresh.mockResolvedValue(true);
  await flow.refresh();
  jest.advanceTimersByTime(120000);
  await flush();
  expect(flow.getSnapshot()).toMatchObject({ visible: true, status: 'confirmed' });
  expect(flow.dismiss()).toBe(true);
});
it('retries delivery with the retained controller and verifies the reconnected request', async () => {
  deliver.mockRejectedValueOnce(new Error('contact lost'));
  flow.openReader();
  await flush();
  await flow.retry();
  expect(PaymentRequestPayment).toHaveBeenCalledTimes(1);
  expect(deliver).toHaveBeenCalledTimes(2);
  expect(assertSameNfcPaymentRequest).toHaveBeenCalledWith({ ndefMessage: [] }, 'request');
});
it('lets a waiting reader close and ignores a late tag without paying', async () => {
  let release!: (tag: any) => void;
  jest.mocked(nfcService.openPaymentSession).mockReturnValue({
    read: () =>
      new Promise((resolve) => {
        release = resolve;
      }),
    close,
    write,
  });
  flow.openReader();
  await flush();
  expect(flow.dismiss()).toBe(true);
  await flush();
  release({ ndefMessage: [] });
  await flush();
  expect(deliver).not.toHaveBeenCalled();
  expect(flow.getSnapshot().visible).toBe(false);
});
it('stops on background and never replays a payment on readiness changes', async () => {
  flow.openReader();
  await flush();
  flow.background();
  await flush();
  flow.setReady(false);
  flow.setReady(true);
  await flush();
  expect(close).toHaveBeenCalledTimes(1);
  expect(deliver).toHaveBeenCalledTimes(1);
  expect(flow.getSnapshot().visible).toBe(false);
});
it('submits the existing Lightning flow once and reconciles on reopening', async () => {
  jest.mocked(parsePaymentInput).mockReturnValue({
    matched: true,
    ok: true,
    value: { primary: { type: 'lightning_invoice', value: 'invoice' } },
  } as any);
  const pay = jest.fn(async () => 'pending');
  jest.mocked(LightningPayment).mockImplementation(
    () =>
      ({
        preview: async () => ({ amount: 4, fee_reserve: 1 }),
        pay,
        refresh: async () => 'pending',
        dispose: async () => {},
      }) as any,
  );
  flow.openReader();
  await flush();
  flow.dismiss();
  await flush();
  flow.openReader();
  await flush();
  expect(pay).toHaveBeenCalledTimes(1);
  expect(flow.getSnapshot().status).toBe('pending');
});
it.each([
  { states: [] },
  { states: [{ state: 'SPENT' }] },
  { states: [{ state: 'SPENT' }, { state: 'PENDING' }] },
  { states: [{ state: 'SPENT' }, { state: 'UNSPENT' }] },
])('never confirms incomplete spending $states', async ({ states }) => {
  jest.mocked(proofService.checkProofStates).mockResolvedValue(states as any);
  flow.openSend({ token: 'token', amount: 4, mintUrl: 'mint' });
  await flush();
  events.read();
  await flow.refresh();
  expect(flow.getSnapshot().status).toBe('pending');
});
it('broadcasts the provided token once and confirms all spent proofs', async () => {
  const send = { token: 'token', amount: 4, mintUrl: 'mint', operationId: 'op' };
  flow.openSend(send);
  flow.openSend(send);
  await flush();
  expect(nfcService.startHceSimulation).toHaveBeenCalledTimes(1);
  events.read();
  jest
    .mocked(proofService.checkProofStates)
    .mockResolvedValue([{ state: 'SPENT' }, { state: 'SPENT' }] as any);
  await flow.refresh();
  expect(flow.getSnapshot().status).toBe('confirmed');
  expect(nfcService.stopHceSimulation).toHaveBeenCalledTimes(1);
});
it('times out as unconfirmed and preserves the controller when closed', async () => {
  flow.openReader();
  await flush();
  jest.advanceTimersByTime(60000);
  await flush();
  expect(flow.getSnapshot().status).toBe('unconfirmed');
  flow.dismiss();
  await flush();
  flow.openReader();
  await flush();
  expect(PaymentRequestPayment).toHaveBeenCalledTimes(1);
});
it('queues cold launches behind readiness and preserves warm navigation', async () => {
  const open = jest.spyOn(nfcFlow, 'openReader').mockImplementation(() => {});
  expect(redirectNfcIntent({ path: 'bey-wallet:///(modals)/nfc-receive', initial: true })).toBe(
    '/(tabs)',
  );
  expect(
    redirectNfcIntent({ path: 'bey-wallet:///(modals)/nfc-send?token=old', initial: false }),
  ).toBe('');
  expect(open).toHaveBeenCalledTimes(2);
  open.mockRestore();
  flow.setReady(false);
  flow.openReader();
  await flush();
  expect(deliver).not.toHaveBeenCalled();
  flow.setReady(true);
  await flush();
  expect(deliver).toHaveBeenCalledTimes(1);
});

it('receives tokens through the existing wallet service without a confirmation step', async () => {
  jest.mocked(parsePaymentInput).mockReturnValue({
    matched: true,
    ok: true,
    value: { primary: { type: 'cashu_token', value: 'token' } },
  } as any);
  flow.openReader();
  await flush();
  expect(walletService.receive).toHaveBeenCalledWith('token');
  expect(flow.getSnapshot()).toMatchObject({ status: 'confirmed', visible: true });
});
it('shows disabled and unsupported states without opening native sessions', async () => {
  jest.mocked(nfcService.isEnabled).mockResolvedValueOnce(false);
  flow.openReader();
  await flush();
  expect(flow.getSnapshot().status).toBe('disabled');
  expect(nfcService.openPaymentSession).not.toHaveBeenCalled();
  flow.dismiss();
  await flush();
  jest.mocked(nfcService.init).mockResolvedValueOnce(false);
  flow.openReader();
  await flush();
  expect(flow.getSnapshot().status).toBe('unsupported');
});
it('finishes broadcast cleanup before switching to reader mode', async () => {
  flow.openSend({ token: 'token', amount: 4, mintUrl: 'mint' });
  await flush();
  let release!: () => void;
  jest.mocked(nfcService.stopHceSimulation).mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  flow.dismiss();
  flow.openReader();
  await flush();
  expect(nfcService.openPaymentSession).not.toHaveBeenCalled();
  release();
  await flush();
  expect(nfcService.openPaymentSession).toHaveBeenCalledTimes(1);
});
it('retains an ambiguous mutation after backgrounding and never submits again', async () => {
  let release!: () => void;
  deliver.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  flow.openReader();
  await flush();
  flow.background();
  release();
  await flush();
  expect(flow.getSnapshot()).toMatchObject({
    status: 'unconfirmed',
    visible: false,
    hasPayment: true,
  });
  flow.openReader();
  await flush();
  expect(deliver).toHaveBeenCalledTimes(1);
  expect(refresh).toHaveBeenCalled();
});

it('does not automatically pay the same request again after Done and a new NFC launch', async () => {
  flow.openReader();
  await flush();
  refresh.mockResolvedValue(true);
  await flow.refresh();
  flow.dismiss();
  await flush();
  flow.openReader();
  await flush();
  expect(PaymentRequestPayment).toHaveBeenCalledTimes(1);
  expect(deliver).toHaveBeenCalledTimes(1);
  expect(flow.getSnapshot().status).toBe('confirmed');
});

it('releases the dismissal guard when backgrounding interrupts an HCE transfer', async () => {
  flow.openSend({ token: 'token', amount: 4, mintUrl: 'mint' });
  await flush();
  events.connected();
  expect(flow.dismiss()).toBe(false);
  await flow.background();
  expect(flow.getSnapshot()).toMatchObject({
    visible: false,
    locked: false,
    status: 'unconfirmed',
  });
  flow.openReader();
  await flush();
  expect(nfcService.startHceSimulation).toHaveBeenCalledTimes(1);
});

it('keeps outgoing payment pending until its operation is finalized even if all proofs are spent', async () => {
  flow.openSend({ token: 'token', amount: 4, mintUrl: 'mint', operationId: 'op' });
  await flush();
  events.read();
  jest
    .mocked(proofService.checkProofStates)
    .mockResolvedValue([{ state: 'SPENT' }, { state: 'SPENT' }] as any);
  const manager = jest
    .spyOn(initService, 'getManager')
    .mockReturnValueOnce({
      send: {
        checkPendingOperation: async () => {},
        getOperation: async () => ({ state: 'pending' }),
      },
    } as any);
  await flow.refresh();
  expect(flow.getSnapshot().status).toBe('pending');
  manager.mockRestore();
});
