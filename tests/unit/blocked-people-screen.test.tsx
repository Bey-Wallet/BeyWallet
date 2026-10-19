import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Alert } from 'react-native';
import { nip19 } from 'nostr-tools';
import { BlockedPeopleSettingsScreen } from '~/features/settings/BlockedPeopleSettingsScreen';
import { usePeopleStore, type Person } from '~/state/peopleStore';

jest.mock('react-native', () => ({
  View: 'View',
  StyleSheet: { create: (styles: unknown) => styles },
  Alert: { alert: jest.fn() },
  FlatList: ({ data, renderItem, ListEmptyComponent, ...props }: any) =>
    require('react').createElement(
      'List',
      { ...props, data },
      data.length
        ? data
            .slice(0, 15)
            .map((item: Person, index: number) =>
              require('react').createElement(
                'Item',
                { key: item.npub },
                renderItem({ item, index }),
              ),
            )
        : ListEmptyComponent,
    ),
}));
jest.mock('tamagui', () => ({
  Text: 'Text',
  XStack: 'XStack',
  YStack: 'YStack',
  Input: 'Input',
  getTokens: () => ({ radius: { $6: { val: 20 } } }),
  useTheme: () => ({ buttonDefaultSecondary: { val: '#222' } }),
}));
jest.mock('@tamagui/lucide-icons', () => ({
  Check: 'Check',
  UserRound: 'UserRound',
  UserRoundCheck: 'UserRoundCheck',
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'AppButton' }));
jest.mock('~/shared/ui/AppPressable', () => ({ AppPressable: 'Row' }));
jest.mock('~/features/settings/components/SettingsLayout', () => ({
  SettingsDescription: 'Description',
  SettingsMessage: 'Message',
}));
jest.mock('~/storage/sqlite/sqliteStorage', () => ({
  sqliteStorage: { getItem: () => null, setItem: jest.fn(), removeItem: jest.fn() },
}));

const key = (index: number) => nip19.npubEncode(index.toString(16).padStart(64, '0'));
async function open(count = 200) {
  const people = Object.fromEntries(
    Array.from({ length: count }, (_, index) => {
      const npub = key(index + 1);
      return [
        npub,
        {
          npub,
          displayName: `Person ${String(index + 1).padStart(3, '0')}`,
          contactStatus: 'blocked' as const,
        },
      ];
    }),
  );
  usePeopleStore.setState({ people });
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<BlockedPeopleSettingsScreen />);
  });
  return tree;
}
const buttons = (tree: ReactTestRenderer) => tree.root.findAllByType('AppButton' as any);
const primary = (tree: ReactTestRenderer) =>
  buttons(tree).find((button) => button.props.icon === 'UserRoundCheck')!;

beforeEach(() => jest.clearAllMocks());

it('uses a virtual list and one shared unblock action for a large blocked list', async () => {
  const tree = await open();
  expect(tree.root.findByType('List' as any).props.data).toHaveLength(200);
  expect(tree.root.findAllByType('Row' as any)).toHaveLength(15);
  expect(buttons(tree)).toHaveLength(2);
  expect(primary(tree).props.disabled).toBe(true);
  await act(async () => tree.root.findAllByType('Row' as any)[0].props.onPress());
  expect(primary(tree).props.children).toBe('Unblock selected (1)');
  expect(tree.root.findAllByType('Row' as any)[0].props.accessibilityState.checked).toBe(true);
  expect(usePeopleStore.getState().people[key(1)].contactStatus).toBe('blocked');
  await act(async () => tree.unmount());
});

it('selects filtered results, preserves hidden selections, and only unblocks after confirmation', async () => {
  const tree = await open(30);
  await act(async () => tree.root.findAllByType('Row' as any)[0].props.onPress());
  await act(async () => tree.root.findByType('Input' as any).props.onChangeText('Person 02'));
  expect(tree.root.findByType('List' as any).props.data).toHaveLength(10);
  await act(async () =>
    buttons(tree)
      .find((button) => button.props.children === 'Select results')!
      .props.onPress(),
  );
  expect(primary(tree).props.children).toBe('Unblock selected (11)');
  await act(async () => primary(tree).props.onPress());
  expect(usePeopleStore.getState().people[key(1)].contactStatus).toBe('blocked');
  const confirm = jest
    .mocked(Alert.alert)
    .mock.calls.at(-1)![2]!
    .find((button) => button.text === 'Unblock')!;
  await act(async () => confirm.onPress!());
  expect(
    Object.values(usePeopleStore.getState().people).filter(
      (person) => person.contactStatus === 'blocked',
    ),
  ).toHaveLength(19);
  expect(usePeopleStore.getState().people[key(1)].requiresAcceptance).toBe(true);
  expect(usePeopleStore.getState().people[key(30)].contactStatus).toBe('blocked');
  await act(async () => tree.unmount());
});

it('selects off-screen contacts and allows clearing the entire selection', async () => {
  const tree = await open(200);
  await act(async () =>
    buttons(tree)
      .find((button) => button.props.children === 'Select all')!
      .props.onPress(),
  );
  expect(primary(tree).props.children).toBe('Unblock selected (200)');
  await act(async () =>
    buttons(tree)
      .find((button) => button.props.children === 'Clear')!
      .props.onPress(),
  );
  expect(primary(tree).props.disabled).toBe(true);
  expect(
    Object.values(usePeopleStore.getState().people).every(
      (person) => person.contactStatus === 'blocked',
    ),
  ).toBe(true);
  await act(async () => tree.unmount());
});
