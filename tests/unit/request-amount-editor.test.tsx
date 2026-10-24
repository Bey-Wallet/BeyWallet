import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { RequestAmountEditor } from '~/features/payments/receive/RequestDetailsEditor';
import { NumericKeypad } from '~/shared/ui/NumericKeypad';
import { useSettingsStore } from '~/state/settingsStore';

let mockPrice: number | undefined = 100_000;
const mockChange = jest.fn();
jest.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: mockPrice ? { price: mockPrice } : undefined }),
}));
jest.mock('~/state/settingsStore', () => ({
  useSettingsStore: require('zustand').create(() => ({})),
}));
jest.mock('~/services/api/bitcoinService', () => ({ bitcoinService: {} }));
jest.mock('tamagui', () =>
  Object.fromEntries(['Text', 'XStack', 'YStack', 'View', 'Separator'].map((name) => [name, name])),
);
jest.mock('@tamagui/lucide-icons', () =>
  Object.fromEntries(
    ['ChevronDown', 'Pencil', 'ArrowUpDown', 'ChevronLeft'].map((name) => [name, name]),
  ),
);
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'AppButton' }));
jest.mock('~/shared/ui/AppIconButton', () => ({ AppIconButton: 'AppIconButton' }));
jest.mock('~/shared/ui/AppPressable', () => ({ AppPressable: 'AppPressable' }));
jest.mock('~/shared/ui/ListTable', () => ({ ListTableRow: 'ListTableRow' }));
jest.mock('~/shared/ui/PaymentMintRow', () => ({ PaymentMintRow: 'PaymentMintRow' }));
jest.mock('~/shared/ui/InputSheet', () => ({ InputSheet: 'InputSheet' }));
jest.mock('~/shared/ui/AppBottomSheet', () => ({
  __esModule: true,
  default: require('react').forwardRef(({ children }: any, ref: any) => {
    const [open, setOpen] = require('react').useState(false);
    require('react').useImperativeHandle(ref, () => ({
      present: () => setOpen(true),
      dismiss: () => setOpen(false),
    }));
    return open ? require('react').createElement('AppBottomSheet', null, children) : null;
  }),
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
}));

let tree: ReactTestRenderer;
const value = () => tree.root.findByType(NumericKeypad).props.value;
const done = () => tree.root.findByType('AppButton' as any);
const type = async (digits: string) => {
  for (const digit of digits) {
    const button = tree.root
      .findAllByType('AppPressable' as any)
      .find((node) =>
        node.findAllByType('Text' as any).some((text) => text.props.children === digit),
      )!;
    await act(async () => button.props.onPress());
  }
};
const open = async (amount = 0) => {
  await act(async () => {
    tree = create(<RequestAmountEditor amount={amount} onChange={mockChange} />);
  });
  await act(async () => tree.root.findByType('ListTableRow' as any).props.onPress());
};
beforeEach(() => {
  jest.clearAllMocks();
  mockPrice = 100_000;
  useSettingsStore.setState({
    primaryCurrency: 'FIAT',
    secondaryCurrency: 'USD',
    showBitcoinSymbol: false,
  });
});
afterEach(async () => {
  await act(async () => tree.unmount());
});

it('accepts a new fiat amount from zero using the real keypad and saves integer sats', async () => {
  await open();
  expect(value()).toBe('0');
  expect(done().props.disabled).toBe(true);
  await type('12.50');
  expect(value()).toBe('12.50');
  expect(done().props.disabled).not.toBe(true);
  await act(async () => done().props.onPress());
  expect(mockChange).toHaveBeenCalledWith(12_500);
});

it('allows fiat cents after switching a zero sat amount to fiat', async () => {
  useSettingsStore.setState({ primaryCurrency: 'SATS' });
  await open();
  await act(async () =>
    tree.root.findByProps({ accessibilityLabel: 'Switch amount currency' }).props.onPress(),
  );
  expect(value()).toBe('0');
  await type('.25');
  expect(value()).toBe('0.25');
  await act(async () => done().props.onPress());
  expect(mockChange).toHaveBeenCalledWith(250);
});

it('does not pad a fiat draft with zeros that block the next digit', async () => {
  await open(1_000);
  expect(value()).toBe('1');
  await type('2');
  expect(value()).toBe('12');
  await act(async () => done().props.onPress());
  expect(mockChange).toHaveBeenCalledWith(12_000);
});

it('keeps decimal validation and permits typing again after deleting back to zero', async () => {
  await open();
  await type('1.23');
  await type('4');
  expect(value()).toBe('1.23');
  for (let i = 0; i < 4; i++) {
    await act(async () =>
      tree.root.findByProps({ accessibilityLabel: 'Delete last digit' }).props.onPress(),
    );
  }
  expect(value()).toBe('0');
  expect(done().props.disabled).toBe(true);
  await type('5');
  expect(value()).toBe('5');
  expect(done().props.disabled).not.toBe(true);
});

it('preserves exact sats when toggling a sub-cent amount without editing it', async () => {
  useSettingsStore.setState({ primaryCurrency: 'SATS' });
  await open(1);
  await act(async () =>
    tree.root.findByProps({ accessibilityLabel: 'Switch amount currency' }).props.onPress(),
  );
  expect(value()).toBe('0');
  await act(async () => done().props.onPress());
  expect(mockChange).toHaveBeenCalledWith(1);
});

it('keeps sat entry available when a fiat exchange rate is unavailable', async () => {
  mockPrice = undefined;
  await open();
  expect(
    tree.root.findByProps({ accessibilityLabel: 'Switch amount currency' }).props.disabled,
  ).toBe(true);
  await type('123');
  await type('.');
  expect(value()).toBe('123');
  await act(async () => done().props.onPress());
  expect(mockChange).toHaveBeenCalledWith(123);
});

it('hides conversions and decimals for None even with FIAT saved, and rejects fractional input', async () => {
  useSettingsStore.setState({ secondaryCurrency: 'NONE' });
  mockPrice = undefined;
  await open(123);
  expect(value()).toBe('123');
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Switch amount currency' })).toHaveLength(
    0,
  );
  expect(tree.root.findByType(NumericKeypad).props.allowDecimal).toBe(false);
  expect(tree.root.findAllByType('Text' as any).some((node) => node.props.children === '.')).toBe(
    false,
  );
  await act(async () => tree.root.findByType(NumericKeypad).props.onValueChange('1.5'));
  expect(value()).toBe('123');
  await act(async () => done().props.onPress());
  expect(mockChange).toHaveBeenCalledWith(123);
});

it('keeps an open editor draft in exact sats when None is selected', async () => {
  await open(1234);
  await act(async () => useSettingsStore.setState({ secondaryCurrency: 'NONE' }));
  expect(value()).toBe('1234');
  await act(async () => done().props.onPress());
  expect(mockChange).toHaveBeenCalledWith(1234);
  expect(useSettingsStore.getState().primaryCurrency).toBe('FIAT');
});
