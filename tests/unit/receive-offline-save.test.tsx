import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ReceiveModalScreen } from '~/features/payments/receive';

const mockSave = jest.fn();
const mockReceive = jest.fn();
const mockAddMint = jest.fn();
const mockPreview = jest.fn();
const mockOffline = jest.fn(async () => true);
let mockVisibleOffline = true;
jest.mock('~/services/wallet', () => ({
  walletService: { receive: (...args: unknown[]) => mockReceive(...args) },
  mintManager: {},
  historyService: {},
  initService: {
    getRepo: () => ({
      historyRepository: { addHistoryEntry: (...args: unknown[]) => mockSave(...args) },
    }),
  },
}));
jest.mock('~/services/wallet/tokenUtils', () => ({
  decodeToken: () => ({
    mint: 'https://unknown.test',
    amount: 32,
    proofs: [{ amount: 32, secret: 'fixture-only' }],
  }),
}));
jest.mock('~/services/platform/networkService', () => ({
  networkService: { isOffline: () => mockOffline() },
}));
jest.mock('~/shared/hooks/useOfflineStatus', () => ({
  useOfflineStatus: () => mockVisibleOffline,
}));
jest.mock('~/state/walletStore', () => ({
  useWalletStore: (selector: any) =>
    selector({
      mints: [],
      addMint: mockAddMint,
      fetchMintInfo: mockPreview,
      refreshBalance: jest.fn(),
    }),
}));
jest.mock('~/state/settingsStore', () => ({ useSettingsStore: { getState: () => ({}) } }));
jest.mock('@react-navigation/native', () => ({ usePreventRemove: jest.fn() }));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ scannedToken: 'cashu-fixture' }),
  useRouter: () => ({ replace: jest.fn(), back: jest.fn(), canGoBack: () => true }),
  Stack: { Screen: 'Screen' },
}));
jest.mock('tamagui', () => ({ YStack: 'YStack' }));
jest.mock('~/shared/ui/PaymentFlowHeader', () => ({ PaymentFlowHeader: 'PaymentFlowHeader' }));
jest.mock('~/features/payments/receive/InputStage', () => ({ InputStage: 'InputStage' }));
jest.mock('~/features/payments/receive/ConfirmStage', () => ({ ConfirmStage: 'ConfirmStage' }));
jest.mock('~/features/payments/receive/ReceiveResultStage', () => ({
  ReceiveResultStage: 'ResultStage',
}));
jest.mock('~/features/payments/receive/RequestEcashStage', () => ({
  RequestEcashStage: 'RequestStage',
}));
jest.mock('~/shared/ui/ReceiveModeSelector', () => ({ __esModule: true, default: 'Mode' }));
jest.mock('~/shared/ui/OperationFeedback', () => ({ usePendingOperationToast: jest.fn() }));
jest.mock('~/state/nostrRelayStore', () => ({ getNostrRelays: () => [] }));
jest.mock('~/shared/utils/ecashSharing', () => ({}));

beforeEach(() => {
  jest.clearAllMocks();
  mockVisibleOffline = true;
  mockOffline.mockResolvedValue(true);
  mockSave.mockResolvedValue({ id: 'history' });
});
async function open() {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<ReceiveModalScreen />);
  });
  return tree;
}

it('saves once locally without trusting a mint, networking to it, or receiving spendable proofs', async () => {
  const tree = await open();
  const confirm = tree.root.findByType('ConfirmStage' as any).props;
  expect(confirm.offline).toBe(true);
  await act(async () => {
    confirm.onReceiveLater();
    confirm.onReceiveLater();
  });
  expect(mockSave).toHaveBeenCalledTimes(1);
  expect(mockSave).toHaveBeenCalledWith(
    expect.objectContaining({ state: 'unclaimed', amount: 32, mintUrl: 'https://unknown.test' }),
  );
  expect(mockAddMint).not.toHaveBeenCalled();
  expect(mockPreview).not.toHaveBeenCalled();
  expect(mockReceive).not.toHaveBeenCalled();
  const result = tree.root.findByType('ResultStage' as any).props;
  expect(result.status).toBe('success');
  expect(result.isReceiveLater).toBe(true);
  await act(async () => result.onClaimNow());
  expect(mockSave).toHaveBeenCalledTimes(1);
  await act(async () => tree.unmount());
});

it('saves for later if connectivity is lost before an online receive tap executes', async () => {
  mockVisibleOffline = false;
  const tree = await open();
  await act(async () => tree.root.findByType('ConfirmStage' as any).props.onConfirm());
  expect(mockReceive).not.toHaveBeenCalled();
  expect(mockSave).toHaveBeenCalledTimes(1);
  expect(tree.root.findByType('ResultStage' as any).props.isReceiveLater).toBe(true);
  await act(async () => tree.unmount());
});

it('does not show a saved receipt if local persistence fails', async () => {
  mockSave.mockRejectedValueOnce(new Error('Storage unavailable'));
  const tree = await open();
  await act(async () => tree.root.findByType('ConfirmStage' as any).props.onReceiveLater());
  const result = tree.root.findByType('ResultStage' as any).props;
  expect(result.status).toBe('error');
  expect(result.isReceiveLater).toBe(false);
  await act(async () => tree.unmount());
});
