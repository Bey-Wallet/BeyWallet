import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { UniversalInputCard, type UniversalInputCardRef } from '~/shared/ui/UniversalInputCard';
import {
  resolveUniversalInput,
  type UniversalInputType,
} from '~/shared/utils/universalInputResolver';

const mockPush = jest.fn(),
  mockClipboard = jest.fn(),
  mockToast = jest.fn(),
  mockScanner = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('expo-clipboard', () => ({ getStringAsync: () => mockClipboard() }));
jest.mock('@tamagui/toast', () => ({ useToastController: () => ({ show: mockToast }) }));
jest.mock('~/shared/utils/universalInputResolver', () => ({ resolveUniversalInput: jest.fn() }));
jest.mock('~/state/walletStore', () => ({
  useWalletStore: { getState: () => ({ setScannerResult: mockScanner }) },
}));
jest.mock('~/shared/ui/OperationFeedback', () => ({ usePendingOperationToast: jest.fn() }));
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'Button' }));
jest.mock('~/shared/ui/AppIconButton', () => ({ AppIconButton: 'IconButton' }));
jest.mock('@tamagui/lucide-icons', () => ({
  X: 'X',
  Clipboard: 'Clipboard',
  ArrowRight: 'ArrowRight',
  Zap: 'Zap',
  Send: 'Send',
  Bitcoin: 'Bitcoin',
  Users: 'Users',
  CheckCircle2: 'CheckCircle2',
  Search: 'Search',
}));
jest.mock('tamagui', () => {
  const React = require('react');
  return {
    YStack: 'YStack',
    XStack: 'XStack',
    Text: 'Text',
    View: 'View',
    Input: React.forwardRef((props: any, ref: any) => {
      const [text, setText] = React.useState('');
      React.useImperativeHandle(ref, () => ({
        clear: () => setText(''),
        setNativeProps: (value: any) => setText(value.text),
        focus: jest.fn(),
      }));
      return React.createElement('Input', { ...props, nativeText: text });
    }),
  };
});

let tree: ReactTestRenderer;
let ref: React.RefObject<UniversalInputCardRef | null>;
const mockBusy = jest.fn(),
  mockBeforeRedirect = jest.fn();
const resolver = jest.mocked(resolveUniversalInput);
const field = () => tree.root.findByType('Input' as any);
const button = (label: string) =>
  tree.root.findAllByType('Button' as any).find((node) => node.props.children === label)!;
async function open(compact = false) {
  ref = React.createRef<UniversalInputCardRef>();
  await act(async () => {
    tree = create(
      <UniversalInputCard
        ref={ref}
        layout={compact ? 'inline' : 'stacked'}
        compact={compact}
        label="Payment details"
        onBeforeRedirect={mockBeforeRedirect}
        onProcessingChange={mockBusy}
      />,
    );
  });
}
async function type(value: string) {
  await act(async () => field().props.onChangeText(value));
}
beforeEach(() => {
  jest.clearAllMocks();
  resolver
    .mockReset()
    .mockResolvedValue({ type: 'cashu_token', raw: 'fixture', cleaned: 'cashu-complete-token' });
  mockClipboard.mockReset().mockResolvedValue('  cashu-complete-token  ');
});
afterEach(async () => {
  await act(async () => tree?.unmount());
});

it('shows two full-width input lines above Paste, Clear, and Continue actions', async () => {
  await open();
  expect(field().props).toMatchObject({
    multiline: true,
    numberOfLines: 2,
    height: 56,
    width: '100%',
    fontFamily: '$body',
  });
  expect(button('Paste')).toBeTruthy();
  expect(button('Continue')).toBeUndefined();
  await type('payment draft');
  expect(button('Paste')).toBeTruthy();
  expect(button('Continue').props.emphasis).toBe('primary');
  await act(async () =>
    tree.root.findByProps({ accessibilityLabel: 'Clear input' }).props.onPress(),
  );
  expect(button('Continue')).toBeUndefined();
  expect(mockPush).not.toHaveBeenCalled();
});

it.each([
  [
    'cashu_token',
    { pathname: '/(modals)/receive', params: { mode: 'receive', scannedToken: 'payment-value' } },
  ],
  ['cashu_request', { pathname: '/(modals)/send', params: { paymentRequest: 'payment-value' } }],
  ['lightning_invoice', '/(modals)/melt'],
  ['lightning_address', '/(modals)/melt'],
  ['bitcoin_onchain', '/(modals)/melt?mode=onchain'],
] as const)('resolves pasted %s from the compact sheet input', async (inputType, destination) => {
  mockClipboard.mockResolvedValueOnce('  payment-value  ');
  resolver.mockResolvedValueOnce({
    type: inputType,
    raw: 'payment-value',
    cleaned: 'payment-value',
  });
  await open(true);
  expect(field().props).toMatchObject({
    multiline: true,
    numberOfLines: 3,
    height: 96,
    accessibilityLabel: 'Payment details',
  });
  await act(async () => button('Paste').props.onPress());
  expect(resolver).toHaveBeenCalledWith('payment-value');
  expect(mockPush).toHaveBeenCalledWith(destination);
  expect(mockBeforeRedirect.mock.invocationCallOrder[0]).toBeLessThan(
    mockPush.mock.invocationCallOrder[0],
  );
});

it('retains manual entry and Go in the compact sheet input', async () => {
  await open(true);
  await type('cashu-complete-token');
  await act(async () => button('Go').props.onPress());
  expect(resolver).toHaveBeenCalledWith('cashu-complete-token');
  expect(mockPush).toHaveBeenCalledTimes(1);
});

