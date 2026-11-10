import React from 'react';
import { BackHandler } from 'react-native';
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
const mockDismissTo = jest.fn();
const mockGuard = jest.fn();
let mockOffline = false;
let mockLockEnabled = true;
let mockAuthenticated = false;
jest.mock('~/state/settingsStore', () => ({
  useSettingsStore: { getState: () => ({ biometricEnabled: mockLockEnabled }) },
}));
jest.mock('~/state/authStore', () => ({
  useAuthStore: {
    getState: () => ({
      isAuthenticated: mockAuthenticated,
      setAuthenticated: (value: boolean) => {
        mockAuthenticated = value;
      },
    }),
  },
}));
let mockParams: { mintUrl?: string } = {};
const mockWallet = {
  mints: [
    { mintUrl: 'https://a.test', nickname: 'Mint A', trusted: true },
    { mintUrl: 'https://b.test', trusted: true },
  ],
  activeMintUrl: 'https://a.test',
  isRestoring: false,
  mintRestoreStatuses: [] as any[],
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
  useRouter: () => ({ dismissTo: mockDismissTo }),
  useFocusEffect: (effect: any) => require('react').useEffect(effect, [effect]),
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
jest.mock('@tamagui/lucide-icons', () => ({
  ScanSearch: 'ScanSearch',
  CheckCircle2: 'SuccessIcon',
  AlertCircle: 'AlertIcon',
}));
jest.mock('~/shared/ui/AppText', () => ({ AppText: 'AppText' }));
jest.mock('~/shared/ui/AppPressable', () => ({ AppPressable: 'Pressable' }));
jest.mock('~/shared/ui/BUI/BUISelectionControl', () => ({
  BUICheckboxVisual: 'CheckboxVisual',
}));
jest.mock('~/shared/theme', () => ({
  appDimensions: { touchTarget: 48 },
  appSpacing: { page: 16, gap: 12, compact: 8 },
}));
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'Button' }));
jest.mock('~/shared/ui/Spinner', () => ({ Spinner: 'Spinner' }));
jest.mock('~/shared/ui/PaymentInfoHeader', () => ({ PaymentInfoHeader: 'RecoveryHeader' }));
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
const mintRows = () =>
  tree.root
    .findAllByType('Pressable' as any)
    .filter((row) => row.props.accessibilityRole === 'checkbox');
