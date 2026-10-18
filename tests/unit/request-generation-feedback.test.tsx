jest.mock('~/shared/ui/PaymentFlowHeader', () => ({ PaymentFlowHeader: 'PaymentFlowHeader' }));
jest.mock('~/shared/hooks/useFlowMint', () => ({
  useFlowMint: () => {
    const [mintUrl, setMintUrl] = require('react').useState('https://mint.test');
    return { mintUrl, setMintUrl, balance: 100 };
  },
}));
jest.mock('~/shared/ui/AppBottomSheet', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: React.forwardRef(({ children }: any, ref: any) => {
      React.useImperativeHandle(ref, () => ({ present: jest.fn(), dismiss: jest.fn() }));
      return React.createElement('AppBottomSheet', {}, children);
    }),
  };
});
jest.mock('@gorhom/bottom-sheet', () => ({ BottomSheetTextInput: 'BottomSheetTextInput' }));
jest.mock('~/shared/ui/PaymentMintRow', () => ({ PaymentMintRow: 'PaymentMintRow' }));
jest.mock('~/shared/ui/ListTable', () => ({
  ListTable: 'ListTable',
  ListTableRow: 'ListTableRow',
}));
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { RequestEcashStage } from '~/features/payments/receive/RequestEcashStage';
import { RequestAmountEditor } from '~/features/payments/receive/RequestDetailsEditor';
import * as Clipboard from 'expo-clipboard';
import { DeviceEventEmitter } from 'react-native';
import { useNostrRequestStore } from '~/state/nostrRequestStore';
import { useNostrInboxStore } from '~/state/nostrInboxStore';

