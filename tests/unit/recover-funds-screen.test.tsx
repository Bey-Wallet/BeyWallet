import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { RecoverFundsScreen } from '~/features/settings/RecoverFundsScreen';

const mockRecover = jest.fn();
const mockAuth = jest.fn();
const mockPush = jest.fn();
const mockInvalidate = jest.fn();
const mockPreventRemove = jest.fn();
let mockOffline = false;
let mockParams: { mintUrl?: string } = {};
const mockWallet = {
  mints: [
    { mintUrl: 'https://a.test', nickname: 'Mint A', trusted: true },
    { mintUrl: 'https://b.test', nickname: 'Mint B', trusted: true },
    { mintUrl: 'https://untrusted.test', nickname: 'Untrusted', trusted: false },
  ],
  activeMintUrl: 'https://a.test',
  isRestoring: false,
  restoringMintUrl: null as string | null,
  restoringMintKeysetProgress: null as null | { current: number; total: number },
  restoreQueue: [] as string[],
  balances: { 'https://a.test': 100, 'https://b.test': 0 } as Record<string, number>,
  restoreFromSeed: mockRecover,
};
jest.mock('~/state/walletStore', () => ({
  useWalletStore: Object.assign((selector: any) => selector(mockWallet), {
    getState: () => mockWallet,
  }),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
  usePreventRemove: (...args: unknown[]) => mockPreventRemove(...args),
}));
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidate }),
}));
jest.mock('~/services/platform/biometricService', () => ({
  biometricService: { authenticateAsync: (...args: unknown[]) => mockAuth(...args) },
}));
jest.mock('~/shared/hooks/useOfflineStatus', () => ({ useOfflineStatus: () => mockOffline }));
jest.mock('@tamagui/lucide-icons', () => ({
  Landmark: 'Landmark',
  Plus: 'Plus',
  ScanSearch: 'ScanSearch',
}));
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'AppButton' }));
jest.mock('~/features/settings/components/SettingsLayout', () => ({
  SettingsPage: 'Page',
  SettingsGroup: 'Group',
  SettingsRow: 'Row',
  SettingsMessage: 'Message',
  SettingsDescription: 'Description',
}));

async function open() {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<RecoverFundsScreen />);
  });
  return tree;
}
const primary = (tree: ReactTestRenderer) => tree.root.findAllByType('AppButton' as any)[0];
const messages = (tree: ReactTestRenderer) =>
  tree.root
    .findAllByType('Message' as any)
    .map((node) => React.Children.toArray(node.props.children).join(' '))
    .join(' ');
beforeEach(() => {
  jest.clearAllMocks();
  mockOffline = false;
  mockParams = {};
  mockWallet.isRestoring = false;
  mockWallet.restoringMintUrl = null;
  mockWallet.restoringMintKeysetProgress = null;
  mockWallet.restoreQueue = [];
  mockWallet.balances['https://a.test'] = 100;
  mockAuth.mockResolvedValue(true);
  mockRecover.mockResolvedValue('completed');
});

it('authenticates, prevents duplicate scans, shows real progress and refreshes recovered data', async () => {
  let finish!: (value: string) => void;
  mockRecover.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const tree = await open();
  expect(tree.root.findAllByType('Row' as any).some((row) => row.props.title === 'Untrusted')).toBe(
    false,
  );
  await act(async () => {
    primary(tree).props.onPress();
    primary(tree).props.onPress();
  });
  expect(mockAuth).toHaveBeenCalledTimes(1);
  expect(mockRecover).toHaveBeenCalledTimes(1);
  expect(mockRecover).toHaveBeenCalledWith('https://a.test');
  expect(mockPreventRemove).toHaveBeenLastCalledWith(true, expect.any(Function));
  mockWallet.isRestoring = true;
  mockWallet.restoringMintUrl = 'https://a.test';
  mockWallet.restoringMintKeysetProgress = { current: 2, total: 5 };
  await act(async () => tree.update(<RecoverFundsScreen />));
  expect(messages(tree)).toContain('Checking keyset 2 of 5');
  mockWallet.balances['https://a.test'] = 132;
  mockWallet.isRestoring = false;
  await act(async () => finish('completed'));
  expect(messages(tree)).toContain('balance increased by 32 sats');
  expect(mockInvalidate).toHaveBeenCalledWith({ queryKey: ['proofs'] });
  expect(mockPreventRemove).toHaveBeenLastCalledWith(false, expect.any(Function));
  await act(async () => tree.unmount());
});

