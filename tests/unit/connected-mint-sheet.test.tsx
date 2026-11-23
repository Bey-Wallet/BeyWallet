import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { AppState } from 'react-native';
import { ConnectedMintSheet } from '~/features/mints/components/ConnectedMintSheet';
import { useWalletStore } from '~/state/walletStore';
import { useSettingsStore } from '~/state/settingsStore';
import { useAuthStore } from '~/state/authStore';
import { hapticService } from '~/services/platform/hapticService';

const mockUrl = 'https://mint.example/Bitcoin';
const mockPush = jest.fn();
const mockPresent = jest.fn();
const mockDismiss = jest.fn();
const mockClose = jest.fn();
const mockRemove = jest.fn();
const mockInspect = jest.fn();
const mockDestructiveRemove = jest.fn();
const mockRename = jest.fn();
const mockRefresh = jest.fn();
let mockOffline = false;
let mockFocused = true;
let mockBlock: string | null = null;
let mockInfoError: Error | null = null;
let mockChecking = false;
let mockAppListener: (state: string) => void;
jest.mock('~/state/walletStore', () => ({ useWalletStore: require('zustand').create(() => ({})) }));
jest.mock('~/state/settingsStore', () => ({
  useSettingsStore: require('zustand').create(() => ({})),
}));
jest.mock('~/state/authStore', () => ({ useAuthStore: require('zustand').create(() => ({})) }));
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => mockFocused }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('tamagui', () => ({
  YStack: 'YStack',
  XStack: 'XStack',
  useTheme: () => ({ color: { val: '#fff' }, gray2: { val: '#222' } }),
}));
jest.mock('~/shared/icons', () => ({ Landmark: 'Landmark' }));
jest.mock('@gorhom/bottom-sheet', () => ({ BottomSheetTextInput: 'NameInput' }));
jest.mock('~/shared/ui/BUI/useBUITheme', () => ({ useBUIOverlayAppearance: () => 'dark' }));
jest.mock('~/shared/ui/BUI/BUISheet', () => ({
  BUISheet: require('react').forwardRef((props: any, ref: any) => {
    require('react').useImperativeHandle(ref, () => ({
      present: mockPresent,
      dismiss: mockDismiss,
    }));
    return require('react').createElement('Sheet', props, props.children);
  }),
}));
jest.mock('~/features/mints/components/ConnectedMintSheetView', () => ({
  ConnectedMintSheetView: 'MintView',
}));
jest.mock('~/features/mints/components/MintUrlQrOverlay', () => ({ MintUrlQrOverlay: 'MintQR' }));
jest.mock('~/features/mints/components/MintPreviewMethods', () => ({
  mintPreviewMethods: () => [
    { method: 'bolt11', unit: 'sat', disabled: false },
    { method: 'bolt12', unit: 'sat', disabled: false },
    { method: 'onchain', unit: 'sat', disabled: false },
  ],
}));
jest.mock('~/shared/ui/RemoteImage', () => ({ MintImage: 'MintImage' }));
jest.mock('~/shared/ui/AppText', () => ({ AppText: 'Text' }));
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'Button' }));
jest.mock('~/shared/hooks/useOfflineStatus', () => ({ useOfflineStatus: () => mockOffline }));
jest.mock('~/shared/hooks/useAppToast', () => ({ useAppToast: () => ({ show: jest.fn() }) }));
jest.mock('~/shared/utils/copyWithFeedback', () => ({
  copyWithFeedback: jest.fn(async () => true),
}));
jest.mock('~/services/platform/hapticService', () => ({
  hapticService: { completion: jest.fn(), selection: jest.fn(), acknowledge: jest.fn() },
}));
jest.mock('~/features/settings/hooks/useSettingsBusy', () => ({ useSettingsBusy: jest.fn() }));
jest.mock('~/services/api/bitcoinService', () => ({ bitcoinService: { fetchPrice: jest.fn() } }));
jest.mock('~/shared/hooks/useMintInfo', () => ({
  useMintInfo: () => ({
    data: { name: 'Metadata name', units: ['sat'] },
    isFetching: mockChecking,
    error: mockInfoError,
    refetch: mockRefresh,
  }),
}));
jest.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: any) =>
    queryKey[0] === 'mint-removal'
      ? { data: { [mockUrl]: mockBlock }, isFetching: false, refetch: jest.fn() }
      : { data: { price: 100000 } },
  useQueryClient: () => ({ invalidateQueries: async () => {} }),
}));
jest.mock('~/services/wallet/connectedMintRemoval', () => ({
  inspectConnectedMints: (...args: any[]) => mockInspect(...args),
  removeConnectedMints: (...args: any[]) => mockRemove(...args),
  mintRemovalMessages: {
    funds: 'Transfer funds before removing',
    pending: 'Pending payments or requests',
    unknown: 'Could not verify wallet state',
  },
}));
let tree: ReactTestRenderer;
const props = () => tree.root.findByType('MintView' as any).props;
const removeButton = () =>
  tree.root.findAllByType('Button' as any).find((node) => node.props.children === 'Remove mint')!;