let mockEncodingFails = true;
let mockPrice: number | undefined = 100000;
let mockPrimaryCurrency = 'SATS';
let mockRequestArguments: any[][] = [];
const mockToast = { show: jest.fn() };
const mockEnqueue = jest.fn(async (_id: string) => {});
const mockReconcile = jest.fn(async () => {});
const mockStopBroadcast = jest.fn();
const mockPresentRequest = jest.fn((_request: string) => mockStopBroadcast);
const mockNfcState = { requestStatus: 'ready' };
jest.mock('~/features/nfc/nfcFlow', () => ({
  nfcFlow: {
    presentRequest: (request: string) => mockPresentRequest(request),
    subscribe: () => () => {},
    getSnapshot: () => mockNfcState,
  },
}));
jest.mock('~/services/platform/nfcService', () => ({ nfcService: {} }));
jest.mock('~/shared/icons/NfcIcon', () => 'NfcIcon');
jest.mock('~/services/wallet/nostrClaimService', () => ({
  nostrClaimService: { enqueue: (...args: [string]) => mockEnqueue(...args) },
}));
jest.mock('~/services/wallet/requestLifecycleService', () => ({
  requestLifecycleService: { reconcile: () => mockReconcile() },
}));
jest.mock('@tamagui/toast', () => ({ useToastController: () => mockToast }));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useFocusEffect: (callback: any) => require('react').useEffect(callback, [callback]),
}));
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
jest.mock('~/services/wallet/nostrService', () => ({
  sendNostrToken: jest.fn(),
  nostrService: { refresh: jest.fn() },
}));
jest.mock('~/services/platform/seedService', () => ({ seedService: {} }));
jest.mock('@cashu/cashu-ts', () => ({
  PaymentRequestTransportType: { NOSTR: 'nostr' },
  PaymentRequest: function (...args: any[]) {
    mockRequestArguments.push(args);
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
    () => ({
      primaryCurrency: mockPrimaryCurrency,
      secondaryCurrency: 'USD',
      npub: 'test-public-key',
    }),
    { getState: () => ({ primaryCurrency: 'SATS' }) },
  ),
}));
jest.mock('~/state/nostrRequestStore', () => {
  const { create } = require('zustand');
  return {
    useNostrRequestStore: create((set: any, get: any) => ({
      requests: [],
      pendingRequests: [],
      loadPendingRequests: async () => {},
      addRequest: async (request: any) => {
        const saved = {
          ...request,
          state: 'pending',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set({
          requests: [saved, ...get().requests],
          pendingRequests: [saved, ...get().pendingRequests],
        });
      },
    })),
  };
});
jest.mock('~/state/nostrInboxStore', () => {
  const { create } = require('zustand');
  return { useNostrInboxStore: create(() => ({ items: [] })) };
});
jest.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: { price: mockPrice } }) }));
jest.mock('~/services/api/bitcoinService', () => ({ bitcoinService: {} }));
jest.mock('~/services/wallet/currencyService', () => ({
  currencyService: {
    formatValue: () => '$0.01',
    convertSatsToCurrency: (value: number) => value / 1000,
    convertCurrencyToSats: (value: number) => Math.round(value * 1000),
  },
  SUPPORTED_CURRENCIES: [{ code: 'USD', symbol: '$' }],
}));
jest.mock('@tamagui/lucide-icons', () => new Proxy({}, { get: (_, key) => String(key) }));
jest.mock('tamagui', () => ({
  useTheme: () => ({ color: { val: '#000' }, gray3: { val: '#eee' }, gray10: { val: '#888' } }),
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
  mockPrice = 100000;
  mockPrimaryCurrency = 'SATS';
  mockRequestArguments = [];
  useNostrRequestStore.setState({ requests: [], pendingRequests: [] });
  useNostrInboxStore.setState({ items: [] });
});

it('opens directly on the QR screen and leaves a failed generation retryable', async () => {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<RequestEcashStage />);
  });
  expect(tree.root.findByType('PaymentFlowHeader' as any).props.title).toBe('Request ecash');
  expect(mockRequestArguments).toHaveLength(0);
  expect(
    tree.root.findByProps({ testID: 'payment-stage-footer' }).findByType('AppButton' as any).props
      .disabled,
  ).toBe(false);
  await act(async () => tree.root.findByType('NumericKeypad' as any).props.onValueChange('10'));
  await act(async () => tree.root.findByType('NumericKeypad' as any).props.onConfirm());
  expect(mockToast.show).toHaveBeenCalledWith(
    'Request failed: Cannot encode request',
    expect.objectContaining({ kind: 'error' }),
  );
  expect(useNostrRequestStore.getState().requests).toHaveLength(0);
  mockEncodingFails = false;
  await act(async () =>
    tree.root
      .findAllByType('AppButton' as any)
      .find((n) => n.props.children === 'Retry')!
      .props.onPress(),
  );
  expect(useNostrRequestStore.getState().requests).toHaveLength(1);
  expect(
    tree.root.findByProps({ testID: 'payment-stage-footer' }).findByType('AppButton' as any).props
      .disabled,
  ).toBe(false);
  await act(async () => tree.unmount());
});

it('edits the amount, mint and note on the QR screen while preserving issued versions', async () => {
  const tree = await createRequestScreen();
  const previous = useNostrRequestStore.getState().requests[0];
  await act(async () =>
    tree.root.findByType('PaymentMintRow' as any).props.onSelect('https://other.test'),
  );
  expect(useNostrRequestStore.getState().requests[0].mintUrl).toBe('https://other.test');
  expect(useNostrRequestStore.getState().requests.find((r) => r.id === previous.id)).toMatchObject({
    mintUrl: 'https://mint.test',
    amount: 10,
  });
  const noteInput = () => tree.root.findByType('BottomSheetTextInput' as any);
  await act(async () => noteInput().props.onChangeText('Coffee'));
  expect(useNostrRequestStore.getState().requests[0].description).toBeUndefined();
  await act(async () => noteInput().props.onSubmitEditing());
  expect(useNostrRequestStore.getState().requests[0].description).toBe('Coffee');
  const savedCount = useNostrRequestStore.getState().requests.length;
  await act(async () => noteInput().props.onChangeText('Unsaved draft'));
  expect(useNostrRequestStore.getState().requests).toHaveLength(savedCount);
  await act(async () => tree.root.findByProps({ label: 'Note' }).props.onPress());
  expect(noteInput().props.value).toBe('Coffee');
  expect(mockRequestArguments.at(-1)?.slice(2)).toEqual([
    10,
    'sat',
    ['https://other.test'],
    'Coffee',
  ]);
  await act(async () => noteInput().props.onChangeText(''));
  await act(async () => noteInput().props.onSubmitEditing());
  expect(useNostrRequestStore.getState().requests[0].description).toBeUndefined();
  expect(tree.root.findByProps({ testID: 'payment-stage-layout' }).props.px).toBe('$4');
  expect(
    tree.root.findByProps({ testID: 'payment-stage-footer' }).findByType('AppButton' as any).props
      .children,
  ).toBe('New request');
  expect(
    tree.root.findByType('ScrollView' as any).findAllByProps({ testID: 'payment-stage-footer' }),
  ).toHaveLength(0);
  const frame = tree.root
    .findAllByType('YStack' as any)
    .find((n) => n.props.accessibilityLabel === 'Payment request QR code')!;
  await act(async () => frame.props.onLayout({ nativeEvent: { layout: { width: 300 } } }));
  expect(tree.root.findByType('QRCode' as any).props.value).toBe('creq-complete-request');
  await act(async () => tree.root.findByProps({ label: 'Request' }).props.onCopy());
  expect(Clipboard.setStringAsync).toHaveBeenCalledWith('creq-complete-request');
  expect(
    tree.root
      .findByType('ListTable' as any)
      .findAllByType('AppButton' as any)
      .some((n) => n.props.children === 'Share'),
  ).toBe(false);
  await act(async () => tree.unmount());
});

