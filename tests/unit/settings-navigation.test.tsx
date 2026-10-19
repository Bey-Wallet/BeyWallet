import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import SettingsStack from '~/features/settings/SettingsStack';
import {
  rememberSettingsOrigin,
  settingsReturnPath,
  settingsTabIsActive,
} from '~/features/settings/settingsNavigation';

const mockNavigate = jest.fn();
const mockReplace = jest.fn();
const mockGoBack = jest.fn();
let mockRoute = 'index';
let mockCanGoBack = false;
jest.mock('expo-router', () => ({
  useRouter: () => ({ navigate: mockNavigate, replace: mockReplace }),
  Stack: ({ screenOptions }: any) => {
    const React = require('react');
    const options = screenOptions({
      route: { name: mockRoute },
      navigation: {
        getState: () => ({ index: mockCanGoBack ? 1 : 0 }),
        goBack: mockGoBack,
      },
    });
    return React.createElement(
      'Header',
      null,
      options.headerTitle({ children: options.title }),
      options.headerLeft(),
    );
  },
}));
jest.mock('tamagui', () => ({
  Text: 'Text',
  useTheme: () => ({ background: { val: '#000' }, color: { val: '#fff' } }),
}));
jest.mock(
  '@tamagui/lucide-icons',
  () =>
    new Proxy(
      { __esModule: true },
      {
        get: (target: Record<string, unknown>, name: string) =>
          name in target ? target[name] : name,
      },
    ),
);
jest.mock('~/shared/icons/NostrIcon', () => ({ __esModule: true, default: 'NostrIcon' }));
jest.mock('~/shared/ui/AppIconButton', () => ({ AppIconButton: 'AppIconButton' }));

it('renders the real header title export and returns to the originating tab', async () => {
  rememberSettingsOrigin('people');
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<SettingsStack />);
  });
  expect(tree.root.findByType('Text' as any).props.children).toBe('Settings');
  tree.root.findByType('AppIconButton' as any).props.onPress();
  expect(mockNavigate).toHaveBeenCalledWith('/(tabs)/people');
  mockRoute = 'theme';
  await act(async () => tree.update(<SettingsStack />));
  expect(tree.root.findByType('Text' as any).props.children).toBe('Theme');
  tree.root.findByType('AppIconButton' as any).props.onPress();
  expect(mockReplace).toHaveBeenCalledWith('/(tabs)/settings');
  mockCanGoBack = true;
  await act(async () => tree.update(<SettingsStack />));
  tree.root.findByType('AppIconButton' as any).props.onPress();
  expect(mockGoBack).toHaveBeenCalledTimes(1);
  await act(async () => tree.unmount());
});

it('hides the custom tab bar only in Settings and ignores invalid return destinations', () => {
  expect(settingsTabIsActive('settings')).toBe(true);
  for (const tab of ['index', 'history', 'people']) expect(settingsTabIsActive(tab)).toBe(false);
  rememberSettingsOrigin('history');
  rememberSettingsOrigin('settings');
  expect(settingsReturnPath()).toBe('/(tabs)/history');
  rememberSettingsOrigin('index');
  expect(settingsReturnPath()).toBe('/(tabs)');
});