async function render() {
  await act(async () => {
    tree = create(<ConnectedMintSheet mintUrl={mockUrl} onClose={mockClose} />);
  });
}
beforeEach(() => {
  jest.clearAllMocks();
  mockOffline = false;
  mockFocused = true;
  mockBlock = null;
  mockInfoError = null;
  mockChecking = false;
  (AppState as any).currentState = 'active';
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_event: string, callback: any) => {
    mockAppListener = callback;
    return { remove: jest.fn() };
  }) as any);
  useSettingsStore.setState({
    initialized: true,
    biometricEnabled: false,
    hideBalance: false,
    primaryCurrency: 'SATS',
    secondaryCurrency: 'USD',
    showBitcoinSymbol: false,
  });
  useAuthStore.setState({ isAuthenticated: true });
  useWalletStore.setState({
    mints: [{ mintUrl: mockUrl, name: 'Everyday mint', trusted: true }],
    balances: { [mockUrl]: 24000 },
    isRestoring: false,
    error: null,
    refreshMintList: async () => {},
    refreshBalance: async () => {},
    syncMintsToNostr: async () => {},
    setMintNickname: mockRename,
    removeMint: mockDestructiveRemove,
  });
  mockRename.mockImplementation(async (url, name) =>
    useWalletStore.setState({
      mints: [{ mintUrl: url, name: 'Everyday mint', nickname: name, trusted: true }],
    }),
  );
  mockRemove.mockResolvedValue({ removed: [mockUrl], blocked: {} });
  mockInspect.mockImplementation(async (_urls, options) => ({
    [mockUrl]:
      mockBlock ??
      (!options?.allowFunds && useWalletStore.getState().balances[mockUrl] > 0 ? 'funds' : null),
  }));
  mockDestructiveRemove.mockImplementation(async () => useWalletStore.setState({ mints: [] }));
});
afterEach(async () => {
  await act(async () => tree?.unmount());
  jest.restoreAllMocks();
});

