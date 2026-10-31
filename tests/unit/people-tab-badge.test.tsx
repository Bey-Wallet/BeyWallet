import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { CustomTabBar } from '~/shared/ui/CustomTabBar';

let mockTotal = 2;
jest.mock('~/features/people/hooks/usePeopleUnreadCounts', () => ({
  usePeopleUnreadCounts: () => ({ total: mockTotal }),
}));
jest.mock('tamagui', () => ({
  Text: 'Text',
  XStack: 'XStack',
  YStack: 'YStack',
  useTheme: () => ({ tabActive: { val: '#fff' }, tabInactive: { val: '#888' } }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0 }),
}));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(async () => undefined),
  ImpactFeedbackStyle: { Light: 'light' },
}));

it('shows a numeric badge only on People and removes it when all conversations are read', async () => {
  const props: any = {
    state: {
      index: 0,
      routes: [
        { key: 'home', name: 'index' },
        { key: 'people', name: 'people' },
      ],
    },
    descriptors: {
      home: { options: { title: 'Home', tabBarIcon: () => null } },
      people: { options: { title: 'People', tabBarIcon: () => null } },
    },
    navigation: { emit: jest.fn(() => ({})), navigate: jest.fn() },
  };
  let tree!: ReactTestRenderer;
  try {
    await act(async () => {
      tree = create(<CustomTabBar {...props} />);
    });
    const tab = (label: string) =>
      tree.root.findAll(
        (node) => node.props.accessibilityRole === 'tab' && node.props.accessibilityLabel === label,
      )[0];
    expect(tab('Home')).toBeDefined();
    expect(tab('People, 2 unread conversations')).toBeDefined();
    expect(JSON.stringify(tree.toJSON())).toContain('"2"');
    expect(
      tree.root.findAllByType('YStack' as any).some((node) => node.props.bg === '$red10'),
    ).toBe(true);
    mockTotal = 100;
    await act(async () => tree.update(<CustomTabBar {...props} />));
    expect(JSON.stringify(tree.toJSON())).toContain('99+');
    await act(async () => tab('People, 100 unread conversations').props.onPress());
    expect(props.navigation.navigate).toHaveBeenCalledWith('people');
    mockTotal = 0;
    await act(async () => tree.update(<CustomTabBar {...props} />));
    expect(tab('People')).toBeDefined();
    expect(JSON.stringify(tree.toJSON())).not.toContain('99+');
  } finally {
    if (tree) await act(async () => tree.unmount());
  }
});
