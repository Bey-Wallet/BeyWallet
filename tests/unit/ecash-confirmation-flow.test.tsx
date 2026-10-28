import React from 'react';
jest.mock('~/features/settings/hooks/useSettingsBusy', () => ({ useSettingsBusy: jest.fn() }));
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { SendModalScreen } from '~/features/payments/send';
import { prepareEcash, type EcashReview } from '~/services/wallet/ecashPayment';
import { walletService } from '~/services/wallet';
import { getDecodedToken, getEncodedTokenV3 } from '@cashu/cashu-ts';

const mockWallet = {
  activeMintUrl: 'mint-a',
  balance: 100,
  balances: { 'mint-a': 100, 'mint-b': 10 },
  mints: [
    { mintUrl: 'mint-a', trusted: true },
    { mintUrl: 'mint-b', trusted: true },
  ],
  refreshBalance: jest.fn(),
};
const mockParams: { mode?: string } = {};
let mockOffline = false;
let mockNetworkListener: (state: any) => void = () => {};
const mockAvailableProofs = jest.fn();
jest.mock('~/state/walletStore', () => ({
  useWalletStore: (select: (s: typeof mockWallet) => unknown) => select(mockWallet),
}));
jest.mock('~/state/settingsStore', () => ({
  useSettingsStore: () => ({ secondaryCurrency: 'USD' }),
}));
jest.mock('~/services/wallet/ecashPayment', () => ({ prepareEcash: jest.fn() }));
jest.mock('~/services/wallet', () => ({
  walletService: { prepareP2PK: jest.fn(), sendOffline: jest.fn() },
  mintManager: { getMintInfo: async () => ({ nuts: { 11: { supported: true } } }) },
  nostrService: {},
  historyService: { tagHistoryVia: async () => {} },
  initService: {
    getRepo: () => ({ proofRepository: { getAvailableProofs: mockAvailableProofs } }),
  },
  eventService: { on: () => () => {} },
  proofService: { checkProofStates: async () => [] },
}));
jest.mock('~/services/platform/seedService', () => ({ seedService: {} }));
jest.mock('~/services/wallet/paymentRequestModel', () => ({ parsePaymentRequest: jest.fn() }));
jest.mock('~/shared/utils/paymentInputParser', () => ({ parsePaymentInput: jest.fn() }));
jest.mock('~/features/payments/send/AmountStage', () => ({ AmountStage: 'AmountStage' }));
jest.mock('~/features/payments/send/P2PKAmountStage', () => ({
  P2PKAmountStage: 'P2PKAmountStage',
}));
jest.mock('~/features/payments/send/NostrSendStage', () => ({ NostrSendStage: 'NostrSendStage' }));
jest.mock('~/features/payments/send/ConfirmStage', () => ({ ConfirmStage: 'ConfirmStage' }));
jest.mock('~/shared/ui/PaymentFlowHeader', () => ({ PaymentFlowHeader: 'PaymentFlowHeader' }));
jest.mock('~/features/payments/send/ResultStage', () => ({ ResultStage: 'ResultStage' }));
jest.mock('~/features/payments/send/SuccessStage', () => ({ SuccessStage: 'SuccessStage' }));
jest.mock('~/features/payments/send/PaymentRequestStage', () => ({
  PaymentRequestStage: 'PaymentRequestStage',
}));
jest.mock('~/features/payments/send/ScanAndPayStage', () => ({
  ScanAndPayStage: 'ScanAndPayStage',
}));
jest.mock('~/shared/ui/AppIconButton', () => ({ AppIconButton: 'AppIconButton' }));
jest.mock('~/shared/ui/Blockies', () => 'Blockies');
jest.mock('~/shared/ui/SendMethodSelector', () => 'SendMethodSelector');
jest.mock('tamagui', () => ({ Text: 'Text', YStack: 'YStack', H4: 'H4' }));
jest.mock('@tamagui/lucide-icons', () => ({ Cloud: 'Cloud', CloudOff: 'CloudOff' }));
jest.mock('expo-router', () => ({
  useRouter: () => ({}),
  useLocalSearchParams: () => mockParams,
  Stack: { Screen: 'Screen' },
}));
jest.mock('expo-network', () => ({
  addNetworkStateListener: (listener: (state: any) => void) => {
    mockNetworkListener = listener;
    return { remove: jest.fn() };
  },
  getNetworkStateAsync: async () => ({
    isConnected: !mockOffline,
    isInternetReachable: !mockOffline,
  }),
}));
jest.mock('@tamagui/toast', () => ({ useToastController: () => ({ show: jest.fn() }) }));
jest.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: undefined }),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));
jest.mock('~/services/api/bitcoinService', () => ({ bitcoinService: {} }));
jest.mock('nostr-tools', () => ({ nip19: {} }));

