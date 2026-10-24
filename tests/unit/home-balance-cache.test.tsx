import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import Balance from '~/features/home/components/Balance';
import { useWalletStore } from '~/state/walletStore';
import { useSettingsStore } from '~/state/settingsStore';

let mockQuote: { price: number } | undefined;
let mockFetching = true;
let mockOffline = false;
jest.mock('~/shared/hooks/useOfflineStatus', () => ({ useOfflineStatus: () => mockOffline }));
jest.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: mockQuote, isFetching: mockFetching }),
}));
jest.mock('~/state/walletStore', () => ({ useWalletStore: require('zustand').create(() => ({})) }));
jest.mock('~/state/settingsStore', () => ({
  useSettingsStore: require('zustand').create(() => ({})),
}));
jest.mock('~/services/api/bitcoinService', () => ({ bitcoinService: {} }));
jest.mock('~/shared/ui/RollingNumber', () => ({ RollingNumber: 'RollingNumber' }));
jest.mock('tamagui', () => ({
  ...Object.fromEntries(
    ['H1', 'H2', 'Paragraph', 'Text', 'View', 'XStack', 'YStack'].map((name) => [name, name]),
  ),
  useTheme: () => ({ gray3: { val: '#222224' } }),
}));
jest.mock('expo-haptics', () => ({}));

let tree: ReactTestRenderer;
const displayed = () => tree.root.findAllByType('RollingNumber' as any).map((node) => node.props);
beforeEach(() => {
  mockQuote = { price: 100_000 };
  mockFetching = true;
  mockOffline = false;
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

it('collapses to one sats balance for None and restores the saved fiat presentation', async () => {
  useSettingsStore.setState({ secondaryCurrency: 'NONE' });
  await act(async () => {
    tree = create(<Balance />);
  });
  expect(displayed()).toHaveLength(1);
  expect(displayed()[0].value).toBe(10_000);
  const hasHeight = (height: number) =>
    tree.root.findAll(
      (node) => (node.props.height ?? StyleSheet.flatten(node.props.style)?.height) === height,
    ).length > 0;
  expect(hasHeight(160)).toBe(true);
  await act(async () => useSettingsStore.setState({ showBitcoinSymbol: true, hideBalance: true }));
  expect(displayed()[0].value).toBe('****');
  expect(displayed()).toHaveLength(1);
  await act(async () =>
    useSettingsStore.setState({ secondaryCurrency: 'USD', hideBalance: false }),
  );
  expect(displayed()).toHaveLength(2);
  expect(displayed()[0].children).toBe('$10.00');
  expect(useSettingsStore.getState().primaryCurrency).toBe('FIAT');
  expect(hasHeight(200)).toBe(true);
});

it('shows Offline in the sync status area and restores the correct status on reconnection', async () => {
  mockOffline = true;
  await act(async () => {
    tree = create(<Balance />);
  });
  const status = () => tree.root.findAllByType('Text' as any).map((node) => node.props.children);
  expect(status()).toContain('Offline');
  await act(async () => {
    useWalletStore.setState({ isRestoring: true });
  });
  expect(status()).toContain('Offline');
  expect(status()).not.toContain('Syncing...');
  mockOffline = false;
  await act(async () => {
    tree.update(<Balance />);
  });
  expect(status()).toContain('Syncing...');
  expect(status()).not.toContain('Offline');
  await act(async () => {
    useWalletStore.setState({ isRestoring: false });
  });
  expect(status()).not.toContain('Offline');
  expect(status()).not.toContain('Syncing...');
});

it.each(['SATS', 'FIAT'] as const)(
  'keeps %s animation keys stable across balance refreshes',
  async (currency) => {
    useSettingsStore.setState({ primaryCurrency: currency });
    await act(async () => {
      tree = create(<Balance />);
    });
    const before = displayed();
    await act(async () => {
      useWalletStore.setState({ balances: { mint: 10_000 }, refreshCounter: 1 });
    });
    expect(displayed().map((props) => props.trigger)).toEqual(before.map((props) => props.trigger));
    expect(displayed().map((props) => [props.value, props.children])).toEqual(
      before.map((props) => [props.value, props.children]),
    );

    await act(async () => {
      useWalletStore.setState({ balances: { mint: 20_000 }, refreshCounter: 2 });
    });
    const sats = displayed()[currency === 'SATS' ? 0 : 1];
    const fiat = displayed()[currency === 'SATS' ? 1 : 0];
    expect(sats.value).toBe(20_000);
    expect(fiat.children).toBe('$20.00');
  },
);

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
