jest.mock('@tamagui/toast', () => ({
  useToastController: () => ({ show: jest.fn(), hide: jest.fn() }),
}));
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Alert } from 'react-native';
import ProofManagerScreen from '~/features/settings/ProofManagerScreen';
import { useQuery } from '@tanstack/react-query';

const mockDelete = jest.fn(async (..._args: unknown[]) => {});
const mockRefresh = jest.fn(async () => {});
const mockProofs = {
  unspent: [
    { mintUrl: 'https://mint.example', amount: 8, secret: 'ready-fixture', state: 'ready' },
  ],
  inflight: [
    { mintUrl: 'https://mint.example', amount: 4, secret: 'pending-fixture', state: 'inflight' },
  ],
  spent: [{ mintUrl: 'https://mint.example', amount: 2, secret: 'spent-fixture', state: 'spent' }],
};
jest.mock('tamagui', () => ({ Text: 'Text', XStack: 'XStack', YStack: 'YStack' }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));
jest.mock('@legendapp/list/react-native', () => ({
  LegendList: ({
    data,
    renderItem,
    ListHeaderComponent,
    ListEmptyComponent,
    ListFooterComponent,
    ...props
  }: any) =>
    require('react').createElement(
      'LegendList',
      { data, renderItem, ...props },
      ListHeaderComponent,
      data.length
        ? data
            .slice(0, 12)
            .map((item: any, index: number) =>
              require('react').createElement(
                require('react').Fragment,
                { key: index },
                renderItem({ item, index }),
              ),
            )
        : ListEmptyComponent,
      ListFooterComponent,
    ),
}));
jest.mock('@tamagui/lucide-icons', () => ({
  Coins: 'Coins',
  Landmark: 'Landmark',
  RefreshCw: 'Refresh',
  Share2: 'Share',
  Trash2: 'Trash',
}));
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'AppButton' }));
jest.mock('~/features/settings/components/SettingsLayout', () => ({
  SettingsPage: 'Page',
  SettingsGroup: 'Group',
  SettingsDescription: 'Description',
  SettingsMessage: 'Message',
  SettingsRow: 'Row',
}));
jest.mock('@react-navigation/native', () => ({ usePreventRemove: jest.fn() }));
jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void) => require('react').useEffect(callback, [callback]),
}));
jest.mock('~/state/walletStore', () => ({
  useWalletStore: (select: any) =>
    select({ mints: [{ mintUrl: 'https://mint.example', name: 'Example mint' }] }),
}));
jest.mock('~/services/wallet', () => ({
  proofService: {
    getAllReadyProofs: jest.fn(),
    getAllProofsByState: jest.fn(),
    encodeProofsAsToken: jest.fn(),
    deleteProofs: (...args: unknown[]) => mockDelete(...args),
  },
}));
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
  useQuery: jest.fn(({ queryKey }: { queryKey: string[] }) => ({
    data: mockProofs[queryKey[1] as keyof typeof mockProofs],
    isFetching: false,
    isError: false,
    refetch: mockRefresh,
  })),
}));

it('keeps pending proofs read-only and deletes only shown spent records after confirmation', async () => {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<ProofManagerScreen />);
  });
  expect(
    jest
      .mocked(useQuery)
      .mock.calls.slice(-3)
      .map(([options]) => options.enabled),
  ).toEqual([true, false, false]);
  const rows = () => tree.root.findAllByType('Row' as any);
  const buttons = () => tree.root.findAllByType('AppButton' as any);
  await act(async () =>
    rows()
      .find((row) => row.props.title === 'In-flight')!
      .props.onPress(),
  );
  expect(buttons().map((button) => button.props.children)).toEqual(['Refresh proofs']);
  expect(
    jest
      .mocked(useQuery)
      .mock.calls.slice(-3)
      .map(([options]) => options.enabled),
  ).toEqual([false, true, false]);
  expect(mockDelete).not.toHaveBeenCalled();
  await act(async () =>
    rows()
      .find((row) => row.props.title === 'Spent')!
      .props.onPress(),
  );
  let erase!: () => void;
  const alert = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, actions) => {
    erase = actions!.find((action) => action.text === 'Erase')!.onPress as () => void;
  });
  buttons()
    .find((button) => button.props.children === 'Erase shown spent proofs')!
    .props.onPress();
  expect(mockDelete).not.toHaveBeenCalled();
  await act(async () => erase());
  expect(mockDelete).toHaveBeenCalledWith('https://mint.example', ['spent-fixture']);
  expect(mockDelete).toHaveBeenCalledTimes(1);
  expect(mockRefresh).toHaveBeenCalledTimes(1);
  await act(async () => tree.unmount());
  alert.mockRestore();
});

it('renders a window of a large proof collection while retaining every shown proof in the dataset', async () => {
  const original = [...mockProofs.unspent];
  mockProofs.unspent.push(
    ...Array.from({ length: 200 }, (_, index) => ({
      mintUrl: 'https://mint.example',
      amount: 1,
      secret: `fixture-${index}`,
      state: 'ready',
    })),
  );
  let tree!: ReactTestRenderer;
  try {
    await act(async () => {
      tree = create(<ProofManagerScreen />);
    });
    const list = tree.root.findByType('LegendList' as any);
    expect(list.props.data).toHaveLength(201);
    expect(tree.root.findAllByType('Coins' as any)).toHaveLength(12);
    expect(list.props.keyExtractor(list.props.data[0], 0)).not.toContain('ready-fixture');
    expect(list.props.renderItem({ item: list.props.data[200], index: 200 })).toBeDefined();
  } finally {
    await act(async () => tree?.unmount());
    mockProofs.unspent.splice(0, mockProofs.unspent.length, ...original);
  }
});
