jest.mock('~/shared/ui/PaymentFlowHeader', () => ({ PaymentFlowHeader: 'PaymentFlowHeader' }));
jest.mock('~/shared/hooks/useFlowMint', () => ({
  useFlowMint: () => ({ mintUrl: 'https://mint.test', setMintUrl: jest.fn(), balance: 100 }),
}));
jest.mock('~/shared/ui/PaymentMintRow', () => ({ PaymentMintRow: 'PaymentMintRow' }));
jest.mock('~/shared/ui/ListTable', () => ({
  ListTable: 'ListTable',
  ListTableRow: 'ListTableRow',
}));
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { RequestEcashStage } from '~/features/payments/receive/RequestEcashStage';
import * as Clipboard from 'expo-clipboard';

let mockEncodingFails = true;
const mockToast = { show: jest.fn() };
jest.mock('@tamagui/toast', () => ({ useToastController: () => mockToast }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'AppButton' }));
jest.mock('~/shared/ui/AppIconButton', () => ({ AppIconButton: 'AppIconButton' }));
jest.mock('~/shared/ui/AppPressable', () => ({ AppPressable: 'AppPressable' }));
jest.mock('~/shared/ui/Spinner', () => ({ Spinner: 'Spinner' }));
jest.mock('~/shared/ui/NumericKeypad', () => ({ NumericKeypad: 'NumericKeypad' }));
jest.mock('~/shared/ui/HomeMintSelector', () => ({ MintSelectorSheet: 'MintSelectorSheet' }));
jest.mock('~/shared/ui/MintBalanceRow', () => ({ MintBalanceRow: 'MintBalanceRow' }));
jest.mock('~/shared/ui/BouncyAmount', () => ({ BouncyAmount: 'BouncyAmount' }));
jest.mock('~/shared/ui/Blockies', () => 'Blockies');
jest.mock('~/features/payments/send/ResultStage', () => ({ ResultStage: 'ResultStage' }));
jest.mock('react-native-qrcode-svg', () => 'QRCode');
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn().mockResolvedValue(undefined) }));
jest.mock('~/services/wallet', () => ({ walletService: {}, historyService: {} }));
jest.mock('~/services/wallet/nostrService', () => ({ sendNostrToken: jest.fn() }));
jest.mock('~/services/platform/seedService', () => ({ seedService: {} }));
jest.mock('@cashu/cashu-ts', () => ({
  PaymentRequestTransportType: { NOSTR: 'nostr' },
  PaymentRequest: function () {
    return {
      toEncodedRequest: () => {
        if (mockEncodingFails) throw new Error('Cannot encode request');
        return 'creq-complete-request';
      },
    };
  },
}));
jest.mock('nostr-tools/nip19', () => ({ decode: jest.fn(), nprofileEncode: jest.fn() }));
jest.mock('~/state/walletStore', () => ({
  useWalletStore: () => ({ activeMintUrl: 'https://mint.test', mints: [], balance: 100 }),
}));
jest.mock('~/state/settingsStore', () => ({
  useSettingsStore: Object.assign(
    () => ({ primaryCurrency: 'SATS', secondaryCurrency: 'USD', npub: 'test-public-key' }),
    { getState: () => ({ primaryCurrency: 'SATS' }) },
  ),
}));
jest.mock('~/state/nostrRequestStore', () => ({
  useNostrRequestStore: Object.assign(
    () => ({
      addRequest: jest.fn(),
      pendingRequests: [],
      loadPendingRequests: jest.fn(),
    }),
    { getState: () => ({ requests: [] }), subscribe: () => () => {} },
  ),
}));
jest.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: { price: 100000 } }) }));
jest.mock('~/services/api/bitcoinService', () => ({ bitcoinService: {} }));
jest.mock('~/services/wallet/currencyService', () => ({
  currencyService: { formatValue: () => '$0.01', convertSatsToCurrency: () => 0.01 },
  SUPPORTED_CURRENCIES: [{ code: 'USD', symbol: '$' }],
}));
jest.mock('@tamagui/lucide-icons', () => new Proxy({}, { get: (_, key) => String(key) }));
jest.mock('tamagui', () => ({
  YStack: 'YStack',
  XStack: 'XStack',
  Text: 'Text',
  H1: 'H1',
  Separator: 'Separator',
  ScrollView: 'ScrollView',
  View: 'View',
  Input: 'Input',
  Avatar: 'Avatar',
  Square: 'Square',
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockEncodingFails = true;
});

it('reviews before publishing and keeps generation errors on confirmation with retry available', async () => {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<RequestEcashStage />);
  });
  await act(async () => tree.root.findByType('NumericKeypad' as any).props.onValueChange('10'));
  expect(tree.root.findAllByType('Input' as any)).toHaveLength(0);
  await act(async () => tree.root.findByType('NumericKeypad' as any).props.onConfirm());
  expect(mockToast.show).not.toHaveBeenCalled();
  await act(async () =>
    tree.root
      .findAllByType('ListTableRow' as any)
      .find((n) => n.props.label === 'Add note')!
      .props.onPress(),
  );
  await act(async () => tree.root.findByType('Input' as any).props.onChangeText('Coffee'));
  await act(async () => tree.root.findByType('PaymentFlowHeader' as any).props.onBack());
  await act(async () => tree.root.findByType('NumericKeypad' as any).props.onConfirm());
  expect(
    tree.root.findAllByType('ListTableRow' as any).find((n) => n.props.label === 'Note')!.props
      .value,
  ).toBe('Coffee');
  const createRequest = () =>
    tree.root.findAllByType('AppButton' as any).find((n) => n.props.children === 'Create request')!;
  await act(async () => createRequest().props.onPress());
  expect(mockToast.show).toHaveBeenCalledWith(
    'Request failed: Cannot encode request',
    expect.objectContaining({ kind: 'error' }),
  );
  expect(
    tree.root
      .findAllByType('Text' as any)
      .some((n) => n.props.children === 'Cannot encode request'),
  ).toBe(true);
  expect(createRequest().props.loading).toBe(false);
  expect(createRequest().props.disabled).toBe(false);
  await act(async () => tree.root.findByType('PaymentFlowHeader' as any).props.onBack());
  expect(tree.root.findByType('NumericKeypad' as any).props.value).toBe('10');
  await act(async () => tree.unmount());
});

