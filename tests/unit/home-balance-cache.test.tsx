import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import Balance from '~/features/home/components/Balance';
import { useWalletStore } from '~/state/walletStore';
import { useSettingsStore } from '~/state/settingsStore';

let mockQuote: { price: number } | undefined;
let mockFetching = true;
jest.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: mockQuote, isFetching: mockFetching }),
}));
jest.mock('~/state/walletStore', () => ({ useWalletStore: require('zustand').create(() => ({})) }));
jest.mock('~/state/settingsStore', () => ({
  useSettingsStore: require('zustand').create(() => ({})),
}));
jest.mock('~/services/api/bitcoinService', () => ({ bitcoinService: {} }));
jest.mock('~/shared/ui/RollingNumber', () => ({ RollingNumber: 'RollingNumber' }));
jest.mock('tamagui', () =>
  Object.fromEntries(
    ['H1', 'H2', 'Paragraph', 'Text', 'View', 'XStack', 'YStack'].map((name) => [name, name]),
  ),
);
jest.mock('expo-haptics', () => ({}));

let tree: ReactTestRenderer;
const displayed = () => tree.root.findAllByType('RollingNumber' as any).map((node) => node.props);
beforeEach(() => {
  mockQuote = { price: 100_000 };
  mockFetching = true;
  useWalletStore.setState({ balances: { mint: 10_000 }, refreshCounter: 0, isRestoring: false });
  useSettingsStore.setState({
    primaryCurrency: 'FIAT',
    secondaryCurrency: 'USD',
    hideBalance: false,
    showBitcoinSymbol: false,
  });
});
afterEach(async () => {
  await act(async () => tree.unmount());
});

it('keeps the existing balance and fiat amount visible while refreshing and updates them together', async () => {
  await act(async () => {
    tree = create(<Balance />);
  });
  expect(displayed()[0].children).toBe('$10.00');
  expect(displayed()[1].value).toBe(10_000);
  mockQuote = { price: 120_000 };
  await act(async () => {
    tree.update(<Balance />);
  });
  expect(displayed()[0].children).toBe('$12.00');
  await act(async () => {
    useWalletStore.setState({ balances: { mint: 20_000 } });
  });
  expect(displayed()[0].children).toBe('$24.00');
  expect(displayed()[1].value).toBe(20_000);
});

it('shows a real zero without requiring an exchange rate', async () => {
  mockQuote = undefined;
  useWalletStore.setState({ balances: {} });
  await act(async () => {
    tree = create(<Balance />);
  });
  expect(displayed()[0].children).toBe('$0.00');
});

it('does not invent a zero conversion when no quote has ever been cached', async () => {
  mockQuote = undefined;
  await act(async () => {
    tree = create(<Balance />);
  });
  expect(displayed()[0].children).toBe('Loading…');
  mockFetching = false;
  await act(async () => {
    tree.update(<Balance />);
  });
  expect(displayed()[0].children).toBe('Unavailable');
});

it('keeps cached balances private when hidden and separates quotes when changing currency', async () => {
  await act(async () => {
    tree = create(<Balance />);
  });
  mockQuote = undefined;
  await act(async () => {
    useSettingsStore.setState({ secondaryCurrency: 'AED' });
  });
  expect(displayed()[0].children).toBe('Loading…');
  await act(async () => {
    useSettingsStore.setState({ hideBalance: true });
  });
  expect(displayed().every((props) => props.value === '****' && props.children === undefined)).toBe(
    true,
  );
});
