import React from 'react';
import { AppState, Share } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import * as Clipboard from 'expo-clipboard';
import { AnimatedTokenQRCode } from '~/shared/ui/AnimatedTokenQRCode';
import { EcashTokenQRCode } from '~/shared/ui/EcashTokenQRCode';
import { PendingTokenLayout } from '~/shared/ui/PendingTokenLayout';
import SendMethodSelector from '~/shared/ui/SendMethodSelector';

const mockHeader = jest.fn(() => null);
const mockNextPart = jest.fn();
const mockEncoder = jest.fn();
const mockRemoveListener = jest.fn();
const mockSetLockDisabled = jest.fn();
const mockNfcSend = jest.fn();
const mockDismiss = jest.fn();
const mockPresent = jest.fn();
jest.mock('@gandlaf21/bc-ur', () => ({
  UR: { fromBuffer: (value: Buffer) => value.toString() },
  UREncoder: function (...args: unknown[]) {
    return mockEncoder(...args);
  },
}));
jest.mock('@react-navigation/native', () => {
  const React = require('react');
  const FocusContext = React.createContext(true);
  return { FocusContext, useIsFocused: () => React.useContext(FocusContext) };
});
jest.mock('~/shared/ui/PaymentQRCode', () => ({ __esModule: true, default: 'QR' }));
jest.mock('~/shared/ui/PaymentFlowHeader', () => ({ PaymentFlowHeader: () => mockHeader() }));
jest.mock('~/shared/ui/PaymentQRFrame', () => ({
  PaymentQRFrame: ({ children }: any) => children(280),
}));
jest.mock('~/shared/ui/PaymentStageLayout', () => ({
  PaymentStageLayout: ({ hero, children, footer }: any) => (
    <>
      {hero}
      {children}
      {footer}
    </>
  ),
}));
jest.mock('~/shared/ui/PaymentAmount', () => ({ PaymentAmount: 'Amount' }));
jest.mock('~/shared/ui/PaymentStatusIcon', () => ({ PaymentStatusIcon: 'Status' }));
jest.mock('~/shared/ui/PaymentStatusRow', () => ({ PaymentStatusRow: 'StatusRow' }));
jest.mock('~/shared/ui/ListTable', () => ({ ListTable: 'Table', ListTableRow: 'Row' }));
jest.mock('~/shared/ui/HeaderIconButton', () => ({ HeaderIconButton: 'HeaderButton' }));
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'Button' }));
jest.mock('~/shared/ui/AppPressable', () => ({ AppPressable: 'Pressable' }));
jest.mock('~/shared/ui/Spinner', () => ({ Spinner: 'Spinner' }));
jest.mock('~/shared/ui/AppBottomSheet', () => ({
  __esModule: true,
  default: require('react').forwardRef((props: any, ref: any) => {
    require('react').useImperativeHandle(ref, () => ({
      present: mockPresent,
      dismiss: mockDismiss,
    }));
    return require('react').createElement('Sheet', props, props.children);
  }),
}));
jest.mock('@gorhom/bottom-sheet', () => ({ BottomSheetScrollView: 'ScrollView' }));
jest.mock('~/state/settingsStore', () => ({
  useSettingsStore: (select: any) => select({ npub: '' }),
}));
jest.mock('~/state/authStore', () => ({
  useAuthStore: () => ({ setLockDisabled: mockSetLockDisabled }),
}));
jest.mock('~/features/nfc/nfcFlow', () => ({
  nfcFlow: { openSend: (...args: unknown[]) => mockNfcSend(...args) },
}));
jest.mock('~/services/wallet', () => ({
  cleanToken: (value: string) => value.replace(/^cashu:/, ''),
  decodeToken: () => ({ proofs: [] }),
}));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@tamagui/toast', () => ({ useToastController: () => ({ show: jest.fn() }) }));
jest.mock('tamagui', () => ({
  YStack: 'YStack',
  XStack: 'XStack',
  Text: 'Text',
  Separator: 'Separator',
  YGroup: 'YGroup',
  View: 'View',
}));
jest.mock('@tamagui/lucide-icons', () => new Proxy({}, { get: (_, key) => String(key) }));

