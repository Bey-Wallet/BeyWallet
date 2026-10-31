import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { AmountStage } from '~/features/payments/mint/AmountStage';

jest.mock('tamagui', () =>
  Object.fromEntries(['YStack', 'XStack', 'Text', 'Input'].map((name) => [name, name])),
);
jest.mock('@tamagui/lucide-icons', () => ({ ArrowUpDown: 'ArrowUpDown' }));
jest.mock('~/shared/ui/AppPressable', () => ({ AppPressable: 'Pressable' }));
jest.mock('~/shared/ui/HomeMintSelector', () => ({ MintSelectorSheet: 'MintSheet' }));
jest.mock('~/shared/ui/NumericKeypad', () => ({ NumericKeypad: 'Keypad' }));
jest.mock('~/shared/ui/BouncyAmount', () => ({ BouncyAmount: 'Amount' }));
jest.mock('~/shared/ui/MintBalanceRow', () => ({
  MintBalanceRow: ({ children, ...props }: any) =>
    require('react').createElement('MintRow', props, children),
}));
jest.mock('~/shared/ui/ListTable', () => ({
  ListTableRow: ({ value, ...props }: any) => require('react').createElement('Row', props, value),
}));
jest.mock('~/state/walletStore', () => ({
  useWalletStore: () => ({ mints: [{ mintUrl: 'mint-a', trusted: true }], balance: 100 }),
}));
jest.mock('~/state/settingsStore', () => ({
  useSettingsStore: () => ({
    primaryCurrency: 'SATS',
    secondaryCurrency: 'NONE',
    showBitcoinSymbol: true,
  }),
}));
jest.mock('@tanstack/react-query', () => ({ useQuery: () => ({}) }));
jest.mock('~/services/api/bitcoinService', () => ({ bitcoinService: {} }));
jest.mock('~/services/wallet/currencyService', () => ({
  SUPPORTED_CURRENCIES: [],
  currencyService: {},
}));
jest.mock('~/shared/hooks/useCurrencyInput', () => ({
  useCurrencyInput: () => ({
    fiatEnabled: false,
    inputMode: 'SATS',
    localInputValue: '64',
    setLocalInputValue: jest.fn(),
  }),
}));

let tree: ReactTestRenderer;
afterEach(async () => {
  await act(async () => tree.unmount());
});
it('keeps mint selection, replaces the POS balance with an editable note, and charges from the keypad', async () => {
  const onNoteChange = jest.fn();
  const onContinue = jest.fn();
  await act(async () => {
    tree = create(
      <AmountStage
        mintUrl="mint-a"
        amount="64"
        setAmount={jest.fn()}
        note="Coffee"
        onNoteChange={onNoteChange}
        onContinue={onContinue}
        confirmLabel="Charge"
      />,
    );
  });
  expect(tree.root.findByType('MintRow' as any).props.showBalance).toBe(false);
  const note = tree.root.findByProps({ accessibilityLabel: 'Payment note' });
  expect(note.props.value).toBe('Coffee');
  await act(async () => note.props.onChangeText('Lunch'));
  expect(onNoteChange).toHaveBeenCalledWith('Lunch');
  const keypad = tree.root.findByType('Keypad' as any);
  expect(keypad.props.confirmLabel).toBe('Charge');
  await act(async () => keypad.props.onConfirm());
  expect(onContinue).toHaveBeenCalledTimes(1);
});
it('retains the normal minting balance and presets outside POS', async () => {
  await act(async () => {
    tree = create(<AmountStage amount="64" setAmount={jest.fn()} onContinue={jest.fn()} />);
  });
  expect(tree.root.findByType('MintRow' as any).props.showBalance).toBe(true);
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Payment note' })).toHaveLength(0);
  expect(tree.root.findByType('Keypad' as any).props.confirmLabel).toBe('Continue');
});