const open = async () => {
  await act(async () => {
    tree = create(<RecoverFundsScreen />);
  });
};
beforeEach(() => {
  jest.clearAllMocks();
  mockOffline = false;
  mockLockEnabled = true;
  mockAuthenticated = false;
  mockParams = {};
  mockWallet.isRestoring = false;
  mockWallet.mintRestoreStatuses = [];
  mockWallet.restoringMintUrl = null;
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

it('shows one spinner and keeps mint selection locked without percentages or progress bars', async () => {
  mockWallet.isRestoring = true;
  mockWallet.restoringMintUrl = 'https://a.test';
  mockWallet.mintRestoreStatuses = [
    { mintUrl: 'https://a.test', status: 'scanning' },
    { mintUrl: 'https://b.test', status: 'pending' },
  ];
  updateRecoverySession({ phase: 'recovering' });
  await open();
  expect(tree.root.findAllByType('Spinner' as any)).toHaveLength(1);
  expect(mintRows()).toHaveLength(2);
  expect(mintRows().every((row) => row.props.disabled)).toBe(true);
  expect(JSON.stringify(tree.toJSON())).toContain('Waiting…');
  expect(tree.root.findAllByProps({ accessibilityRole: 'progressbar' })).toHaveLength(0);
  expect(JSON.stringify(tree.toJSON())).not.toContain('%');
});

it('opens review with all candidates checked, supports deselection and disables an empty selection', async () => {
  await open();
  expect(mockRecover).not.toHaveBeenCalled();
  expect(mintRows().every((r) => r.props.accessibilityState.checked)).toBe(true);
  await act(async () => mintRows()[1].props.onPress());
  expect(useRecoverySessionStore.getState().session?.selected).toEqual(['https://a.test']);
  await act(async () => button('Select all').props.onPress());
  await act(async () => button('Deselect all').props.onPress());
  expect(button('Recover selected mints').props.disabled).toBe(true);
  await act(async () => button('Recover selected mints').props.onPress());
  expect(mockAuth).not.toHaveBeenCalled();
});

it('keeps the spinner visible through the final balance refresh', async () => {
  mockWallet.isRestoring = true;
  mockWallet.restoringMintUrl = 'https://a.test';
  mockWallet.mintRestoreStatuses = [{ mintUrl: 'https://a.test', status: 'done' }];
  updateRecoverySession({ phase: 'recovering' });
  await open();
  expect(JSON.stringify(tree.toJSON())).toContain('Finishing recovery');
  expect(tree.root.findAllByType('Spinner' as any)).toHaveLength(1);
  expect(tree.root.findAllByProps({ accessibilityRole: 'progressbar' })).toHaveLength(0);
  expect(mintRows()).toHaveLength(2);
});

it('Skip releases the review pause and acknowledges without scanning or changing funds', async () => {
  holdRecoveryPause();
  await open();
  await act(async () => button('Skip for now').props.onPress());
  expect(mockDismissTo).toHaveBeenCalledWith('/(tabs)');
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

it('blocks modal dismissal while biometric approval is pending', async () => {
  let approve!: (value: boolean) => void;
  mockAuth.mockReturnValueOnce(
    new Promise<boolean>((resolve) => {
      approve = resolve;
    }),
  );
  await open();
  await act(async () => {
    button('Recover selected mints').props.onPress();
  });
  const header = tree.root.findByType('RecoveryHeader' as any);
  expect(header.props.disabled).toBe(true);
  await act(async () => header.props.onBack());
  expect(mockDismissTo).not.toHaveBeenCalled();
  await act(async () => approve(false));
  expect(mockRecover).not.toHaveBeenCalled();
  await act(async () => tree.root.findByType('RecoveryHeader' as any).props.onBack());
  expect(mockDismissTo).toHaveBeenCalledWith('/(tabs)');
});

it.each(['disabled', 'unlocked'])('does not prompt again when app lock is %s', async (mode) => {
  mockLockEnabled = mode !== 'disabled';
  mockAuthenticated = mode === 'unlocked';
  await open();
  await act(async () => button('Recover selected mints').props.onPress());
  expect(mockAuth).not.toHaveBeenCalled();
  expect(mockRecover).toHaveBeenCalledTimes(1);
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
  expect(mintRows()).toHaveLength(2);
  expect(tree.root.findAllByProps({ accessibilityRole: 'progressbar' })).toHaveLength(0);
  expect(JSON.stringify(tree.toJSON())).toContain('Incomplete');
  expect(tree.root.findAllByType('SuccessIcon' as any)).toHaveLength(1);
  await act(async () => button('Retry incomplete mints').props.onPress());
  expect(mockRecover).toHaveBeenCalledWith(['https://b.test']);
});

it('shows green completion only after all selected mint scans succeed', async () => {
  updateRecoverySession({
    phase: 'results',
    results: mockWallet.mints.map((mint) => ({
      mintUrl: mint.mintUrl,
      status: 'done',
      balance: 100,
    })),
  });
  await open();
  expect(JSON.stringify(tree.toJSON())).toContain('Recovery complete');
  expect(tree.root.findAllByProps({ accessibilityRole: 'progressbar' })).toHaveLength(0);
  expect(tree.root.findAllByType('Spinner' as any)).toHaveLength(0);
  expect(
    tree.root.findAllByType('SuccessIcon' as any).every((icon) => icon.props.color === '$green10'),
  ).toBe(true);
  await act(async () => mintRows()[1].props.onPress());
  expect(useRecoverySessionStore.getState().session?.phase).toBe('review');
  expect(button('Recover selected mints')).toBeDefined();
  expect(mintRows()).toHaveLength(2);
});

it('keeps interrupted recovery unfinished and offers a retry on the same screen', async () => {
  updateRecoverySession({
    phase: 'interrupted',
    results: [{ mintUrl: 'https://a.test', status: 'interrupted', balance: 0 }],
  });
  await open();
  expect(JSON.stringify(tree.toJSON())).not.toContain('Recovery complete');
  expect(tree.root.findAllByType('SuccessIcon' as any)).toHaveLength(0);
  expect(button('Retry incomplete mints')).toBeDefined();
  expect(mintRows()).toHaveLength(2);
});

it('dismisses completed manual recovery to Home', async () => {
  updateRecoverySession({
    origin: 'manual',
    phase: 'results',
    results: mockWallet.mints.map((mint) => ({
      mintUrl: mint.mintUrl,
      status: 'done',
      balance: 0,
    })),
  });
  await open();
  await act(async () => button('Done').props.onPress());
  expect(mockDismissTo).toHaveBeenCalledWith('/(tabs)');
});

it('closes idle recovery from its modal header and Android back, but blocks both while running', async () => {
  const listener = jest.spyOn(BackHandler, 'addEventListener');
  await open();
  expect(tree.root.findByType('RecoveryHeader' as any).props.navigationAction).toBe('close');
  await act(async () => tree.root.findByType('RecoveryHeader' as any).props.onBack());
  expect(mockDismissTo).toHaveBeenCalledWith('/(tabs)');
  mockDismissTo.mockClear();
  const back = listener.mock.calls.at(-1)![1];
  await act(async () => {
    expect(back()).toBe(true);
  });
  expect(mockDismissTo).toHaveBeenCalledTimes(1);
  mockDismissTo.mockClear();
  mockWallet.isRestoring = true;
  await act(async () => tree.update(<RecoverFundsScreen />));
  const header = tree.root.findByType('RecoveryHeader' as any);
  expect(header.props.disabled).toBe(true);
  await act(async () => {
    header.props.onBack();
    listener.mock.calls.at(-1)![1]();
  });
  expect(mockDismissTo).not.toHaveBeenCalled();
  listener.mockRestore();
});

it('keeps errors red and distinguishes a successful empty mint from recovered funds', async () => {
  updateRecoverySession({
    phase: 'results',
    results: [
      { mintUrl: 'https://a.test', status: 'error', balance: 0 },
      { mintUrl: 'https://b.test', status: 'done', balance: 0 },
    ],
  });
  await open();
  expect(tree.root.findByProps({ tone: 'error' }).props.children).toBe('Could not finish');
  expect(JSON.stringify(tree.toJSON())).toContain('No available funds');
  expect(JSON.stringify(tree.toJSON())).not.toContain('Recovery complete');
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
