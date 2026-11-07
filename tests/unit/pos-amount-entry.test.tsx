import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { AmountStage } from '~/features/payments/mint/AmountStage';
const mockSettings: {
  primaryCurrency: 'SATS' | 'FIAT';
  secondaryCurrency: string;
  showBitcoinSymbol: boolean;
} = {
  primaryCurrency: 'SATS',
  secondaryCurrency: 'NONE',
  showBitcoinSymbol: true,
};
let mockPrice: number | undefined = 100_000;

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
  useSettingsStore: Object.assign(() => mockSettings, { getState: () => mockSettings }),
}));
jest.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: { price: mockPrice } }) }));
jest.mock('~/services/api/bitcoinService', () => ({ bitcoinService: {} }));

let tree: ReactTestRenderer;
beforeEach(() => {
  mockSettings.primaryCurrency = 'SATS';
  mockSettings.secondaryCurrency = 'NONE';
  mockPrice = 100_000;
});
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
it('retains the normal minting balance without amount presets outside POS', async () => {
  await act(async () => {
    tree = create(<AmountStage amount="64" setAmount={jest.fn()} onContinue={jest.fn()} />);
  });
  expect(tree.root.findByType('MintRow' as any).props.showBalance).toBe(true);
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Payment note' })).toHaveLength(0);
  expect(tree.root.findByType('Keypad' as any).props.confirmLabel).toBe('Continue');
  expect(tree.root.findAllByType('Text' as any).map((text) => text.props.children)).not.toEqual(
    expect.arrayContaining(['1k', '5k', '20k']),
  );
});

function Entry({ pos = true }: { pos?: boolean }) {
  const [amount, setAmount] = React.useState('0');
  return (
    <AmountStage
      appearance={pos ? 'pos' : 'default'}
      amount={amount}
      setAmount={setAmount}
      onContinue={jest.fn()}
    />
  );
}
const keypad = () => tree.root.findByType('Keypad' as any);
const displayed = () => tree.root.findByType('Amount' as any).props.value;
const sats = () => tree.root.findByType(AmountStage).props.amount;

it('enters fiat minor units in POS, converts to whole sats and deletes one minor-unit digit', async () => {
  mockSettings.primaryCurrency = 'FIAT';
  mockSettings.secondaryCurrency = 'USD';
  await act(async () => {
    tree = create(<Entry />);
  });
  expect(displayed()).toBe('0.00');
  expect(keypad().props.allowDecimal).toBe(false);
  for (const digit of '1234') {
    await act(async () =>
      keypad().props.onValueChange(
        keypad().props.value === '0' ? digit : keypad().props.value + digit,
      ),
    );
  }
  expect(displayed()).toBe('12.34');
  // Keep the existing shared conversion's floor rounding, including float precision.
  expect(sats()).toBe('12339');
  await act(async () => keypad().props.onValueChange(keypad().props.value.slice(0, -1)));
  expect(displayed()).toBe('1.23');
  expect(sats()).toBe('1230');
  await act(async () => keypad().props.onValueChange('0'));
  expect(displayed()).toBe('0.00');
  expect(sats()).toBe('0');
  expect(keypad().props.confirmDisabled).toBe(true);
});

it('blocks POS fiat charging without a rate, then converts the entered cents once a rate arrives', async () => {
  mockSettings.primaryCurrency = 'FIAT';
  mockSettings.secondaryCurrency = 'USD';
  mockPrice = undefined;
  await act(async () => {
    tree = create(<Entry />);
  });
  await act(async () => keypad().props.onValueChange('1234'));
  expect(displayed()).toBe('12.34');
  expect(keypad().props.confirmDisabled).toBe(true);
  expect(sats()).toBe('0');
  mockPrice = 100_000;
  await act(async () => tree.update(<Entry />));
  expect(sats()).toBe('12339');
  expect(keypad().props.confirmDisabled).toBe(false);
});

it('keeps normal fiat decimal entry outside POS and whole sats inside POS', async () => {
  mockSettings.primaryCurrency = 'FIAT';
  mockSettings.secondaryCurrency = 'USD';
  await act(async () => {
    tree = create(<Entry pos={false} />);
  });
  expect(keypad().props.allowDecimal).toBe(true);
  await act(async () => keypad().props.onValueChange('12.34'));
  expect(displayed()).toBe('12.34');
  expect(sats()).toBe('12339');
  await act(async () => tree.unmount());
  mockSettings.primaryCurrency = 'SATS';
  await act(async () => {
    tree = create(<Entry />);
  });
  await act(async () => keypad().props.onValueChange('1234'));
  expect(displayed()).toBe('1,234');
  expect(sats()).toBe('1234');
  expect(keypad().props.allowDecimal).toBe(false);
});
