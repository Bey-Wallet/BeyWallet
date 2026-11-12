import React from 'react';
import { Share } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import Screen from '~/features/settings/LightningAddressSettingsScreen';

const mockPush = jest.fn();
const mockSync = jest.fn(async () => {});
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('tamagui', () => ({ Text: 'Text', YStack: 'YStack' }));
jest.mock('@tamagui/lucide-icons', () => new Proxy({}, { get: (_, name) => String(name) }));
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'Button' }));
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
    pending: [],
  }),
}));
jest.mock('~/services/wallet/lightningAddressLifecycle', () => ({
  getLightningAddressService: () => ({ sync: mockSync }),
}));
jest.mock('~/services/wallet/lightningAddressService', () => ({
  LightningAddressError: class extends Error {},
}));
jest.mock('~/services/wallet/initService', () => ({ initService: {} }));
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
