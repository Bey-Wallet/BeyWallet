import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ReceiptImageShare } from '~/features/history/components/ReceiptImageShare';
import { buildShareableReceipt } from '~/features/history/shareableReceipt';
import BeyIcon from '~/shared/icons/BeyIcon';
let mockPrimary = 'SATS';
let mockPrice: number | undefined = 100000;
let mockDark = false;
jest.mock('~/state/settingsStore', () => ({
  useSettingsStore: () => ({
    primaryCurrency: mockPrimary,
    secondaryCurrency: 'USD',
    showBitcoinSymbol: true,
  }),
}));
jest.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: { price: mockPrice } }) }));
jest.mock('~/services/api/bitcoinService', () => ({ bitcoinService: {} }));
jest.mock('~/services/wallet/currencyService', () => ({
  currencyService: {
    convertSatsToCurrency: (sats: number, price: number) => (sats / 1e8) * price,
    formatValue: (value: number) => `$${value.toFixed(2)}`,
  },
}));
jest.mock('~/services/platform/receiptImageService', () => ({ shareReceiptImage: jest.fn() }));
jest.mock('tamagui', () => ({
  Text: 'Text',
  YStack: 'YStack',
  XStack: 'XStack',
  useTheme: () => ({ background: { val: mockDark ? '#000000' : '#FFFFFF' } }),
}));
jest.mock('@tamagui/lucide-icons', () => ({
  Share2: 'Share2',
  X: 'X',
  Check: 'Check',
  Clock: 'Clock',
  Minus: 'Minus',
  ArrowDownLeft: 'ArrowDownLeft',
}));
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'Button' }));
jest.mock('~/shared/ui/HeaderIconButton', () => ({ HeaderIconButton: 'Close' }));
jest.mock('@gorhom/bottom-sheet', () => ({ BottomSheetScrollView: 'Scroll' }));
jest.mock('~/shared/ui/AppBottomSheet', () => ({
  __esModule: true,
  default: require('react').forwardRef(({ children }: any, ref: any) => {
    require('react').useImperativeHandle(ref, () => ({ present: jest.fn() }));
    return children;
  }),
}));
jest.mock('react-native-svg', () => ({
  __esModule: true,
  default: require('react').forwardRef(({ children }: any, ref: any) => {
    require('react').useImperativeHandle(ref, () => ({ toDataURL: jest.fn() }));
    return children;
  }),
  Rect: 'Rect',
  Text: 'SvgText',
  Line: 'Line',
  G: 'G',
  Path: 'Path',
  Circle: 'Circle',
  Defs: 'Defs',
  Mask: 'Mask',
}));

const receipt = buildShareableReceipt(
  {
    id: 'private',
    amount: 1234,
    type: 'mint',
    state: 'UNPAID',
    unit: 'sat',
    mintUrl: 'private',
    createdAt: Date.now(),
  },
  { invoice: 'lnbc123synthetic' },
)!;
let tree: ReactTestRenderer;
beforeEach(() => {
  mockPrimary = 'SATS';
  mockPrice = 100000;
  mockDark = false;
});
afterEach(async () => {
  await act(async () => tree?.unmount());
});
async function open(value = receipt) {
  await act(async () => {
    tree = create(<ReceiptImageShare receipt={value} />);
  });
  await act(async () => tree.root.findByType('Button' as any).props.onPress());
}
const texts = () => tree.root.findAllByType('SvgText' as any).map((node) => node.props.children);
it('previews both currencies, type and pending label with a real request QR matrix', async () => {
  await open();
  expect(texts()).toEqual(
    expect.arrayContaining(['₿1,234', '≈ $1.23', 'Lightning top-up', 'Pending']),
  );
  const qr = tree.root
    .findAllByType('G' as any)
    .find((node) => node.props.transform?.startsWith('translate(48 200)'))!;
  expect(qr.findByType('Path' as any).props.d).toMatch(/^M/);
  expect(tree.root.findAllByProps({ testID: 'receipt-outcome-icon' })).toHaveLength(0);
});
it('uses fiat as primary when selected and bitcoin as the secondary amount', async () => {
  mockPrimary = 'FIAT';
  await open();
  expect(texts()).toEqual(expect.arrayContaining(['$1.23', '≈ ₿1,234']));
});
it('does not invent a fiat conversion when price data is unavailable', async () => {
  mockPrimary = 'FIAT';
  mockPrice = undefined;
  await open();
  expect(texts()).toContain('Conversion unavailable');
  expect(texts()).toContain('≈ ₿1,234');
});

it('uses the active dark theme and keeps the payable QR above amounts and left aligned', async () => {
  mockDark = true;
  await open();
  expect(tree.root.findAllByType('Rect' as any)[0].props.fill).toBe('#000000');
  const amount = tree.root
    .findAllByType('SvgText' as any)
    .find((node) => node.props.children === '₿1,234')!;
  expect(amount.props.fill).toBe('#FFFFFF');
  const qr = tree.root
    .findAllByType('G' as any)
    .find((node) => node.props.transform?.startsWith('translate(48 200)'))!;
  expect(qr).toBeDefined();
  expect(amount.props.y).toBeGreaterThan(590);
  expect(qr.findByType('Rect' as any).props.fill).toBe('#FFFFFF');
  expect(tree.root.findByType(BeyIcon).props.color).toBe('#FFFFFF');
});

it('uses the existing Bey logo in light receipts and keeps the header minimal', async () => {
  await open();
  expect(tree.root.findByType(BeyIcon).props).toMatchObject({ size: 42, color: '#000000' });
  expect(texts()).not.toContain('Receipt');
  expect(texts()).not.toContain('bey');
  expect(texts()).toContain('Payment summary');
  expect(texts()).not.toContain('PAYMENT RECEIPT');
  expect(texts()).not.toContain('Total amount');
});

it.each([false, true])(
  'keeps the footer centered and muted on the receipt background in dark=%s',
  async (dark) => {
    mockDark = dark;
    await open();
    expect(tree.root.findAllByProps({ testID: 'receipt-promotion-background' })).toHaveLength(0);
    const promotion = tree.root
      .findAllByType('SvgText' as any)
      .find((node) => node.props.children === 'Download Bey Wallet @ bey.cash')!;
    expect(promotion.props).toMatchObject({
      x: 320,
      textAnchor: 'middle',
      fontSize: 16,
      opacity: 0.5,
      fill: dark ? '#FFFFFF' : '#000000',
    });
  },
);

it.each([
  ['Confirmed', 'Check', '#25B86F'],
  ['Failed', 'X', '#FF3B30'],
  ['Cancelled', 'Minus', '#F5A73B'],
  ['Expired', 'Clock', '#F5A73B'],
  ['Refunded', 'ArrowDownLeft', '#25B86F'],
] as const)(
  'shows a large %s outcome beside the amount and status in the rows',
  async (status, icon, color) => {
    await open({ ...receipt, status, qr: undefined });
    const outcome = tree.root.findByProps({ testID: 'receipt-outcome-icon' });
    expect(outcome.findByType(icon as any).props.size).toBe(40);
    expect(outcome.findByType('Circle' as any).props.fill).toBe(color);
    const statusText = tree.root
      .findAllByType('SvgText' as any)
      .find((node) => node.props.children === status)!;
    expect(statusText.props.y).toBe(396);
  },
);
