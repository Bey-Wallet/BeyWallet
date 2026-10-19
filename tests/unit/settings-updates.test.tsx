import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import OtaUpdateScreen from '~/features/settings/OtaUpdateScreen';

let mockEnabled = false;
const mockCheck = jest.fn();
const mockDownload = jest.fn();
jest.mock('expo-updates', () => ({
  get isEnabled() {
    return mockEnabled;
  },
  channel: null,
  manifest: null,
  useUpdates: () => ({ downloadProgress: 0.42 }),
  checkForUpdateAsync: () => mockCheck(),
  fetchUpdateAsync: () => mockDownload(),
  reloadAsync: jest.fn(),
}));
jest.mock('expo-application', () => ({
  nativeApplicationVersion: '0.2.0',
  nativeBuildVersion: '1',
}));
jest.mock('tamagui', () => ({ Text: 'Text', YStack: 'YStack' }));
jest.mock('@tamagui/lucide-icons', () => ({
  DownloadCloud: 'Download',
  RefreshCw: 'Refresh',
  ArrowUpCircle: 'Restart',
}));
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'Button' }));
jest.mock('~/storage/sqlite/sqliteStorage', () => ({
  sqliteStorage: { getItem: () => null, setItem: jest.fn() },
}));
jest.mock('~/features/settings/hooks/useSettingsBusy', () => ({ useSettingsBusy: jest.fn() }));
jest.mock('~/features/settings/components/SettingsLayout', () => ({
  SettingsPage: 'Page',
  SettingsGroup: 'Group',
  SettingsDescription: 'Description',
  SettingsMessage: 'Message',
}));

it('distinguishes unavailable native updates from an up-to-date production build', async () => {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<OtaUpdateScreen />);
  });
  expect(mockCheck).not.toHaveBeenCalled();
  expect(
    tree.root
      .findAllByType('Text' as any)
      .some((text) => text.props.children === 'Updates unavailable in this build'),
  ).toBe(true);
  expect(tree.root.findByType('Button' as any).props.disabled).toBe(true);
  await act(async () => tree.unmount());
});

it('allows download retry after a failure and reports native download progress', async () => {
  mockEnabled = true;
  mockCheck.mockResolvedValue({
    isAvailable: true,
    manifest: { metadata: { version: '0.2.1' }, message: 'Fixes and improvements' },
  });
  mockDownload.mockRejectedValueOnce(new Error('Download failed'));
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<OtaUpdateScreen />);
  });
  await act(async () => tree.root.findByType('Button' as any).props.onPress());
  expect(tree.root.findByType('Message' as any).props.error).toBe(true);
  await act(async () => tree.root.findByType('Button' as any).props.onPress());
  let finish!: () => void;
  mockDownload.mockReturnValueOnce(
    new Promise<void>((resolve) => {
      finish = resolve;
    }),
  );
  let pending!: Promise<void>;
  await act(async () => {
    pending = tree.root.findByType('Button' as any).props.onPress();
  });
  expect(
    tree.root
      .findAllByType('Text' as any)
      .some((text) => Array.isArray(text.props.children) && text.props.children[0] === 42),
  ).toBe(true);
  await act(async () => {
    finish();
    await pending;
  });
  expect(mockDownload).toHaveBeenCalledTimes(2);
  expect(tree.root.findByType('Button' as any).props.children).toBe('Restart to apply update');
  await act(async () => tree.unmount());
});
