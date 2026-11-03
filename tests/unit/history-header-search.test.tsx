import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Keyboard } from 'react-native';
import { HistoryTabScreen } from '~/features/history/HistoryTabScreen';

const mockSetOptions = jest.fn();
const mockNavigation = { setOptions: mockSetOptions };
jest.mock('expo-router', () => ({ useNavigation: () => mockNavigation }));
jest.mock('react-native', () => ({
  View: 'View',
  Keyboard: { dismiss: jest.fn() },
  StyleSheet: { create: (styles: unknown) => styles },
}));
jest.mock('tamagui', () => ({ XStack: 'XStack', Text: 'Text' }));
jest.mock('~/shared/ui/AppPressable', () => ({ AppPressable: 'Pressable' }));
jest.mock('@tamagui/lucide-icons', () => ({
  Search: 'Search',
  X: 'X',
  SlidersHorizontal: 'SlidersHorizontal',
}));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
}));
jest.mock('~/shared/ui/AppIconButton', () => ({ AppIconButton: 'Button' }));
jest.mock('~/features/history', () => ({ HistoryScreen: 'HistoryScreen' }));

it('places search beside filters and toggles the expanded bar without changing filter state', async () => {
  let tree!: ReactTestRenderer;
  let header!: ReactTestRenderer;
  await act(async () => {
    tree = create(<HistoryTabScreen />);
  });
  const screen = () => tree.root.findByType('HistoryScreen' as any);
  const renderHeader = async () => {
    await act(async () => {
      header?.unmount();
      header = create(mockSetOptions.mock.calls.at(-1)![0].headerRight());
    });
    return header.root.findAllByType('Button' as any);
  };
  try {
    expect(screen().props.showSearch).toBe(false);
    let buttons = await renderHeader();
    expect(buttons.map((button) => button.props.accessibilityLabel)).toEqual([
      'Search history',
      'Filter history',
    ]);
    await act(async () => buttons[0].props.onPress());
    expect(screen().props.showSearch).toBe(true);
    buttons = await renderHeader();
    expect(buttons[0].props.accessibilityState.expanded).toBe(true);
    await act(async () => buttons[1].props.onPress());
    expect(screen().props.showFilters).toBe(true);
    await act(async () => buttons[0].props.onPress());
    expect(screen().props.showSearch).toBe(false);
    expect(screen().props.showFilters).toBe(true);
    expect(Keyboard.dismiss).toHaveBeenCalled();
  } finally {
    await act(async () => {
      tree.unmount();
      header?.unmount();
    });
  }
});

it('toggles between separate wallet and POS history and closes the active search', async () => {
  let tree!: ReactTestRenderer;
  let title!: ReactTestRenderer;
  await act(async () => {
    tree = create(<HistoryTabScreen />);
  });
  const screen = () => tree.root.findByType('HistoryScreen' as any);
  const renderTitle = async () => {
    await act(async () => {
      title?.unmount();
      title = create(mockSetOptions.mock.calls.at(-1)![0].headerTitle());
    });
    return title.root.findByProps({ accessibilityLabel: 'POS history' });
  };
  try {
    expect(screen().props.scope).toBe('wallet');
    let toggle = await renderTitle();
    expect(toggle.props.accessibilityState.selected).toBe(false);
    await act(async () => toggle.props.onPress());
    expect(screen().props.scope).toBe('pos');
    expect(screen().props.showSearch).toBe(false);
    toggle = await renderTitle();
    expect(toggle.props.accessibilityState.selected).toBe(true);
    await act(async () => toggle.props.onPress());
    expect(screen().props.scope).toBe('wallet');
  } finally {
    await act(async () => {
      tree.unmount();
      title?.unmount();
    });
  }
});
