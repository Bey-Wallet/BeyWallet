import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { RecoverFundsScreen } from '~/features/settings/RecoverFundsScreen';
import {
  holdRecoveryPause,
  releaseRecoveryPause,
  updateRecoverySession,
  useRecoverySessionStore,
} from '~/state/recoverySessionStore';
import { recoveryCoordinator } from '~/services/wallet/recoveryCoordinator';
const mockRecover = jest.fn();
const mockAuth = jest.fn();
const mockReplace = jest.fn();
const mockGuard = jest.fn();
let mockOffline = false;
let mockParams: { mintUrl?: string } = {};
const mockWallet = {
  mints: [
    { mintUrl: 'https://a.test', nickname: 'Mint A', trusted: true },
    { mintUrl: 'https://b.test', trusted: true },
  ],
  activeMintUrl: 'https://a.test',
  isRestoring: false,
  mintRestoreStatuses: [] as any[],
  restoringMintKeysetProgress: null as any,
  restoringMintUrl: null as string | null,
  balances: { 'https://a.test': 100 },
  recoverSelectedMints: mockRecover,
};
jest.mock('~/storage/sqlite/sqliteStorage', () => ({
  sqliteStorage: { getItem: () => null, setItem: jest.fn() },
}));
jest.mock('~/state/walletStore', () => ({
  useWalletStore: Object.assign((selector: any) => selector(mockWallet), {
    getState: () => mockWallet,
  }),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@react-navigation/native', () => ({
  usePreventRemove: (...args: any[]) => mockGuard(...args),
}));
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));
jest.mock('~/services/platform/seedService', () => ({
  seedService: {
    getMnemonic: async () => 'fixture',
    getNostrKeys: async () => ({ pubkey: 'public-id' }),
  },
}));
jest.mock('~/services/platform/biometricService', () => ({
  biometricService: { authenticateAsync: () => mockAuth() },
}));
jest.mock('~/services/wallet/recoveryDiscovery', () => ({ retryRecoveryDiscovery: jest.fn() }));
jest.mock('~/shared/hooks/useOfflineStatus', () => ({ useOfflineStatus: () => mockOffline }));
jest.mock('@tamagui/lucide-icons', () => ({ Landmark: 'Landmark', ScanSearch: 'ScanSearch' }));
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'Button' }));
jest.mock('~/shared/ui/Spinner', () => ({ Spinner: 'Spinner' }));
jest.mock('tamagui', () => ({ XStack: 'XStack', YStack: 'YStack', Text: 'Text' }));
jest.mock('~/features/settings/components/SettingsLayout', () => ({
  SettingsPage: 'Page',
  SettingsGroup: 'Group',
  SettingsRow: 'Row',
  SettingsMessage: 'Message',
  SettingsDescription: 'Description',
}));
let tree: ReactTestRenderer;
const button = (label: string) =>
  tree.root.findAllByType('Button' as any).find((b) => b.props.children === label)!;
const open = async () => {
  await act(async () => {
    tree = create(<RecoverFundsScreen />);
  });
};
beforeEach(() => {
  jest.clearAllMocks();
  mockOffline = false;
  mockParams = {};
  mockWallet.isRestoring = false;
  mockAuth.mockResolvedValue(true);
  useRecoverySessionStore.setState({
    session: {
      walletId: 'public-id',
      origin: 'import',
      phase: 'review',
      needsReview: true,
      results: [],
      candidates: mockWallet.mints.map((m) => ({ mintUrl: m.mintUrl, sources: ['File backup'] })),
      selected: mockWallet.mints.map((m) => m.mintUrl),
    },
  });
});
afterEach(async () => {
  await act(async () => tree?.unmount());
  releaseRecoveryPause();
});

it('opens review with all candidates checked, supports deselection and disables an empty selection', async () => {
  await open();
  expect(mockRecover).not.toHaveBeenCalled();
  expect(
    tree.root
      .findAllByType('Row' as any)
      .every((r) => r.props.selected && r.props.selectionRole === 'checkbox'),
  ).toBe(true);
  await act(async () => tree.root.findAllByType('Row' as any)[1].props.onPress());
  expect(useRecoverySessionStore.getState().session?.selected).toEqual(['https://a.test']);
  await act(async () => button('Select all').props.onPress());
  await act(async () => button('Deselect all').props.onPress());
  expect(button('Recover selected mints').props.disabled).toBe(true);
  await act(async () => button('Recover selected mints').props.onPress());
  expect(mockAuth).not.toHaveBeenCalled();
});

it('Skip releases the review pause and acknowledges without scanning or changing funds', async () => {
  holdRecoveryPause();
  await open();
  await act(async () => button('Skip for now').props.onPress());
  expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
  expect(mockRecover).not.toHaveBeenCalled();
  expect(mockWallet.balances['https://a.test']).toBe(100);
  expect(recoveryCoordinator.paused).toBe(false);
  expect(useRecoverySessionStore.getState().session?.needsReview).toBe(false);
});

it('authenticates once on duplicate presses and guards the whole pending action', async () => {
  let finish!: () => void;
  mockRecover.mockReturnValueOnce(
    new Promise<void>((resolve) => {
      finish = resolve;
    }),
  );
  await open();
  await act(async () => {
    button('Recover selected mints').props.onPress();
    button('Recover selected mints').props.onPress();
  });
  expect(mockAuth).toHaveBeenCalledTimes(1);
  expect(mockRecover).toHaveBeenCalledWith(['https://a.test', 'https://b.test']);
  expect(mockGuard).toHaveBeenLastCalledWith(true, expect.any(Function));
  await act(async () => finish());
  expect(mockGuard).toHaveBeenLastCalledWith(false, expect.any(Function));
});

it('requires connectivity and honors authentication cancellation', async () => {
  mockOffline = true;
  await open();
  expect(button('Recover selected mints').props.disabled).toBe(true);
  await act(async () => button('Recover selected mints').props.onPress());
  expect(mockAuth).not.toHaveBeenCalled();
  mockOffline = false;
  mockAuth.mockResolvedValueOnce(false);
  await act(async () => tree.update(<RecoverFundsScreen />));
  await act(async () => button('Recover selected mints').props.onPress());
  expect(mockRecover).not.toHaveBeenCalled();
});

it('labels current balances accurately and retries only incomplete results', async () => {
  updateRecoverySession({
    phase: 'results',
    results: [
      { mintUrl: 'https://a.test', status: 'done', balance: 100 },
      { mintUrl: 'https://b.test', status: 'partial', balance: 12 },
    ],
  });
  await open();
  expect(JSON.stringify(tree.toJSON())).toContain('Current balance: ');
  await act(async () => button('Retry incomplete mints').props.onPress());
  expect(mockRecover).toHaveBeenCalledWith(['https://b.test']);
});

it('manual Settings entry preselects the active trusted mint', async () => {
  useRecoverySessionStore.setState({ session: null });
  await open();
  expect(useRecoverySessionStore.getState().session).toMatchObject({
    origin: 'manual',
    selected: ['https://a.test'],
  });
});

it('preselects an explicitly requested trusted mint over the active mint', async () => {
  useRecoverySessionStore.setState({ session: null });
  mockParams = { mintUrl: 'https://b.test/' };
  await open();
  expect(useRecoverySessionStore.getState().session?.selected).toEqual(['https://b.test']);
});