const { FocusContext } = jest.requireMock('@react-navigation/native');
let tree: ReactTestRenderer;
let appStateListener: (state: 'active' | 'background' | 'inactive') => void;
const originalAppState = AppState.currentState;
afterAll(() => {
  AppState.currentState = originalAppState;
});
beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick', 'setImmediate'] });
  jest.clearAllMocks();
  AppState.currentState = 'active';
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
    appStateListener = listener;
    return { remove: mockRemoveListener };
  });
  let sequence = 0;
  mockNextPart.mockReset().mockImplementation(() => `ur:bytes/frame-${++sequence}`);
  mockEncoder
    .mockReset()
    .mockImplementation(() => ({ fragmentsLength: 3, nextPart: mockNextPart }));
});
afterEach(async () => {
  await act(async () => tree?.unmount());
  jest.useRealTimers();
  jest.restoreAllMocks();
});
async function render(element: React.ReactElement) {
  await act(async () => {
    tree = create(element);
  });
}
const qrValue = () => tree.root.findByType('QR' as any).props.value;

it('updates at 100 ms without rerendering payment controls or the header', async () => {
  await render(<PendingTokenLayout token={'cashuB' + 'x'.repeat(900)} amount={1} />);
  const renders = mockHeader.mock.calls.length;
  expect(qrValue()).toBe('UR:BYTES/FRAME-1');
  for (let i = 0; i < 10; i++) await act(async () => jest.advanceTimersByTime(100));
  expect(mockNextPart).toHaveBeenCalledTimes(11);
  expect(qrValue()).toBe('UR:BYTES/FRAME-11');
  expect(mockHeader).toHaveBeenCalledTimes(renders);
});

it('shows the complete small token as a static pending QR with no animation timer or toggle', async () => {
  const token = 'cashuBsynthetic';
  await render(<PendingTokenLayout token={token} amount={1} />);
  expect(qrValue()).toBe(token);
  expect(tree.root.findByType('QR' as any).props.ecl).toBe('M');
  expect(mockEncoder).not.toHaveBeenCalled();
  await act(async () => jest.advanceTimersByTime(1000));
  expect(qrValue()).toBe(token);
  expect(jest.getTimerCount()).toBe(0);
});

it('switches between static and animated tokens without retaining an old frame or timer', async () => {
  const small = 'cashuBsmall';
  const large = 'cashuB' + 'x'.repeat(900);
  await render(<EcashTokenQRCode token={small} size={280} />);
  expect(qrValue()).toBe(small);
  await act(async () => tree.update(<EcashTokenQRCode token={large} size={280} />));
  expect(qrValue()).toBe('UR:BYTES/FRAME-1');
  expect(mockEncoder).toHaveBeenCalledWith(large, 150, 0);
  await act(async () => tree.update(<EcashTokenQRCode token={small} size={280} />));
  expect(qrValue()).toBe(small);
  expect(jest.getTimerCount()).toBe(0);
});

it('replaces the encoder when the token changes and never continues the old sequence', async () => {
  await render(<AnimatedTokenQRCode token="first" size={280} />);
  const oldNext = mockNextPart;
  const newNext = jest.fn(() => 'ur:bytes/new-frame');
  mockEncoder.mockReturnValue({ fragmentsLength: 2, nextPart: newNext });
  await act(async () => tree.update(<AnimatedTokenQRCode token="second" size={280} />));
  expect(qrValue()).toBe('UR:BYTES/NEW-FRAME');
  const oldCalls = oldNext.mock.calls.length;
  await act(async () => jest.advanceTimersByTime(1000));
  expect(oldNext).toHaveBeenCalledTimes(oldCalls);
  expect(newNext).toHaveBeenCalledTimes(11);
  expect(jest.getTimerCount()).toBe(1);
});

