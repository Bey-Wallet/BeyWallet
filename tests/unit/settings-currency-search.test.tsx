import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { CurrencySettingsScreen } from '~/features/settings/PreferenceScreens';

const mockSave = jest.fn();
const mockRefetch = jest.fn();
const mockPriceQuery = jest.fn((_options: unknown) => ({
  data: { price: 65000, updatedAt: Date.now() / 1000 },
  isFetching: false,
  refetch: mockRefetch,
}));
jest.mock('@tanstack/react-query', () => ({
  useQuery: (options: unknown) => mockPriceQuery(options),
}));
jest.mock('tamagui', () => ({ Text: 'Text', XStack: 'XStack', YStack: 'YStack' }));
jest.mock('@tamagui/lucide-icons', () => ({ Coins: 'Coins', RefreshCw: 'RefreshCw' }));
jest.mock('~/shared/ui/RemoteImage', () => ({ RemoteImage: 'RemoteImage' }));
jest.mock('~/shared/ui/Spinner', () => ({ Spinner: 'Spinner' }));
jest.mock('~/shared/ui/AppIconButton', () => ({ AppIconButton: 'IconButton' }));
jest.mock('~/services/api/bitcoinService', () => ({ bitcoinService: { fetchPrice: jest.fn() } }));
const mockSettings = { secondaryCurrency: 'EUR', setSecondaryCurrency: mockSave };
jest.mock('~/state/settingsStore', () => ({
  useSettingsStore: (select: any) => select(mockSettings),
}));
jest.mock('~/services/wallet/currencyService', () => ({
  currencyService: { formatValue: (value: number, currency: string) => `${currency} ${value}` },
  SELECTABLE_CURRENCIES: [
    { code: 'USD', name: 'US Dollar' },
    { code: 'EUR', name: 'Euro' },
  ],
}));
jest.mock('~/shared/ui/AppInput', () => ({ AppInput: 'Input' }));
jest.mock('~/features/settings/components/SettingsLayout', () => ({
  SettingsPage: 'Page',
  SettingsGroup: 'Group',
  SettingsRow: 'Row',
  SettingsDescription: 'Description',
}));

it('keeps the full currency list stable and refreshes the selected currency price', async () => {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<CurrencySettingsScreen />);
  });
  const rows = () => tree.root.findAllByType('Row' as any);
  expect(tree.root.findAllByType('Input' as any)).toHaveLength(0);
  const order = ['None', 'US Dollar', 'Euro'];
  expect(rows().map((row) => row.props.title)).toEqual(order);
  expect(rows()[2].props.selected).toBe(true);
  expect(mockPriceQuery).toHaveBeenLastCalledWith(
    expect.objectContaining({
      queryKey: ['bitcoinPrice', 'EUR'],
      enabled: true,
    }),
  );
  expect(
    tree.root.findAllByType('Text' as any).some((node) => node.props.children === 'EUR 65000'),
  ).toBe(true);
  await act(async () =>
    tree.root.findByProps({ accessibilityLabel: 'Refresh Bitcoin price' }).props.onPress(),
  );
  expect(mockRefetch).toHaveBeenCalledTimes(1);
  await act(async () => {
    rows()[1].props.onPress();
    mockSettings.secondaryCurrency = 'USD';
    tree.update(<CurrencySettingsScreen />);
  });
  expect(rows().map((row) => row.props.title)).toEqual(order);
  expect(rows()[1].props.selected).toBe(true);
  expect(rows()[2].props.selected).toBe(false);
  expect(mockPriceQuery).toHaveBeenLastCalledWith(
    expect.objectContaining({ queryKey: ['bitcoinPrice', 'USD'] }),
  );
  expect(mockSave).toHaveBeenCalledWith('USD');
  rows()
    .find((row) => row.props.title === 'None')!
    .props.onPress();
  expect(mockSave).toHaveBeenCalledWith('NONE');
  await act(async () => tree.unmount());
});

it('shows the EU artwork for EUR and keeps sats-only mode free of price requests', async () => {
  mockSettings.secondaryCurrency = 'EUR';
  let tree!: ReactTestRenderer;
  let image!: ReactTestRenderer;
  await act(async () => {
    tree = create(<CurrencySettingsScreen />);
  });
  const euro = tree.root.findAllByType('Row' as any).find((row) => row.props.value === 'EUR')!;
  await act(async () => {
    image = create(euro.props.icon);
  });
  expect(image.root.findByType('RemoteImage' as any).props.src).toBe(
    'https://flagcdn.com/64x48/eu.png',
  );
  await act(async () => {
    mockSettings.secondaryCurrency = 'NONE';
    tree.update(<CurrencySettingsScreen />);
  });
  expect(mockPriceQuery).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: false }));
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Refresh Bitcoin price' })).toHaveLength(0);
  await act(async () => {
    tree.unmount();
    image.unmount();
  });
});