it.each(['paste', 'type'] as const)(
  'routes a domain username via Lightning when users %s',
  async (method) => {
    resolver.mockImplementationOnce(
      jest.requireActual('~/shared/utils/universalInputResolver').resolveUniversalInput,
    );
    await open(true);
    if (method === 'paste') {
      mockClipboard.mockResolvedValueOnce('  alice@bey.cash  ');
      await act(async () => button('Paste').props.onPress());
    } else {
      await type('alice@bey.cash');
      await act(async () => button('Go').props.onPress());
    }
    expect(mockScanner).toHaveBeenCalledWith('alice@bey.cash');
    expect(mockPush).toHaveBeenCalledWith('/(modals)/melt');
    expect(mockPush).toHaveBeenCalledTimes(1);
  },
);

it('keeps Nostr recipients in the input with guidance to use People', async () => {
  resolver.mockImplementationOnce(
    jest.requireActual('~/shared/utils/universalInputResolver').resolveUniversalInput,
  );
  await open(true);
  await type('nostr:npub1-person');
  await act(async () => button('Go').props.onPress());
  expect(tree.root.findByProps({ accessibilityRole: 'alert' }).props.children).toBe(
    'To send to a person, use the People tab.',
  );
  expect(mockPush).not.toHaveBeenCalled();
});

it('pastes the full trimmed token and routes directly to claiming, before clearing the input', async () => {
  await open();
  await act(async () => button('Paste').props.onPress());
  expect(resolver).toHaveBeenCalledWith('cashu-complete-token');
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/(modals)/receive',
    params: { mode: 'receive', scannedToken: 'cashu-complete-token' },
  });
  expect(mockBeforeRedirect.mock.invocationCallOrder[0]).toBeLessThan(
    mockPush.mock.invocationCallOrder[0],
  );
  expect(field().props.nativeText).toBe('');
  expect(mockBusy).toHaveBeenLastCalledWith(false);
});

it.each([
  ['cashu_request', { pathname: '/(modals)/send', params: { paymentRequest: 'payment-value' } }],
  ['lightning_invoice', '/(modals)/melt'],
  ['lightning_address', '/(modals)/melt'],
  ['bitcoin_onchain', '/(modals)/melt?mode=onchain'],
] as const)(
  'preserves typed %s routing through Continue',
  async (inputType: UniversalInputType, destination) => {
    resolver.mockResolvedValueOnce({
      type: inputType,
      raw: 'payment-value',
      cleaned: 'payment-value',
    });
    await open();
    await type('payment-value');
    await act(async () => button('Continue').props.onPress());
    expect(mockPush).toHaveBeenCalledWith(destination);
  },
);

it('does not resolve empty clipboard contents and retains invalid input for correction', async () => {
  mockClipboard.mockResolvedValueOnce('   ');
  await open();
  await act(async () => button('Paste').props.onPress());
  expect(resolver).not.toHaveBeenCalled();
  expect(mockToast).toHaveBeenCalledWith('Clipboard is empty', { kind: 'info' });
  resolver.mockResolvedValueOnce({
    type: 'unknown',
    raw: 'invalid',
    cleaned: 'invalid',
    error: 'Unrecognized format',
  });
  await type('invalid');
  await act(async () => button('Continue').props.onPress());
  expect(tree.root.findByProps({ accessibilityRole: 'alert' }).props.children).toBe(
    'Unrecognized format',
  );
  expect(mockPush).not.toHaveBeenCalled();
  expect(button('Continue')).toBeTruthy();
});

it('reports clipboard failure and keeps typing available', async () => {
  mockClipboard.mockRejectedValueOnce(new Error('access denied'));
  await open();
  await act(async () => button('Paste').props.onPress());
  expect(tree.root.findByProps({ accessibilityRole: 'alert' }).props.children).toContain(
    'Could not read the clipboard',
  );
  expect(field().props.editable).toBe(true);
  expect(mockPush).not.toHaveBeenCalled();
});

it('ignores duplicate Paste taps and a clipboard response after dismissal clears the card', async () => {
  let resolve!: (value: string) => void;
  mockClipboard.mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    }),
  );
  await open();
  await act(async () => {
    button('Paste').props.onPress();
    button('Paste').props.onPress();
  });
  expect(mockClipboard).toHaveBeenCalledTimes(1);
  expect(button('Paste').props.disabled).toBe(true);
  await act(async () => ref.current!.clear());
  await act(async () => resolve('late-token'));
  expect(resolver).not.toHaveBeenCalled();
  expect(mockPush).not.toHaveBeenCalled();
});

it.each(['clear', 'unmount'] as const)('ignores a resolver response after %s', async (action) => {
  let resolve!: (value: any) => void;
  resolver.mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    }),
  );
  await open();
  await type('payment-value');
  await act(async () => {
    button('Continue').props.onPress();
    button('Continue').props.onPress();
  });
  expect(resolver).toHaveBeenCalledTimes(1);
  if (action === 'clear') await act(async () => ref.current!.clear());
  else await act(async () => tree.unmount());
  await act(async () => resolve({ type: 'cashu_token', raw: 'late-token', cleaned: 'late-token' }));
  expect(mockPush).not.toHaveBeenCalled();
});

it('navigates once and accepts another payment only after the card is reset', async () => {
  await open();
  await act(async () => {
    button('Paste').props.onPress();
  });
  await act(async () => button('Paste').props.onPress());
  expect(mockPush).toHaveBeenCalledTimes(1);
  await act(async () => ref.current!.clear());
  await act(async () => button('Paste').props.onPress());
  expect(mockPush).toHaveBeenCalledTimes(2);
});
