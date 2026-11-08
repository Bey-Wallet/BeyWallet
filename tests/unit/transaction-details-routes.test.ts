import RootDetails from '~/app/txn-details';
import ModalDetails from '~/app/(modals)/txn-details';
import { TransactionDetailsScreen } from '~/features/history/TransactionDetailsScreen';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import ModalLayout from '~/app/(modals)/_layout';

jest.mock('expo-router', () => ({
  useRouter: () => ({ canGoBack: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  Stack: Object.assign((props: any) => require('react').createElement('Navigator', props), {
    Screen: 'RouteScreen',
  }),
}));
jest.mock('tamagui', () => ({ useTheme: () => ({ background: { val: '#000000' } }) }));
jest.mock('@tamagui/lucide-icons', () => ({ ArrowLeft: 'BackIcon', X: 'CloseIcon' }));
jest.mock('~/shared/ui/HeaderIconButton', () => ({ HeaderIconButton: 'HeaderIconButton' }));
jest.mock('~/shared/ui/HomeMintSelector', () => ({ __esModule: true, default: 'MintSelector' }));
jest.mock('~/shared/ui/useScreenHeaderOptions', () => ({ useScreenHeaderOptions: () => ({}) }));

jest.mock('~/features/history/TransactionDetailsScreen', () => ({
  TransactionDetailsScreen: jest.fn(),
}));

it('renders both transaction-detail entry points directly without a redirect back to the modal alias', () => {
  expect(RootDetails).toBe(TransactionDetailsScreen);
  expect(ModalDetails).toBe(TransactionDetailsScreen);
});

it('lets the receipt own its header and safe-area padding when opened through chat', async () => {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(React.createElement(ModalLayout));
  });
  const details = tree.root
    .findAllByType('RouteScreen' as any)
    .find((route) => route.props.name === 'txn-details');
  expect(details?.props.options).toMatchObject({
    presentation: 'fullScreenModal',
    headerShown: false,
  });
  // Other payment flows still use their existing navigator headers.
  const mint = tree.root
    .findAllByType('RouteScreen' as any)
    .find((route) => route.props.name === 'mint');
  expect(mint?.props.options.headerShown).not.toBe(false);
  await act(async () => tree.unmount());
});
