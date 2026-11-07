jest.mock('~/shared/ui/AppPressable', () => ({ AppPressable: 'Pressable' }));
jest.mock('~/shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ReceiptImageShare } from '~/features/history/components/ReceiptImageShare';
import { buildShareableReceipt } from '~/features/history/shareableReceipt';
import BeyIcon from '~/shared/icons/BeyIcon';
import QRCode from 'qrcode';
import { shareReceiptImage } from '~/services/platform/receiptImageService';
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
    formatValue: (value: number) => `$\u202f${value.toFixed(2)}`,
  },
}));
jest.mock('~/services/platform/receiptImageService', () => ({ shareReceiptImage: jest.fn() }));
jest.mock('tamagui', () => ({
  useThemeName: () => (mockDark ? 'dark' : 'light'),
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
jest.mock('~/shared/ui/BUI/BUISheet', () => ({
  __esModule: true,
  BUISheet: require('react').forwardRef(({ children }: any, ref: any) => {
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
  jest.clearAllMocks();
  mockPrimary = 'SATS';
  mockPrice = 100000;
  mockDark = false;
});
afterEach(async () => {
  await act(async () => tree?.unmount());
  jest.restoreAllMocks();
});
async function open(value = receipt, ecashToken?: string) {
  await act(async () => {
    tree = create(<ReceiptImageShare receipt={value} ecashToken={ecashToken} />);
  });
  await act(async () => tree.root.findByType('Button' as any).props.onPress());
}
const texts = () => tree.root.findAllByType('SvgText' as any).map((node) => node.props.children);
const ecashReceipt = buildShareableReceipt({
  id: 'pending-ecash',
  amount: 1234,
  type: 'send',
  state: 'unclaimed',
  unit: 'sat',
  mintUrl: 'https://mint.example/Bitcoin',
  createdAt: Date.now(),
})!;

it('opens the same pending ecash image preview from an accessible header icon', async () => {
  await act(async () => {
    tree = create(
      <ReceiptImageShare receipt={ecashReceipt} ecashToken="cashuBsynthetic" iconOnly />,
    );
  });
  const button = tree.root.findByProps({ accessibilityLabel: 'Share receipt image' });
  expect(button.props.icon).toBe('Share2');
  expect(tree.root.findAllByType('Button' as any)).toHaveLength(0);
  await act(async () => button.props.onPress());
  expect(tree.root.findByProps({ testID: 'receipt-qr' })).toBeDefined();
  expect(texts()).toContain('Ecash to share');
});

it.each([false, true])(
  'exports the entire pending ecash token in a compact themed receipt (dark=%s)',
  async (dark) => {
    mockDark = dark;
    const token = 'cashuBsynthetic';
    const encode = jest.spyOn(QRCode, 'create');
    await open(ecashReceipt, token);
    expect(encode).toHaveBeenCalledWith(token, { errorCorrectionLevel: 'M' });
    expect(tree.root.findAllByType('Rect' as any)[0].props).toMatchObject({
      height: 888,
      fill: dark ? '#17171A' : 'hsl(0, 0%, 96%)',
    });
    const qr = tree.root.findByProps({ testID: 'receipt-qr' });
    expect(qr.props.transform).toMatch(/^translate\(48 164\)/);
    expect(qr.findByType('Path' as any).props.d).toMatch(/^M/);
    expect(texts()).toEqual(
      expect.arrayContaining([
        'Ecash to share',
        '₿\u202f1,234',
        '≈ $\u202f1.23',
        'Pending',
        'Ecash payment',
        'https://mint.example',
      ]),
    );
    expect(texts()).not.toContain('Direction');
    expect(tree.root.findAllByProps({ testID: 'receipt-outcome-icon' })).toHaveLength(0);
  },
);

it('keeps regular ecash receipts token-free unless token export is explicitly requested', async () => {
  await open(ecashReceipt);
  expect(tree.root.findAllByProps({ testID: 'receipt-qr' })).toHaveLength(0);
  expect(texts()).toContain('Ecash payment');
  expect(ecashReceipt.qr).toBeUndefined();
});

it('shares the compact ecash receipt at its full export dimensions', async () => {
  await open(ecashReceipt, 'cashuBsynthetic');
  const share = tree.root
    .findAllByType('Button' as any)
    .find((node) => node.props.children === 'Share image')!;
  await act(async () => share.props.onPress());
  expect(shareReceiptImage).toHaveBeenCalledWith(expect.anything(), { width: 1280, height: 1776 });
});

it('does not put an animated token fragment into a static receipt image', async () => {
  await open(ecashReceipt, 'cashuB' + 'x'.repeat(900));
  expect(tree.root.findAllByProps({ testID: 'receipt-qr' })).toHaveLength(0);
  expect(texts()).toContain('Ecash payment');
  expect(
    tree.root
      .findAllByType('Text' as any)
      .some((node) => String(node.props.children).includes('animated QR')),
  ).toBe(true);
});

it.each(['Confirmed', 'Refunded', 'Failed'] as const)(
  'does not export spendable ecash from a %s receipt',
  async (status) => {
    await open({ ...ecashReceipt, status }, 'cashuBsynthetic');
    expect(tree.root.findAllByProps({ testID: 'receipt-qr' })).toHaveLength(0);
  },
);

it('previews both currencies, type and pending label with a real request QR matrix', async () => {
  await open();
  expect(texts()).toEqual(
    expect.arrayContaining(['₿\u202f1,234', '≈ $\u202f1.23', 'Lightning top-up', 'Pending']),
  );
  const qr = tree.root
    .findAllByType('G' as any)
    .find((node) => node.props.transform?.startsWith('translate(48 184)'))!;
  expect(qr.findByType('Path' as any).props.d).toMatch(/^M/);
  expect(tree.root.findAllByProps({ testID: 'receipt-outcome-icon' })).toHaveLength(0);
});
it('uses fiat as primary when selected and bitcoin as the secondary amount', async () => {
  mockPrimary = 'FIAT';
  await open();
  expect(texts()).toEqual(expect.arrayContaining(['$\u202f1.23', '≈ ₿\u202f1,234']));
});
it('does not invent a fiat conversion when price data is unavailable', async () => {
  mockPrimary = 'FIAT';
  mockPrice = undefined;
  await open();
  expect(texts()).toContain('Conversion unavailable');
  expect(texts()).toContain('≈ ₿\u202f1,234');
});

it('uses the active dark theme and keeps the payable QR above amounts and left aligned', async () => {
  mockDark = true;
  await open();
  expect(tree.root.findAllByType('Rect' as any)[0].props.fill).toBe('#17171A');
  const amount = tree.root
    .findAllByType('SvgText' as any)
    .find((node) => node.props.children === '₿\u202f1,234')!;
  expect(amount.props.fill).toBe('#FFFFFF');
  expect(amount.props.x).toBe(48);
  const qr = tree.root
    .findAllByType('G' as any)
    .find((node) => node.props.transform?.startsWith('translate(48 184)'))!;
  expect(qr).toBeDefined();
  expect(amount.props.y).toBeGreaterThan(590);
  expect(qr.findByType('Rect' as any).props.fill).toBe('#FFFFFF');
  expect(tree.root.findByType(BeyIcon).props.color).toBe('#FFFFFF');
});

it('uses the existing Bey logo in light receipts and keeps the header minimal', async () => {
  await open();
  expect(tree.root.findByType(BeyIcon).props).toMatchObject({ size: 32, color: '#000000' });
  expect(texts()).not.toContain('Receipt');
  expect(texts()).not.toContain('bey');
  expect(texts()).toContain('Lightning top-up');
  expect(texts()).toContain('Bey');
  expect(texts()).not.toContain('Status');
  expect(texts()).not.toContain('Mint');
  expect(texts()).not.toContain('PAYMENT RECEIPT');
  expect(texts()).not.toContain('Total amount');
});

it.each([false, true])(
  'keeps the small Bey footer right-aligned and muted on the card surface in dark=%s',
  async (dark) => {
    mockDark = dark;
    await open();
    expect(tree.root.findAllByProps({ testID: 'receipt-promotion-background' })).toHaveLength(0);
    const promotion = tree.root
      .findAllByType('SvgText' as any)
      .find((node) => node.props.children === 'bey.cash')!;
    expect(promotion.props).toMatchObject({
      x: 592,
      textAnchor: 'end',
      fontSize: 16,
      fill: dark ? '#8D8D93' : '#6B6B73',
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
  'shows a compact %s outcome in the header without changing its meaning',
  async (status, icon, color) => {
    await open({ ...receipt, status, qr: undefined });
    const outcome = tree.root.findByProps({ testID: 'receipt-outcome-icon' });
    expect(outcome.findByType(icon as any).props).toMatchObject({ size: 32, color });
    const statusText = tree.root
      .findAllByType('SvgText' as any)
      .find((node) => node.props.children === status)!;
    expect(statusText.props).toMatchObject({ y: 72, x: 592, textAnchor: 'end' });
  },
);