it('does not scan offline, during another recovery, or after authentication cancellation', async () => {
  mockOffline = true;
  const tree = await open();
  expect(primary(tree).props.disabled).toBe(true);
  await act(async () => primary(tree).props.onPress());
  expect(mockRecover).not.toHaveBeenCalled();
  mockOffline = false;
  mockWallet.isRestoring = true;
  await act(async () => tree.update(<RecoverFundsScreen />));
  await act(async () => primary(tree).props.onPress());
  expect(mockAuth).not.toHaveBeenCalled();
  mockWallet.isRestoring = false;
  mockAuth.mockResolvedValueOnce(false);
  await act(async () => tree.update(<RecoverFundsScreen />));
  await act(async () => primary(tree).props.onPress());
  expect(mockRecover).not.toHaveBeenCalled();
  expect(messages(tree)).toContain('Recovery cancelled');
  await act(async () => tree.unmount());
});

it('scans selected trusted mints sequentially and preserves per-mint failures for retry', async () => {
  mockRecover.mockResolvedValueOnce('failed').mockResolvedValueOnce('completed');
  const tree = await open();
  await act(async () => tree.root.findAllByType('Row' as any)[0].props.onPress());
  await act(async () => primary(tree).props.onPress());
  expect(mockRecover.mock.calls).toEqual([['https://a.test'], ['https://b.test']]);
  expect(messages(tree)).toContain('Scan could not complete');
  expect(messages(tree)).toContain('no additional balance found');
  expect(primary(tree).props.children).toBe('Scan again');
  await act(async () => tree.unmount());
});

it('preselects a mint from its details route and links to connect missing mints', async () => {
  mockParams = { mintUrl: 'https://b.test' };
  const tree = await open();
  expect(
    tree.root.findAllByType('Row' as any).find((row) => row.props.title === 'Mint B')!.props
      .selected,
  ).toBe(true);
  await act(async () => primary(tree).props.onPress());
  expect(mockRecover).toHaveBeenCalledWith('https://b.test');
  tree.root.findAllByType('AppButton' as any)[1].props.onPress();
  expect(mockPush).toHaveBeenCalledWith('/(tabs)/settings/mints');
  await act(async () => tree.unmount());
});

it('does not enqueue work if another recovery starts during authentication', async () => {
  let authorize!: (value: boolean) => void;
  mockAuth.mockReturnValueOnce(
    new Promise((resolve) => {
      authorize = resolve;
    }),
  );
  const tree = await open();
  await act(async () => primary(tree).props.onPress());
  mockWallet.isRestoring = true;
  await act(async () => authorize(true));
  expect(mockRecover).not.toHaveBeenCalled();
  expect(messages(tree)).toContain('Another recovery is already running');
  await act(async () => tree.unmount());
});

it('shows partial recovery as a warning rather than a successful empty scan', async () => {
  mockRecover.mockResolvedValueOnce('partial');
  const tree = await open();
  await act(async () => primary(tree).props.onPress());
  expect(messages(tree)).toContain('Some keysets could not be checked');
  expect(messages(tree)).not.toContain('no additional balance found');
  expect(tree.root.findAllByType('Message' as any).some((message) => message.props.error)).toBe(
    true,
  );
  await act(async () => tree.unmount());
});
