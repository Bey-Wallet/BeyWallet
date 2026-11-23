import React from 'react';
import { Share } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import Screen, {
  LightningAddressMintScreen,
  LightningAddressPaymentsScreen,
} from '~/features/settings/LightningAddressSettingsScreen';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockPush = jest.fn();
const mockSync = jest.fn(async () => {});
const mockGetMints = jest.fn();
const mockCollect = jest.fn();
let mockPending: any[] = [];
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  Stack: { Screen: 'StackScreen' },
}));
jest.mock('tamagui', () => ({ Text: 'Text', YStack: 'YStack' }));
jest.mock('~/shared/icons', () => new Proxy({}, { get: (_, name) => String(name) }));
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'Button' }));
jest.mock('~/shared/ui/Spinner', () => ({ Spinner: 'Spinner' }));
jest.mock('~/features/settings/components/SettingsToggleRow', () => ({
  SettingsToggleRow: 'Switch',
}));
jest.mock('~/features/settings/components/SettingsLayout', () => ({
  SettingsPage: 'Page',
  SettingsGroup: 'Group',
  SettingsRow: 'Row',
  SettingsDescription: 'Description',
  SettingsMessage: 'Message',
}));
jest.mock('~/features/settings/hooks/useSettingsBusy', () => ({ useSettingsBusy: jest.fn() }));
jest.mock('~/shared/hooks/useFeedbackOwner', () => ({ useFeedbackOwner: jest.fn() }));
jest.mock('~/shared/hooks/useAppToast', () => ({ useAppToast: () => ({ copy: jest.fn() }) }));
jest.mock('~/state/settingsStore', () => ({
  useSettingsStore: (select: any) => select({ npub: 'npub-fixture' }),
}));
jest.mock('~/state/lightningAddressStore', () => ({
  useLightningAddressStore: () => ({
    enabled: true,
    receivingMint: 'https://mint.test',
    autoCollect: true,
    pending: mockPending,
  }),
}));
jest.mock('~/services/wallet/lightningAddressLifecycle', () => ({
  getLightningAddressService: () => ({ sync: mockSync, collect: mockCollect }),
}));
jest.mock('~/services/wallet/lightningAddressService', () => ({
  LightningAddressError: class extends Error {},
}));
jest.mock('~/services/wallet/initService', () => ({
  initService: {
    getRepo: () => ({ mintRepository: { getAllMints: mockGetMints } }),
  },
}));
jest.mock('~/services/api/npubCashClient', () => ({
  lightningAddress: () => 'fixture@npub.cash',
  LEGACY_NPUB_CASH: 'https://npubx.cash',
}));

it('keeps old-provider checks collapsed, uses the existing receiving-mint route and shares the address', async () => {
  const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<Screen />);
  });
  try {
    const button = (title: string) =>
      tree.root.findAllByType('Button' as any).find((node) => node.props.children === title);
    expect(button('Check previous npubx.cash address')).toBeUndefined();
    expect(mockSync).not.toHaveBeenCalled();
    tree.root.findByType('Row' as any).props.onPress();
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/settings/lightning-address-mint');
    await act(async () => button('Previous addresses')!.props.onPress());
    expect(button('Previous addresses')!.props.accessibilityState.expanded).toBe(true);
    expect(mockSync).not.toHaveBeenCalled();
    await act(async () => button('Check previous npubx.cash address')!.props.onPress());
    expect(mockSync).toHaveBeenCalledWith('https://npubx.cash');
    await act(async () => button('Share address')!.props.onPress());
    expect(share).toHaveBeenCalledWith({ message: 'fixture@npub.cash' });
    await act(async () => button('Previous addresses')!.props.onPress());
    expect(button('Check previous npubx.cash address')).toBeUndefined();
  } finally {
    await act(async () => tree.unmount());
    share.mockRestore();
  }
});

afterEach(() => {
  mockPending = [];
  jest.clearAllMocks();
});

it('shows loading before a genuinely empty receiving-mint list', async () => {
  let resolve!: (value: any[]) => void;
  mockGetMints.mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <QueryClientProvider client={client}>
        <LightningAddressMintScreen />
      </QueryClientProvider>,
    );
  });
  try {
    expect(tree.root.findAllByType('Spinner' as any)).toHaveLength(1);
    expect(JSON.stringify(tree.toJSON())).not.toContain('Add and trust');
    await act(async () => {
      resolve([]);
      await new Promise((done) => setTimeout(done, 20));
    });
    expect(tree.root.findAllByType('Spinner' as any)).toHaveLength(0);
    expect(JSON.stringify(tree.toJSON())).toContain('Add and trust');
  } finally {
    await act(async () => tree.unmount());
    client.clear();
  }
});

it('shows a mint-read error instead of an empty list and retries the read', async () => {
  mockGetMints.mockRejectedValueOnce(new Error('Unavailable')).mockResolvedValue([
    { mintUrl: 'https://trusted.test', trusted: true },
    { mintUrl: 'https://untrusted.test', trusted: false },
  ]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <QueryClientProvider client={client}>
        <LightningAddressMintScreen />
      </QueryClientProvider>,
    );
    await new Promise((done) => setTimeout(done, 20));
  });
  try {
    await act(async () => {
      await new Promise((done) => setTimeout(done, 20));
    });
    expect(JSON.stringify(tree.toJSON())).toContain('Could not load receiving mints');
    expect(JSON.stringify(tree.toJSON())).not.toContain('Add and trust');
    await act(async () => {
      await tree.root
        .findAllByType('Button' as any)
        .find((button) => button.props.children === 'Try again')!
        .props.onPress();
      await new Promise((done) => setTimeout(done, 20));
    });
    expect(tree.root.findAllByType('Row' as any).map((row) => row.props.title)).toEqual([
      'https://trusted.test',
    ]);
    expect(JSON.stringify(tree.toJSON())).not.toContain('Could not load receiving mints');
  } finally {
    await act(async () => tree.unmount());
    client.clear();
  }
});

it('shows loading only on the payment being collected and clears it after failure', async () => {
  mockPending = [
    { mintUrl: 'https://mint.test', quoteId: 'one', amount: 5, providers: [] },
    { mintUrl: 'https://mint.test', quoteId: 'two', amount: 10, providers: [] },
  ];
  let reject!: (reason: Error) => void;
  mockCollect.mockReturnValue(
    new Promise((_resolve, fail) => {
      reject = fail;
    }),
  );
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<LightningAddressPaymentsScreen />);
  });
  try {
    const buttons = () =>
      tree.root
        .findAllByType('Button' as any)
        .filter((button) => button.props.children === 'Collect');
    await act(async () => {
      void buttons()[0].props.onPress();
    });
    expect(buttons()[0].props.loading).toBe(true);
    expect(buttons()[1].props.loading).toBe(false);
    expect(buttons()[1].props.disabled).toBe(true);
    await act(async () => reject(new Error('Offline')));
    expect(buttons()[0].props.loading).toBe(false);
    expect(buttons()[0].props.disabled).toBe(false);
    expect(JSON.stringify(tree.toJSON())).toContain('Could not complete this action');
  } finally {
    await act(async () => tree.unmount());
  }
});