it('opens immediately with live balance and advertised methods; respects hidden balances', async () => {
  await render();
  expect(mockPresent).toHaveBeenCalledTimes(1);
  expect(props()).toMatchObject({
    name: 'Everyday mint',
    amount: '24,000',
    unit: 'sat',
    units: 'sat',
    payments: 'Lightning, BOLT 12, On-chain',
  });
  await act(async () => useSettingsStore.setState({ hideBalance: true }));
  expect(props().amount).toBe('****');
  expect(props().secondary).toBeNull();
  expect(props().unit).toBeUndefined();
});
it('offers a real recheck when the mint is offline', async () => {
  mockInfoError = new Error('Offline');
  await render();
  expect(props()).toMatchObject({ connection: 'Offline', offline: true });
  props().onRefresh();
  expect(mockRefresh).toHaveBeenCalledWith({ cancelRefetch: false });
});
it.each(['onTransfer', 'onRecover', 'onDetails'] as const)(
  'dismisses before %s navigation and retains mint identity',
  async (action) => {
    await render();
    await act(async () => props()[action]());
    expect(mockDismiss).toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
    await act(async () => tree.root.findByType('Sheet' as any).props.onClose());
    expect(mockPush).toHaveBeenCalledWith(
      action === 'onTransfer'
        ? { pathname: '/(modals)/swap', params: { sourceMintUrl: mockUrl } }
        : {
            pathname: action === 'onRecover' ? '/recover-funds' : '/(modals)/mint-details',
            params: { mintUrl: mockUrl },
          },
    );
  },
);
it('saves a trimmed nickname in the header without navigating', async () => {
  await render();
  await act(async () => props().onRename());
  expect(props().renameEditor).toBeDefined();
  await act(async () => props().renameEditor.input.props.onChangeText('  My mint  '));
  await act(async () => props().renameEditor.onSave());
  expect(mockRename).toHaveBeenCalledWith(mockUrl, 'My mint');
  expect(props().name).toBe('My mint');
  expect(props().renameEditor).toBeUndefined();
  expect(mockPush).not.toHaveBeenCalled();
});
it('keeps an unsuccessful rename editable and does not claim success', async () => {
  mockRename.mockResolvedValue(undefined);
  await render();
  await act(async () => props().onRename());
  await act(async () => props().renameEditor.input.props.onChangeText('New name'));
  await act(async () => props().renameEditor.onSave());
  expect(props().name).toBe('Everyday mint');
  expect(props().renameEditor).toBeDefined();
  expect(hapticService.selection).not.toHaveBeenCalled();
});
it('allows reviewing funded removal while blocking pending and unknown states', async () => {
  await render();
  expect(props().removeDisabled).toBe(false);
  await act(async () => {
    await useWalletStore.setState({ balances: { [mockUrl]: 0 } });
  });
  mockBlock = 'pending';
  await act(async () => tree.update(<ConnectedMintSheet mintUrl={mockUrl} onClose={mockClose} />));
  expect(props().removeDisabled).toBe(true);
  expect(props().removeHint).toContain('Pending');
  mockBlock = 'unknown';
  await act(async () => tree.update(<ConnectedMintSheet mintUrl={mockUrl} onClose={mockClose} />));
  expect(props().removeDisabled).toBe(true);
  expect(mockRemove).not.toHaveBeenCalled();
});

it('removes a funded mint only after its warning is confirmed', async () => {
  await render();
  await act(async () => props().onRemove());
  expect(mockDestructiveRemove).not.toHaveBeenCalled();
  expect(tree.root.findByProps({ children: 'This mint still has funds' })).toBeDefined();
  await act(async () => removeButton().props.onPress());
  expect(mockDestructiveRemove).toHaveBeenCalledWith(mockUrl);
  expect(mockRemove).not.toHaveBeenCalled();
  expect(hapticService.completion).toHaveBeenCalledTimes(1);
});

it('replaces the overview with confirmation and restores it when cancelled', async () => {
  await render();
  await act(async () => props().onRemove());
  expect(tree.root.findAllByType('MintView' as any)).toHaveLength(0);
  expect(tree.root.findByType('Sheet' as any).props).toMatchObject({
    title: 'Remove mint?',
    showHeader: true,
  });
  expect(tree.root.findByProps({ children: 'Everyday mint' })).toBeDefined();
  const cancel = tree.root
    .findAllByType('Button' as any)
    .find((button) => button.props.children === 'Cancel')!;
  await act(async () => cancel.props.onPress());
  expect(props().amount).toBe('24,000');
  expect(tree.root.findByType('Sheet' as any).props.showHeader).toBe(false);
  expect(mockDestructiveRemove).not.toHaveBeenCalled();
  expect(mockRemove).not.toHaveBeenCalled();
});

