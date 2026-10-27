import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { CurrencySettingsScreen } from '~/features/settings/PreferenceScreens';

const mockSave = jest.fn();
const mockSettings = { secondaryCurrency: 'NGN', setSecondaryCurrency: mockSave };
jest.mock('~/state/settingsStore', () => ({
  useSettingsStore: (select: (state: unknown) => unknown) => select(mockSettings),
}));
jest.mock('~/services/api/bitcoinService', () => ({ bitcoinService: {} }));
jest.mock('~/features/settings/components/SettingsLayout', () => ({
  SettingsPage: 'Page',
  SettingsDescription: 'Description',
  SettingsGroup: 'Group',
  SettingsRow: 'Row',
}));

it('shows all 25 currencies including PLN/CZK immediately plus None, without a More step', async () => {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<CurrencySettingsScreen />);
  });
  try {
    const rows = tree.root.findAllByType('Row' as any);
    expect(rows).toHaveLength(26);
    expect(rows[0].props.title).toBe('None');
    const codes = rows.slice(1).map((row) => row.props.value);
    expect(codes).toEqual(
      expect.arrayContaining(['NGN', 'THB', 'EUR', 'GBP', 'CHF', 'SEK', 'PLN', 'CZK']),
    );
    for (const code of ['VND', 'PHP', 'IDR', 'ARS']) expect(codes).not.toContain(code);
    expect(rows.some((row) => /more/i.test(row.props.title))).toBe(false);
    expect(rows.find((row) => row.props.value === 'NGN')?.props.selected).toBe(true);
    await act(async () => rows.find((row) => row.props.value === 'THB')!.props.onPress());
    expect(mockSave).toHaveBeenCalledWith('THB');
  } finally {
    await act(async () => tree.unmount());
  }
});
