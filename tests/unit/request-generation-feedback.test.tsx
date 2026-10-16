import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { RequestEcashStage } from '~/features/payments/receive/RequestEcashStage';

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
jest.mock('~/services/wallet', () => ({ walletService: {}, historyService: {} }));
jest.mock('~/services/wallet/nostrService', () => ({ sendNostrToken: jest.fn() }));
jest.mock('~/services/platform/seedService', () => ({ seedService: {} }));
jest.mock('@cashu/cashu-ts', () => ({
  PaymentRequestTransportType: { NOSTR: 'nostr' },
  PaymentRequest: function () {
    return {
      toEncodedRequest: () => {
        throw new Error('Cannot encode request');
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
  useNostrRequestStore: () => ({
    addRequest: jest.fn(),
    pendingRequests: [],
    loadPendingRequests: jest.fn(),
  }),
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

it('keeps a request-generation error inline on the amount stage and leaves retry available', async () => {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<RequestEcashStage />);
  });
  await act(async () => tree.root.findByType('NumericKeypad' as any).props.onValueChange('10'));
  await act(async () => tree.root.findByType('NumericKeypad' as any).props.onConfirm());
  expect(mockToast.show).toHaveBeenCalledWith(
    'Request failed: Cannot encode request',
    expect.objectContaining({ kind: 'error' }),
  );
  expect(
    tree.root
      .findAllByType('Text' as any)
      .some((n) => n.props.children === 'Cannot encode request'),
  ).toBe(true);
  expect(tree.root.findByType('NumericKeypad' as any).props.isLoading).toBe(false);
  expect(tree.root.findByType('NumericKeypad' as any).props.confirmDisabled).toBe(false);
  await act(async () => tree.unmount());
});