async function createRequestScreen() {
  mockEncodingFails = false;
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<RequestEcashStage />);
  });
  await act(async () => tree.root.findByType('NumericKeypad' as any).props.onValueChange('10'));
  await act(async () => tree.root.findByType('NumericKeypad' as any).props.onConfirm());
  return tree;
}

function response(status: 'contact_required' | 'approval_required' | 'pending' | 'claimed') {
  const request = useNostrRequestStore.getState().requests[0];
  return {
    id: 'payment-response',
    type: 'token' as const,
    tokenString: 'synthetic-token',
    amount: 10,
    mintUrl: request.mintUrl,
    unit: 'sat',
    requestId: request.id,
    senderPubkey: '12'.repeat(32),
    status,
    seen: false,
    receivedAt: Date.now() + 1,
  };
}

it('shows a matching response awaiting approval and opens the existing review sheet without marking it received', async () => {
  const emit = jest.spyOn(DeviceEventEmitter, 'emit');
  const tree = await createRequestScreen();
  const payment = response('contact_required');
  await act(async () => {
    useNostrInboxStore.setState({ items: [payment] });
  });
  expect(tree.root.findByProps({ label: 'Status' }).props.value).toBe('Approve sender');
  expect(useNostrRequestStore.getState().requests[0].state).toBe('pending');
  const savedCount = useNostrRequestStore.getState().requests.length;
  expect(tree.root.findByType('PaymentMintRow' as any).props.disabled).toBe(true);
  await act(async () =>
    tree.root.findByType('PaymentMintRow' as any).props.onSelect('https://other.test'),
  );
  expect(useNostrRequestStore.getState().requests).toHaveLength(savedCount);
  const review = tree.root
    .findAllByType('AppButton' as any)
    .find((button) => button.props.children === 'Review payment')!;
  await act(async () => review.props.onPress());
  expect(emit).toHaveBeenCalledWith('nostr:openClaim', payment);
  expect(mockEnqueue).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
  emit.mockRestore();
});

it('refreshes the saved response through the claim service and reacts to a verified request receipt', async () => {
  const tree = await createRequestScreen();
  await act(async () => {
    useNostrInboxStore.setState({ items: [response('pending')] });
  });
  expect(tree.root.findByProps({ label: 'Status' }).props.value).toBe('Payment arrived');
  const status = tree.root.findByProps({ label: 'Status' });
  await act(async () => status.props.rightContent.props.onPress());
  expect(mockEnqueue).toHaveBeenCalledWith('payment-response');
  expect(mockReconcile).toHaveBeenCalled();
  expect(tree.root.findAllByType('ResultStage' as any)).toHaveLength(0);
  const request = useNostrRequestStore.getState().requests[0];
  await act(async () => {
    useNostrRequestStore.setState({
      requests: [{ ...request, state: 'received' }],
      pendingRequests: [],
    });
  });
  expect(tree.root.findByType('ResultStage' as any).props.title).toBe('Request claimed');
  await act(async () => tree.unmount());
});