it('stops on blur and background, resumes when visible, and cleans up on unmount', async () => {
  const content = (focused: boolean) => (
    <FocusContext.Provider value={focused}>
      <AnimatedTokenQRCode token="token" size={280} />
    </FocusContext.Provider>
  );
  await render(content(true));
  expect(jest.getTimerCount()).toBe(1);
  await act(async () => tree.update(content(false)));
  expect(jest.getTimerCount()).toBe(0);
  const calls = mockNextPart.mock.calls.length;
  await act(async () => jest.advanceTimersByTime(1000));
  expect(mockNextPart).toHaveBeenCalledTimes(calls);
  await act(async () => tree.update(content(true)));
  expect(jest.getTimerCount()).toBe(1);
  await act(async () => appStateListener('background'));
  expect(jest.getTimerCount()).toBe(0);
  await act(async () => appStateListener('active'));
  expect(jest.getTimerCount()).toBe(1);
  await act(async () => tree.unmount());
  expect(jest.getTimerCount()).toBe(0);
  expect(mockRemoveListener).toHaveBeenCalledTimes(1);
});

it('does not run a timer for a single-part QR', async () => {
  mockEncoder.mockReturnValue({ fragmentsLength: 1, nextPart: mockNextPart });
  await render(<AnimatedTokenQRCode token="short" size={280} />);
  expect(qrValue()).toBe('UR:BYTES/FRAME-1');
  expect(jest.getTimerCount()).toBe(0);
});

it('clears a removed token and its timer', async () => {
  await render(<AnimatedTokenQRCode token="first" size={280} />);
  await act(async () => tree.update(<AnimatedTokenQRCode token="" size={280} />));
  expect(tree.root.findAllByType('QR' as any)).toHaveLength(0);
  expect(jest.getTimerCount()).toBe(0);
});

it.each(['setup', 'first frame', 'later frame'])(
  'handles %s errors without exposing data or leaving a timer',
  async (stage) => {
    if (stage === 'setup')
      mockEncoder.mockImplementation(() => {
        throw new Error('private fixture');
      });
    if (stage === 'first frame')
      mockNextPart.mockImplementation(() => {
        throw new Error('private fixture');
      });
    if (stage === 'later frame')
      mockNextPart
        .mockImplementationOnce(() => 'ur:bytes/first')
        .mockImplementation(() => {
          throw new Error('private fixture');
        });
    await render(<AnimatedTokenQRCode token="synthetic" size={280} />);
    await act(async () => jest.advanceTimersByTime(100));
    expect(tree.root.findAllByType('QR' as any)).toHaveLength(0);
    expect(JSON.stringify(tree.toJSON())).toContain('QR unavailable');
    expect(JSON.stringify(tree.toJSON())).not.toContain('private fixture');
    expect(jest.getTimerCount()).toBe(0);
  },
);

it('only offers system share, NFC, and token copy, using the original token', async () => {
  const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
  await render(
    <PendingTokenLayout
      token="cashuBsynthetic"
      amount={1}
      operationId="op"
      mintUrl="https://mint.test"
    />,
  );
  const labels = tree.root.findAllByType('Text' as any).map((node) => node.props.children);
  expect(labels).toEqual(expect.arrayContaining(['Share via App', 'NFC Send', 'Copy Token']));
  expect(labels.join(' ')).not.toMatch(/Web|Publish/);
  const row = (label: string) =>
    tree.root
      .findAllByType('XStack' as any)
      .find(
        (node) =>
          node.findAllByType('Text' as any).some((text) => text.props.children === label) &&
          node.props.onPress,
      )!;
  await act(async () => row('Share via App').props.onPress());
  expect(share).toHaveBeenCalledWith({ message: 'cashu:cashuBsynthetic', title: 'Share Token' });
  await act(async () => row('Copy Token').props.onPress());
  expect(Clipboard.setStringAsync).toHaveBeenCalledWith('cashuBsynthetic');
  await act(async () => row('NFC Send').props.onPress());
  await act(async () => tree.root.findByType('Sheet' as any).props.onClose());
  expect(mockNfcSend).toHaveBeenCalledWith(
    expect.objectContaining({ token: 'cashuBsynthetic', operationId: 'op' }),
  );
});

it('removes eCash Link from send methods while preserving the remaining methods', async () => {
  const select = jest.fn();
  await render(<SendMethodSelector mode="standard" onSelect={select} />);
  const labels = tree.root.findAllByType('Text' as any).map((node) => node.props.children);
  expect(labels).toEqual(expect.arrayContaining(['Standard', 'P2PK', 'Nostr', 'Scan & Pay']));
  expect(labels).not.toContain('eCash Link');
});
