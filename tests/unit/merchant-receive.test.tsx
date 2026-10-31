import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { MerchantReceiveScreen } from '~/features/payments/receive/MerchantReceiveScreen';

const mockWallet = {
  activeMintUrl: 'mint-a',
  balances: {},
  mints: [
    { mintUrl: 'mint-a', trusted: true },
    { mintUrl: 'mint-b', trusted: true },
  ],
  refreshBalance: jest.fn(),
};
const mockBusy = jest.fn();
jest.mock('~/state/walletStore', () => ({
  useWalletStore: Object.assign(
    (select: (state: typeof mockWallet) => unknown) => select(mockWallet),
    { getState: () => mockWallet },
  ),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), canGoBack: () => true }),
  Stack: { Screen: 'Screen' },
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 16 }) }));
jest.mock('tamagui', () => ({ Text: 'Text', XStack: 'XStack', YStack: 'YStack' }));
jest.mock('~/features/settings/hooks/useSettingsBusy', () => ({
  useSettingsBusy: (busy: boolean) => mockBusy(busy),
}));
jest.mock('~/features/payments/mint/AmountStage', () => ({ AmountStage: 'AmountStage' }));
jest.mock('~/shared/ui/PaymentFlowHeader', () => ({ PaymentFlowHeader: 'Header' }));
jest.mock('~/shared/ui/PaymentAmount', () => ({ PaymentAmount: 'Amount' }));
jest.mock('~/shared/ui/PaymentStatusIcon', () => ({ PaymentStatusIcon: 'Status' }));
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'Button' }));
jest.mock('~/shared/ui/AppPressable', () => ({ AppPressable: 'Method' }));
jest.mock('~/shared/ui/PaymentStageLayout', () => ({
  PaymentStageLayout: ({ hero, footer }: any) => (
    <>
      {hero}
      {footer}
    </>
  ),
}));
jest.mock('~/features/payments/receive/RequestEcashStage', () => ({ RequestEcashStage: 'Ecash' }));
jest.mock('~/features/payments/receive/MerchantLightningStage', () => ({
  MerchantLightningStage: 'Lightning',
}));
let tree: ReactTestRenderer;
const amount = () => tree.root.findByType('AmountStage' as any);
const ecash = () => tree.root.findByType('Ecash' as any);
const method = (label: string) => tree.root.findByProps({ accessibilityLabel: label });
beforeEach(() => jest.clearAllMocks());
afterEach(async () => {
  await act(async () => tree?.unmount());
});
async function open() {
  await act(async () => {
    tree = create(<MerchantReceiveScreen />);
  });
}
async function charge() {
  await act(async () => amount().props.setAmount('64'));
  await act(async () => amount().props.onContinue());
}
it('charges once, preserves both receivers across switches, and starts a clean next sale', async () => {
  await open();
  expect(tree.root.findByType('Screen' as any).props.options.headerShown).toBe(true);
  await act(async () => amount().props.onNoteChange('Coffee'));
  await act(async () => amount().props.onMintChange('mint-b'));
  await charge();
  expect(ecash().props.merchant).toMatchObject({
    amount: 64,
    mintUrl: 'mint-b',
    active: true,
    note: 'Coffee',
  });
  expect(tree.root.findAllByType('Lightning' as any)).toHaveLength(0);
  await act(async () => method('Lightning').props.onPress());
  const invoiceReceiver = tree.root.findByType('Lightning' as any);
  expect(invoiceReceiver.props).toMatchObject({ amount: 64, mintUrl: 'mint-b', note: 'Coffee' });
  expect(ecash().props.merchant.active).toBe(false);
  await act(async () => method('Ecash').props.onPress());
  expect(tree.root.findByType('Lightning' as any)).toBe(invoiceReceiver);
  // A payment to the previously displayed Lightning QR still completes this sale.
  await act(async () => invoiceReceiver.props.onReceived());
  expect(tree.root.findByType('Status' as any).props.status).toBe('success');
  expect(tree.root.findByType('Lightning' as any).props.listening).toBe(false);
  expect(ecash().props.merchant.completed).toBe(true);
  expect(ecash().props.merchant.active).toBe(false);
  await act(async () => ecash().props.merchant.onReceived());
  expect(mockWallet.refreshBalance).toHaveBeenCalledTimes(1);
  await act(async () => tree.root.findByType('Button' as any).props.onPress());
  expect(amount().props.amount).toBe('0');
  expect(amount().props.note).toBe('');
  expect(amount().props.mintUrl).toBe('mint-b');
  expect(mockWallet.activeMintUrl).toBe('mint-a');
  expect(tree.root.findAllByType('Lightning' as any)).toHaveLength(0);
});
it('blocks method changes and closing during an in-flight receipt', async () => {
  await open();
  await charge();
  await act(async () => ecash().props.merchant.onBusyChange(true));
  expect(mockBusy).toHaveBeenLastCalledWith(true);
  expect(method('Lightning').props.disabled).toBe(true);
  await act(async () => method('Lightning').props.onPress());
  expect(tree.root.findAllByType('Lightning' as any)).toHaveLength(0);
  expect(tree.root.findByType('Header' as any).props.disabled).toBe(true);
});
it('rejects invalid amounts and untrusted mints before creating either request', async () => {
  await open();
  for (const value of ['0', '-1', '1.5', 'NaN']) {
    await act(async () => amount().props.setAmount(value));
    await act(async () => amount().props.onContinue());
    expect(tree.root.findAllByType('Ecash' as any)).toHaveLength(0);
  }
  await act(async () => amount().props.onMintChange('unknown-mint'));
  await charge();
  expect(tree.root.findAllByType('Ecash' as any)).toHaveLength(0);
});
