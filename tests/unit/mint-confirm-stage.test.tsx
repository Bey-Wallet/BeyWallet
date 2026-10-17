jest.mock('~/shared/ui/PaymentFlowHeader', () => ({ PaymentFlowHeader: 'PaymentFlowHeader' }));
jest.mock('~/shared/ui/PaymentMintRow', () => ({ PaymentMintRow: 'PaymentMintRow' }));
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ConfirmStage } from '~/features/payments/mint/ConfirmStage';
import { useQuery } from '@tanstack/react-query';

let mockPrimaryCurrency = 'SATS';
let mockPrice: number | undefined = 100000;

jest.mock('tamagui', () => ({
  YStack: 'YStack',
  Text: 'Text',
  ScrollView: 'ScrollView',
}));
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'AppButton' }));
jest.mock('~/shared/ui/ListTable', () => ({
  ListTable: 'ListTable',
  ListTableRow: 'ListTableRow',
}));
jest.mock('~/state/walletStore', () => ({
  useWalletStore: () => ({ mints: [{ mintUrl: 'https://mint.example', nickname: 'My mint' }] }),
}));
jest.mock('~/state/settingsStore', () => ({
  useSettingsStore: () => ({
    primaryCurrency: mockPrimaryCurrency,
    secondaryCurrency: 'USD',
    showBitcoinSymbol: false,
  }),
}));
jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(({ queryKey }: { queryKey: string[] }) => ({
    data: queryKey[0] === 'bitcoinPrice' ? { price: mockPrice } : 0,
  })),
}));
jest.mock('~/services/api/bitcoinService', () => ({ bitcoinService: {} }));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Medium: 'medium' },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockPrimaryCurrency = 'SATS';
  mockPrice = 100000;
});

it('uses icon-free list rows and does not estimate top-up fees from keyset fees', async () => {
  const { tree } = await render();
  expect(tree.root.findAllByType('ListTable' as any)).toHaveLength(1);
  const rows = tree.root.findAllByType('ListTableRow' as any);
  expect(rows.map(({ props }) => [props.label, props.value])).toEqual([
    ['Mint', 'My mint'],
    ['Method', 'Lightning'],
    ['Lightning fee', 'Set by paying wallet'],
  ]);
  expect(rows.every(({ props }) => !props.icon && !props.iconAfter)).toBe(true);
  expect(useQuery).toHaveBeenCalledTimes(1);
  expect(useQuery).toHaveBeenCalledWith(
    expect.objectContaining({ queryKey: ['bitcoinPrice', 'USD'] }),
  );
  await act(async () => tree.unmount());
});

async function render(isLoading = false) {
  let tree!: ReactTestRenderer;
  const onConfirm = jest.fn();
  await act(async () => {
    tree = create(
      <ConfirmStage
        amount="10000"
        mintUrl="https://mint.example/"
        isLoading={isLoading}
        onConfirm={onConfirm}
        onBack={jest.fn()}
      />,
    );
  });
  return { tree, onConfirm };
}

it.each([
  ['SATS', '10,000 SATS', '≈ $10.00'],
  ['FIAT', '$10.00', '≈ 10,000 SATS'],
])('keeps %s primary and the conversion secondary', async (currency, primary, secondary) => {
  mockPrimaryCurrency = currency;
  const { tree } = await render();
  expect(tree.root.findByProps({ testID: 'mint-confirm-primary-amount' }).props.children).toBe(
    primary,
  );
  expect(tree.root.findByProps({ testID: 'mint-confirm-secondary-amount' }).props.children).toBe(
    secondary,
  );
  await act(async () => tree.unmount());
});

it('shows an unavailable conversion instead of a zero estimate', async () => {
  mockPrice = undefined;
  const { tree } = await render();
  expect(tree.root.findByProps({ testID: 'mint-confirm-primary-amount' }).props.children).toBe(
    '10,000 SATS',
  );
  expect(tree.root.findByProps({ testID: 'mint-confirm-secondary-amount' }).props.children).toBe(
    'Conversion unavailable',
  );
  await act(async () => tree.unmount());
});

it('creates an invoice through the existing confirmation callback', async () => {
  const { tree, onConfirm } = await render();
  const button = tree.root.findByType('AppButton' as any);
  expect(button.props.children).toBe('Create invoice');
  await act(async () => button.props.onPress());
  expect(onConfirm).toHaveBeenCalledTimes(1);
  await act(async () => tree.unmount());
});

it('disables the action while creating the invoice', async () => {
  const { tree } = await render(true);
  expect(tree.root.findByType('AppButton' as any).props).toMatchObject({
    disabled: true,
    loading: true,
    loadingText: 'Creating Lightning invoice…',
  });
  await act(async () => tree.unmount());
});
