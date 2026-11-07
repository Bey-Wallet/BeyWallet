import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Keyboard } from 'react-native';
import { HistoryTabScreen } from '~/features/history/HistoryTabScreen';

const mockSetOptions = jest.fn();
const mockNavigation = { setOptions: mockSetOptions };
jest.mock('expo-router', () => ({ useNavigation: () => mockNavigation }));
jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});
jest.mock('tamagui', () => ({
  useThemeName: () => 'dark',
  useTheme: () => ({}),
  XStack: 'XStack',
  Text: 'Text',
}));
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

it('keeps POS out of the title and gives both header buttons 22-point icons and separate touch slots', async () => {
  let tree!: ReactTestRenderer;
  let header!: ReactTestRenderer;
  await act(async () => {
    tree = create(<HistoryTabScreen />);
  });
  try {
    const options = mockSetOptions.mock.calls.at(-1)![0];
    await act(async () => {
      header = create(
        <>
          {options.headerTitle()}
          {options.headerRight()}
        </>,
      );
    });
    expect(JSON.stringify(header.toJSON())).not.toContain('POS');
    const buttons = header.root.findAllByType('Button' as any);
    expect(buttons).toHaveLength(2);
    for (const button of buttons) {
      expect(button.props).toMatchObject({ iconSize: 22, size: 'xxsmall', shape: 'circular' });
    }
    const slots = header.root
      .findAllByType('XStack' as any)
      .filter((node) => node.props.width === 48 && node.props.height === 48);
    expect(slots).toHaveLength(2);
  } finally {
    await act(async () => {
      tree.unmount();
      header?.unmount();
    });
  }
});