const prepare = prepareEcash as jest.Mock;
function review(fee = 0): EcashReview {
  return {
    fee,
    execute: jest.fn().mockResolvedValue({ encoded: 'token', id: 'op' }),
    dispose: jest.fn().mockResolvedValue(undefined),
  };
}
async function open() {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<SendModalScreen />);
  });
  await act(async () => tree.root.findByType('AmountStage' as any).props.setAmount('20'));
  await act(async () => tree.root.findByType('AmountStage' as any).props.onContinue());
  return tree;
}
const confirm = (tree: ReactTestRenderer) => tree.root.findByType('ConfirmStage' as any).props;
beforeEach(() => {
  jest.clearAllMocks();
  delete mockParams.mode;
  mockOffline = false;
  mockAvailableProofs.mockResolvedValue([
    { amount: 20, secret: 'fixture', C: 'signature', id: 'keyset' },
  ]);
});

it('falls back to standard ecash for the removed link send mode', async () => {
  mockParams.mode = 'link';
  prepare.mockResolvedValue(review());
  const tree = await open();
  expect(confirm(tree).sendMode).toBe('standard');
  expect(confirm(tree).ready).toBe(true);
  await act(async () => tree.unmount());
});

it.each([false, true])(
  'attaches the note with no additional payment when offline=%s',
  async (offline) => {
    mockOffline = offline;
    const original = {
      mint: 'https://mint.example',
      unit: 'sat',
      proofs: [
        {
          id: '00' + 'ab'.repeat(7),
          amount: 20,
          secret: 'fixture-note',
          C: '02' + '11'.repeat(32),
        },
      ],
    };
    const encoded = getEncodedTokenV3(original);
    const prepared = review();
    (prepared.execute as jest.Mock).mockResolvedValue({ encoded, id: 'note-op' });
    prepare.mockResolvedValue(prepared);
    jest
      .mocked(walletService.sendOffline)
      .mockResolvedValue({ encoded, id: 'note-op', amount: 20 } as any);
    const tree = await open();
    await act(async () => confirm(tree).onNoteChange('Lunch'));
    expect(confirm(tree).note).toBe('Lunch');
    await act(async () => confirm(tree).onConfirm());
    const result = tree.root.findByType('ResultStage' as any);
    expect(getDecodedToken(result.props.token)).toEqual({
      ...getDecodedToken(encoded),
      memo: 'Lunch',
    });
    if (offline) {
      expect(walletService.sendOffline).toHaveBeenCalledTimes(1);
      expect(prepare).not.toHaveBeenCalled();
    } else {
      expect(prepare).toHaveBeenCalledTimes(1);
      expect(prepared.execute).toHaveBeenCalledTimes(1);
    }
    await act(async () => tree.unmount());
  },
);

it('releases an obsolete review, recalculates for the local mint, and cleans up on back', async () => {
  const first = review(0),
    second = review(2);
  prepare.mockResolvedValueOnce(first).mockResolvedValueOnce(second);
  const tree = await open();
  expect(confirm(tree).estimatedFee).toBe(0);
  expect(confirm(tree).ready).toBe(true);
  await act(async () => confirm(tree).onMintChange('mint-b'));
  expect(first.dispose).toHaveBeenCalledTimes(1);
  expect(prepare).toHaveBeenLastCalledWith('mint-b', 20);
  expect(mockWallet.activeMintUrl).toBe('mint-a');
  expect(confirm(tree).estimatedFee).toBe(2);
  await act(async () => confirm(tree).onBack());
  expect(second.dispose).toHaveBeenCalledTimes(1);
  expect(tree.root.findByType('AmountStage' as any).props.balance).toBe(10);
  await act(async () => tree.unmount());
});