it('ignores unrelated responses and still requires mint approval for a matching offer', async () => {
  const tree = await createRequestScreen();
  await act(async () => {
    useNostrInboxStore.setState({
      items: [{ ...response('contact_required'), requestId: 'another-request' }],
    });
  });
  expect(tree.root.findByProps({ label: 'Status' }).props.value).toBe('Awaiting payment');
  expect(
    tree.root
      .findAllByType('AppButton' as any)
      .some((button) => button.props.children === 'Review payment'),
  ).toBe(false);
  await act(async () => {
    useNostrInboxStore.setState({ items: [response('approval_required')] });
  });
  expect(tree.root.findByProps({ label: 'Status' }).props.value).toBe('Approve mint');
  expect(useNostrRequestStore.getState().requests[0].state).toBe('pending');
  await act(async () => tree.unmount());
});

it('does not assign an ID-less legacy response to one of several identical requests', async () => {
  const tree = await createRequestScreen();
  const request = useNostrRequestStore.getState().requests[0];
  await act(async () => {
    useNostrRequestStore.setState({ requests: [request, { ...request, id: 'other-request' }] });
    useNostrInboxStore.setState({
      items: [{ ...response('contact_required'), requestId: undefined }],
    });
  });
  expect(tree.root.findByProps({ label: 'Status' }).props.value).toBe('Awaiting payment');
  expect(
    tree.root
      .findAllByType('AppButton' as any)
      .some((button) => button.props.children === 'Review payment'),
  ).toBe(false);
  await act(async () => tree.unmount());
});

it('reopens a received request as success instead of showing its unpaid QR again', async () => {
  const tree = await createRequestScreen();
  const request = useNostrRequestStore.getState().requests[0];
  await act(async () => tree.unmount());
  useNostrRequestStore.setState({
    requests: [{ ...request, state: 'received' }],
    pendingRequests: [],
  });
  let restored!: ReactTestRenderer;
  await act(async () => {
    restored = create(<RequestEcashStage initialRequestId={request.id} />);
  });
  expect(restored.root.findByType('ResultStage' as any).props.title).toBe('Request claimed');
  expect(restored.root.findAllByType('QRCode' as any)).toHaveLength(0);
  await act(async () => restored.unmount());
});

it('preserves the exact satoshi amount when opening and switching the amount editor currency', async () => {
  const onChange = jest.fn();
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<RequestAmountEditor amount={11} onChange={onChange} />);
  });
  await act(async () => tree.root.findByProps({ label: 'Amount' }).props.onPress());
  await act(async () =>
    tree.root.findByProps({ accessibilityLabel: 'Switch amount currency' }).props.onPress(),
  );
  expect(tree.root.findByType('NumericKeypad' as any).props.value).toBe('0.01');
  await act(async () => tree.root.findByType('NumericKeypad' as any).props.onConfirm());
  expect(onChange).toHaveBeenCalledWith(11);
  await act(async () =>
    tree.root.findByProps({ accessibilityLabel: 'Switch amount currency' }).props.onPress(),
  );
  await act(async () => tree.root.findByType('NumericKeypad' as any).props.onValueChange('0'));
  expect(tree.root.findByType('NumericKeypad' as any).props.confirmDisabled).toBe(true);
  onChange.mockClear();
  await act(async () => tree.root.findByType('NumericKeypad' as any).props.onConfirm());
  expect(onChange).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});

