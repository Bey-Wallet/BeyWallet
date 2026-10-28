jest.mock('@tamagui/toast', () => ({
  useToastController: () => ({ show: jest.fn(), hide: jest.fn() }),
}));
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Alert } from 'react-native';
import ProofManagerScreen from '~/features/settings/ProofManagerScreen';

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
jest.mock('tamagui', () => ({ Text: 'Text', XStack: 'XStack' }));
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
  useQuery: ({ queryKey }: { queryKey: string[] }) => ({
    data: mockProofs[queryKey[1] as keyof typeof mockProofs],
    isFetching: false,
    isError: false,
    refetch: mockRefresh,
  }),
}));

it('keeps pending proofs read-only and deletes only shown spent records after confirmation', async () => {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<ProofManagerScreen />);
  });
  const rows = () => tree.root.findAllByType('Row' as any);
  const buttons = () => tree.root.findAllByType('AppButton' as any);
  await act(async () =>
    rows()
      .find((row) => row.props.title === 'In-flight')!
      .props.onPress(),
  );
  expect(buttons().map((button) => button.props.children)).toEqual(['Refresh proofs']);
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
  expect(mockRefresh).toHaveBeenCalledTimes(3);
  await act(async () => tree.unmount());
  alert.mockRestore();
});