it('discards stale preparation and releases it before preparing the next mint', async () => {
  let resolve!: (value: EcashReview) => void;
  const first = review(9),
    second = review(1);
  prepare
    .mockImplementationOnce(
      () =>
        new Promise<EcashReview>((r) => {
          resolve = r;
        }),
    )
    .mockImplementationOnce(async () => {
      expect(first.dispose).toHaveBeenCalledTimes(1);
      return second;
    });
  const tree = await open();
  await act(async () => confirm(tree).onMintChange('mint-b'));
  expect(confirm(tree).ready).toBe(false);
  expect(confirm(tree).estimatedFee).toBeNull();
  await act(async () => resolve(first));
  expect(confirm(tree).estimatedFee).toBe(1);
  await act(async () => tree.unmount());
  expect(second.dispose).toHaveBeenCalledTimes(1);
});

it('keeps an insufficient-balance review disabled rather than showing a free fee', async () => {
  prepare.mockRejectedValueOnce(new Error('Insufficient balance'));
  const tree = await open();
  expect(confirm(tree).ready).toBe(false);
  expect(confirm(tree).estimatedFee).toBeNull();
  expect(confirm(tree).error).toBe('Insufficient balance');
  await act(async () => tree.unmount());
});

it('blocks replacement when the previous reservation could not be released', async () => {
  const first = review();
  (first.dispose as jest.Mock).mockRejectedValueOnce(new Error('Release failed'));
  prepare.mockResolvedValue(first);
  const tree = await open();
  await act(async () => confirm(tree).onMintChange('mint-b'));
  expect(confirm(tree).ready).toBe(false);
  await act(async () => confirm(tree).onMintChange('mint-a'));
  expect(prepare).toHaveBeenCalledTimes(1);
  expect(confirm(tree).error).toContain('Could not release');
  await act(async () => tree.unmount());
});

it('submits once on rapid taps and carries the prepared creation fee to the result', async () => {
  const prepared = review(2);
  let resolve!: (value: { encoded: string; id: string }) => void;
  (prepared.execute as jest.Mock).mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  prepare.mockResolvedValueOnce(prepared);
  const tree = await open();
  await act(async () => {
    void confirm(tree).onConfirm();
    void confirm(tree).onConfirm();
  });
  expect(prepared.execute).toHaveBeenCalledTimes(1);
  expect(confirm(tree).isLoading).toBe(true);
  await act(async () => resolve({ encoded: 'token', id: 'operation' }));
  expect(tree.root.findByType('ResultStage' as any).props.fee).toBe(2);
  await act(async () => tree.unmount());
});

it('requires a key for the optional standard ecash lock and replaces each obsolete review', async () => {
  const bearer = review(),
    locked = review(2),
    replacement = review(3),
    unlocked = review();
  prepare.mockResolvedValueOnce(bearer).mockResolvedValueOnce(unlocked);
  jest
    .mocked(walletService.prepareP2PK)
    .mockResolvedValueOnce(locked as any)
    .mockResolvedValueOnce(replacement as any);
  const tree = await open();
  expect(confirm(tree).lockEcash).toBe(false);
  await act(async () => confirm(tree).setLockEcash(true));
  expect(bearer.dispose).toHaveBeenCalledTimes(1);
  expect(confirm(tree).ready).toBe(false);
  expect(walletService.prepareP2PK).not.toHaveBeenCalled();
  await act(async () => confirm(tree).setReceiverPubkey('public-key-1'));
  expect(walletService.prepareP2PK).toHaveBeenLastCalledWith(
    'mint-a',
    20,
    'public-key-1',
    undefined,
  );
  expect(confirm(tree).estimatedFee).toBe(2);
  expect(confirm(tree).reclaimSupported).toBe(true);
  await act(async () => confirm(tree).setReceiverPubkey('public-key-2'));
  expect(locked.dispose).toHaveBeenCalledTimes(1);
  expect(confirm(tree).estimatedFee).toBe(3);
  await act(async () => confirm(tree).setLockEcash(false));
  expect(replacement.dispose).toHaveBeenCalledTimes(1);
  expect(confirm(tree).ready).toBe(true);
  expect(confirm(tree).reclaimSupported).toBe(false);
  await act(async () => tree.unmount());
  expect(unlocked.dispose).toHaveBeenCalledTimes(1);
});