it('requires another confirmation if funds appear after the initial empty-mint review', async () => {
  useWalletStore.setState({ balances: { [mockUrl]: 0 } });
  mockInspect.mockImplementation(async (_urls, options) => ({
    [mockUrl]: options?.allowFunds ? null : 'funds',
  }));
  await render();
  await act(async () => props().onRemove());
  await act(async () => removeButton().props.onPress());
  expect(mockDestructiveRemove).not.toHaveBeenCalled();
  expect(mockRemove).not.toHaveBeenCalled();
  expect(tree.root.findByProps({ children: 'This mint still has funds' })).toBeDefined();
  await act(async () => removeButton().props.onPress());
  expect(mockDestructiveRemove).toHaveBeenCalledTimes(1);
});

it('does not delete a funded mint with an unresolved payment', async () => {
  mockInspect.mockImplementation(async (_urls, options) => ({
    [mockUrl]: options?.allowFunds ? 'pending' : 'funds',
  }));
  await render();
  await act(async () => props().onRemove());
  await act(async () => removeButton().props.onPress());
  expect(mockDestructiveRemove).not.toHaveBeenCalled();
  expect(mockRemove).not.toHaveBeenCalled();
  expect(tree.root.findByProps({ children: 'Pending payments or requests' })).toBeDefined();
});
it('rechecks eligibility at confirmation and keeps a mint if activity changed', async () => {
  useWalletStore.setState({ balances: { [mockUrl]: 0 } });
  mockRemove.mockResolvedValue({ removed: [], blocked: { [mockUrl]: 'pending' } });
  await render();
  await act(async () => props().onRemove());
  await act(async () => removeButton().props.onPress());
  expect(mockRemove).toHaveBeenCalledWith([mockUrl]);
  expect(hapticService.completion).not.toHaveBeenCalled();
  expect(mockClose).not.toHaveBeenCalled();
});
it('deduplicates removal confirmation and closes only after a verified removal', async () => {
  useWalletStore.setState({ balances: { [mockUrl]: 0 } });
  let finish!: (value: any) => void;
  mockRemove.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await render();
  await act(async () => props().onRemove());
  await act(async () => {
    void removeButton().props.onPress();
    void removeButton().props.onPress();
  });
  expect(mockRemove).toHaveBeenCalledTimes(1);
  expect(removeButton().props.loading).toBe(true);
  expect(tree.root.findByType('Sheet' as any).props.canDismiss).toBe(false);
  await act(async () => finish({ removed: [mockUrl], blocked: {} }));
  expect(hapticService.completion).toHaveBeenCalledTimes(1);
  expect(mockDismiss).toHaveBeenCalled();
});
it('hides on background, cancels queued navigation, and never reopens on resume', async () => {
  await render();
  await act(async () => props().onDetails());
  (AppState as any).currentState = 'background';
  await act(async () => mockAppListener('background'));
  expect(tree.root.findAllByType('MintView' as any)).toHaveLength(0);
  await act(async () => tree.root.findByType('Sheet' as any).props.onClose());
  expect(mockPush).not.toHaveBeenCalled();
  (AppState as any).currentState = 'active';
  await act(async () => mockAppListener('active'));
  expect(mockPresent).toHaveBeenCalledTimes(1);
});
it('hides QR and amounts when authentication locks', async () => {
  await render();
  await act(async () => props().onQr());
  expect(tree.root.findByType('MintQR' as any).props.visible).toBe(true);
  await act(async () => {
    useSettingsStore.setState({ biometricEnabled: true });
    useAuthStore.setState({ isAuthenticated: false });
  });
  expect(tree.root.findAllByType('MintView' as any)).toHaveLength(0);
  expect(tree.root.findByType('MintQR' as any).props.visible).toBe(false);
});
