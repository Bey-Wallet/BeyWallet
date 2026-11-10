import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { CurrencySettingsScreen } from '~/features/settings/PreferenceScreens';

const mockSave = jest.fn();
const mockSettings = { secondaryCurrency: 'EUR', setSecondaryCurrency: mockSave };
jest.mock('~/state/settingsStore', () => ({
  useSettingsStore: (select: any) => select(mockSettings),
}));
jest.mock('~/services/wallet/currencyService', () => ({
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

it('keeps currency order stable after selection, filters by name/code and preserves None', async () => {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<CurrencySettingsScreen />);
  });
  const rows = () => tree.root.findAllByType('Row' as any);
  const search = async (query: string) => {
    await act(async () => tree.root.findByType('Input' as any).props.onChangeText(query));
  };
  const order = ['None', 'US Dollar', 'Euro'];
  expect(rows().map((row) => row.props.title)).toEqual(order);
  expect(rows()[2].props.selected).toBe(true);
  await act(async () => {
    rows()[1].props.onPress();
    mockSettings.secondaryCurrency = 'USD';
    tree.update(<CurrencySettingsScreen />);
  });
  expect(rows().map((row) => row.props.title)).toEqual(order);
  expect(rows()[1].props.selected).toBe(true);
  expect(rows()[2].props.selected).toBe(false);
  await search('  uSd  ');
  expect(rows().map((row) => row.props.title)).toEqual(['US Dollar']);
  rows()[0].props.onPress();
  expect(mockSave).toHaveBeenCalledWith('USD');
  await search('dollar');
  expect(rows()).toHaveLength(1);
  await search('zzzz');
  expect(rows()).toHaveLength(0);
  expect(
    tree.root
      .findAllByType('Description' as any)
      .some((row) => String(row.props.children).includes('No currencies found')),
  ).toBe(true);
  await search('');
  rows()
    .find((row) => row.props.title === 'None')!
    .props.onPress();
  expect(mockSave).toHaveBeenCalledWith('NONE');
  await act(async () => tree.unmount());
});