it('never falls back to bearer ecash when an enabled lock goes offline', async () => {
  const bearer = review(),
    locked = review(2);
  prepare.mockResolvedValueOnce(bearer);
  jest.mocked(walletService.prepareP2PK).mockResolvedValueOnce(locked as any);
  const tree = await open();
  await act(async () => confirm(tree).setReceiverPubkey('public-key'));
  await act(async () => confirm(tree).setLockEcash(true));
  expect(tree.root.findByType('Screen' as any).props.options.headerRight).toBeUndefined();
  await act(async () => mockNetworkListener({ isConnected: false, isInternetReachable: false }));
  expect(confirm(tree).ready).toBe(false);
  expect(confirm(tree).error).toContain('Go online');
  await act(async () => confirm(tree).onConfirm());
  expect(locked.execute).not.toHaveBeenCalled();
  expect(walletService.sendOffline).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});

it('creates standard ecash from the locked review once and retains its fee', async () => {
  const bearer = review(),
    locked = review(2);
  prepare.mockResolvedValueOnce(bearer);
  jest.mocked(walletService.prepareP2PK).mockResolvedValueOnce(locked as any);
  const tree = await open();
  await act(async () => confirm(tree).setLockEcash(true));
  await act(async () => confirm(tree).setReceiverPubkey('public-key'));
  await act(async () => {
    void confirm(tree).onConfirm();
    void confirm(tree).onConfirm();
  });
  expect(locked.execute).toHaveBeenCalledTimes(1);
  expect(bearer.execute).not.toHaveBeenCalled();
  expect(walletService.sendOffline).not.toHaveBeenCalled();
  expect(tree.root.findByType('ResultStage' as any).props.fee).toBe(2);
  await act(async () => tree.unmount());
});

it('goes straight to confirmation offline and creates the exact entered amount without a selector', async () => {
  mockOffline = true;
  jest
    .mocked(walletService.sendOffline)
    .mockResolvedValueOnce({ encoded: 'offline-token', id: 'offline-operation', token: {} } as any);
  const tree = await open();
  expect(confirm(tree).amount).toBe('20');
  expect(confirm(tree).ready).toBe(true);
  expect(confirm(tree).estimatedFee).toBe(0);
  expect(prepare).not.toHaveBeenCalled();
  await act(async () => confirm(tree).onConfirm());
  expect(walletService.sendOffline).toHaveBeenCalledWith('mint-a', 20);
  const result = tree.root.findByType('ResultStage' as any);
  expect(result.props.amount).toBe('20');
  expect(result.props.token).toBe('offline-token');
  expect(result.props.fee).toBe(0);
  await act(async () => tree.unmount());
});

it('keeps the requested amount unchanged and disables offline creation when exact coins are unavailable', async () => {
  mockOffline = true;
  mockAvailableProofs.mockResolvedValue([{ amount: 32, secret: 'fixture' }]);
  const tree = await open();
  expect(confirm(tree).amount).toBe('20');
  expect(confirm(tree).ready).toBe(false);
  expect(confirm(tree).error).toContain('Go online once to get change');
  await act(async () => confirm(tree).onConfirm());
  expect(walletService.sendOffline).not.toHaveBeenCalled();
  expect(prepare).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});