it('still reports receipt of an earlier QR after its details were edited', async () => {
  const tree = await createRequestScreen();
  const earlier = useNostrRequestStore.getState().requests[0];
  await act(async () => tree.root.findByType('NumericKeypad' as any).props.onValueChange('20'));
  await act(async () => tree.root.findByType('NumericKeypad' as any).props.onConfirm());
  expect(useNostrRequestStore.getState().requests[0].amount).toBe(20);
  await act(async () => {
    useNostrInboxStore.setState({
      items: [{ ...response('contact_required'), requestId: earlier.id, amount: 10 }],
    });
  });
  expect(tree.root.findByType(RequestAmountEditor).props.amount).toBe(10);
  expect(tree.root.findByProps({ label: 'Status' }).props.value).toBe('Approve sender');
  await act(async () => {
    const requests = useNostrRequestStore
      .getState()
      .requests.map((r) => (r.id === earlier.id ? { ...r, state: 'received' as const } : r));
    useNostrRequestStore.setState({
      requests,
      pendingRequests: requests.filter((r) => r.state === 'pending'),
    });
  });
  expect(tree.root.findByType('ResultStage' as any).props.amount).toBe('10');
  await act(async () => tree.unmount());
});

it('keeps reopened pending request details fixed and does not regenerate its QR', async () => {
  const tree = await createRequestScreen();
  const request = useNostrRequestStore.getState().requests[0];
  await act(async () => tree.unmount());
  mockRequestArguments = [];
  let restored!: ReactTestRenderer;
  await act(async () => {
    restored = create(<RequestEcashStage initialRequestId={request.id} />);
  });
  expect(mockRequestArguments).toHaveLength(0);
  expect(restored.root.findByType('PaymentMintRow' as any).props.disabled).toBe(true);
  await act(async () =>
    restored.root.findByType('PaymentMintRow' as any).props.onSelect('https://other.test'),
  );
  expect(useNostrRequestStore.getState().requests[0]).toMatchObject({
    mintUrl: request.mintUrl,
    creqString: request.creqString,
  });
  await act(async () => restored.unmount());
});

it('falls back to sats when the preferred fiat price is unavailable', async () => {
  mockPrice = undefined;
  mockPrimaryCurrency = 'FIAT';
  const onChange = jest.fn();
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<RequestAmountEditor amount={11} onChange={onChange} />);
  });
  await act(async () => tree.root.findByProps({ label: 'Amount' }).props.onPress());
  expect(tree.root.findByType('NumericKeypad' as any).props.value).toBe('11');
  expect(
    tree.root.findByProps({ accessibilityLabel: 'Switch amount currency' }).props.disabled,
  ).toBe(true);
  await act(async () => tree.root.findByType('NumericKeypad' as any).props.onConfirm());
  expect(onChange).toHaveBeenCalledWith(11);
  await act(async () => tree.unmount());
});

it('starts NFC for the created request and stops it when New request clears the screen', async () => {
  const tree = await createRequestScreen();
  expect(mockPresentRequest).toHaveBeenCalledWith('creq-complete-request');
  expect(tree.root.findByProps({ label: 'Amount' }).props.value).toBe('10 SATS');
  expect(tree.root.findByProps({ label: 'Amount' }).props.rightContent.type).toBe('Pencil');
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Tap to pay' })).toHaveLength(1);
  expect(
    tree.root
      .findAllByType('AppButton' as any)
      .some((n) => /Publish|Share/.test(String(n.props.children))),
  ).toBe(false);
  mockStopBroadcast.mockClear();
  await act(async () =>
    tree.root
      .findByProps({ testID: 'payment-stage-footer' })
      .findByType('AppButton' as any)
      .props.onPress(),
  );
  expect(mockStopBroadcast).toHaveBeenCalled();
  expect(tree.root.findByProps({ label: 'Amount' }).props.value).toBe('Set amount');
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Tap to pay' })).toHaveLength(0);
  await act(async () => tree.unmount());
});

it('opens success immediately for a verified receipt while the request record is still updating', async () => {
  const tree = await createRequestScreen();
  await act(async () => {
    useNostrInboxStore.setState({ items: [response('claimed')] });
  });
  expect(tree.root.findAllByType('ResultStage' as any)).toHaveLength(0);
  await act(async () => {
    useNostrInboxStore.setState({ items: [{ ...response('claimed'), receiptVerified: true }] });
  });
  expect(tree.root.findByType('ResultStage' as any).props.status).toBe('success');
  expect(useNostrRequestStore.getState().requests[0].state).toBe('pending');
  expect(mockStopBroadcast).toHaveBeenCalled();
  await act(async () => tree.unmount());
});