it('keeps confirmation and request QR actions inset, uses header back, and copies the complete request', async () => {
  mockEncodingFails = false;
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<RequestEcashStage />);
  });
  await act(async () => tree.root.findByType('NumericKeypad' as any).props.onValueChange('10'));
  await act(async () => tree.root.findByType('NumericKeypad' as any).props.onConfirm());
  expect(tree.root.findByProps({ testID: 'payment-stage-layout' }).props.px).toBe('$4');
  expect(tree.root.findByProps({ testID: 'payment-stage-hero' }).props.flex).toBe(1);
  expect(tree.root.findByType('PaymentFlowHeader' as any).props.title).toBe('Confirm request');
  expect(tree.root.findAllByType('AppButton' as any).some((n) => n.props.children === 'Back')).toBe(
    false,
  );
  await act(async () =>
    tree.root
      .findAllByType('AppButton' as any)
      .find((n) => n.props.children === 'Create request')!
      .props.onPress(),
  );
  expect(tree.root.findByType('PaymentFlowHeader' as any).props.title).toBe('Request payment');
  expect(tree.root.findByProps({ testID: 'payment-stage-layout' }).props.px).toBe('$4');
  const footer = tree.root.findByProps({ testID: 'payment-stage-footer' });
  expect(footer.findByType('AppButton' as any).props.children).toBe('Share request');
  expect(
    tree.root.findByType('ScrollView' as any).findAllByProps({ testID: 'payment-stage-footer' }),
  ).toHaveLength(0);
  const frame = tree.root
    .findAllByType('YStack' as any)
    .find((n) => n.props.accessibilityLabel === 'Payment request QR code')!;
  await act(async () => frame.props.onLayout({ nativeEvent: { layout: { width: 300 } } }));
  expect(tree.root.findByType('QRCode' as any).props.value).toBe('creq-complete-request');
  await act(async () =>
    tree.root
      .findAllByType('ListTableRow' as any)
      .find((n) => n.props.label === 'Request')!
      .props.onCopy(),
  );
  expect(Clipboard.setStringAsync).toHaveBeenCalledWith('creq-complete-request');
  await act(async () => tree.unmount());
});
