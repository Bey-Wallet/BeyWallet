import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ThemePreviewScreen } from '~/features/theme/ThemePreviewScreen';
import { AboutSettingsScreen } from '~/features/settings/AboutSettingsScreen';

const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockSetTheme = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  Redirect: 'Redirect',
  Stack: { Screen: 'Screen' },
  useRouter: () => ({
    canGoBack: () => true,
    back: mockBack,
    replace: mockReplace,
    push: mockPush,
  }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0 }),
}));
jest.mock('tamagui', () => ({
  Theme: 'Theme',
  XStack: 'XStack',
  YStack: 'YStack',
  Input: 'Input',
  Text: 'Text',
}));
jest.mock('~/shared/theme/ThemeContext', () => ({
  useAppTheme: () => ({ resolvedTheme: 'dark', setThemeMode: mockSetTheme }),
}));
jest.mock('~/shared/ui/AppPressable', () => ({ AppPressable: 'AppPressable' }));
jest.mock('~/shared/ui/BeyText', () => ({ BeyText: 'BeyText' }));
jest.mock('~/shared/ui/Spinner', () => ({ Spinner: 'Spinner' }));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: 'test' } },
}));
jest.mock('expo-application', () => ({ nativeApplicationVersion: null, nativeBuildVersion: null }));
jest.mock('~/shared/icons/BeyIcon', () => ({ __esModule: true, default: 'BeyIcon' }));
jest.mock('~/features/settings/settingsCatalog', () => ({
  settingsLinks: {},
  settingsLinkIcons: {},
}));
jest.mock('~/features/settings/components/SettingsLayout', () => ({
  SettingsPage: 'SettingsPage',
  SettingsGroup: 'SettingsGroup',
  SettingsRow: 'SettingsRow',
  SettingsMessage: 'SettingsMessage',
  SettingsDescription: 'SettingsDescription',
  openSettingsLink: jest.fn(),
}));
jest.mock('@tamagui/lucide-icons', () => ({
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowRightLeft: 'Transfer',
  X: 'Close',
  Check: 'Check',
  Palette: 'Palette',
  RefreshCw: 'Refresh',
  FileText: 'FileText',
}));

describe('isolated development theme preview', () => {
  const dev = __DEV__;
  let tree: ReactTestRenderer;
  afterEach(async () => {
    if (tree) await act(async () => tree.unmount());
    (globalThis as any).__DEV__ = dev;
    jest.clearAllMocks();
  });
  it('switches only its own appearance and leaves the saved preference alone', async () => {
    await act(async () => {
      tree = create(<ThemePreviewScreen />);
    });
    expect(tree.root.findByType('Theme' as any).props.name).toBe('dark_bey');
    const light = tree.root
      .findAllByType('AppPressable' as any)
      .find((node) => node.props.accessibilityLabel === 'Light preview')!;
    await act(async () => light.props.onPress());
    expect(tree.root.findByType('Theme' as any).props.name).toBe('light_bey');
    expect(mockSetTheme).not.toHaveBeenCalled();
    const close = tree.root
      .findAllByType('AppPressable' as any)
      .find((node) => node.props.accessibilityLabel === 'Close theme preview')!;
    await act(async () => close.props.onPress());
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
  it('uses the existing spinner and renders every typography role for review', async () => {
    await act(async () => {
      tree = create(<ThemePreviewScreen />);
    });
    expect(tree.root.findAllByType('Spinner' as any).length).toBeGreaterThan(1);
    expect(
      tree.root.findAllByType('Spinner' as any).some((node) => node.props.reduceMotion === true),
    ).toBe(true);
    const roles = tree.root
      .findAllByType('BeyText' as any)
      .filter((node) => node.props.testID?.startsWith('preview-type-'));
    expect(roles).toHaveLength(13);
  });
  it('redirects production direct entry before mounting any preview content', async () => {
    (globalThis as any).__DEV__ = false;
    await act(async () => {
      tree = create(<ThemePreviewScreen />);
    });
    expect(tree.root.findByType('Redirect' as any).props.href).toBe('/(tabs)/settings/about');
    expect(tree.root.findAllByType('Theme' as any)).toHaveLength(0);
  });
  it('offers the About navigation entry only in development', async () => {
    await act(async () => {
      tree = create(<AboutSettingsScreen />);
    });
    const previewEntry = () =>
      tree.root
        .findAllByType('SettingsRow' as any)
        .filter((node) => node.props.title === 'Theme preview');
    expect(previewEntry()).toHaveLength(1);
    await act(async () => previewEntry()[0].props.onPress());
    expect(mockPush).toHaveBeenCalledWith('/(modals)/theme-preview');
    (globalThis as any).__DEV__ = false;
    await act(async () => tree.update(<AboutSettingsScreen />));
    expect(previewEntry()).toHaveLength(0);
  });
});
