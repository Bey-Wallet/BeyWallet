import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import * as Clipboard from 'expo-clipboard';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { P2PKLockCard } from '~/features/payments/send/P2PKLockCard';

const mockPresent = jest.fn();
const mockDismiss = jest.fn();
const mockPush = jest.fn();
let mockFocus: () => void;
const mockStore = {
  result: null as { id: string; value: string } | null,
  setResult: jest.fn((result: { id: string; value: string } | null) => {
    mockStore.result = result;
  }),
};
jest.mock('~/state/p2pkScanStore', () => ({ useP2PKScanStore: { getState: () => mockStore } }));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useFocusEffect: (callback: () => void) => {
    mockFocus = callback;
  },
}));
jest.mock('react-native', () => ({
  Keyboard: { dismiss: jest.fn() },
  View: 'View',
  Text: 'Text',
  StyleSheet: { create: (styles: unknown) => styles },
}));
jest.mock('@gorhom/bottom-sheet', () => ({ BottomSheetTextInput: 'KeyInput' }));
jest.mock('tamagui', () => ({
  Text: 'Text',
  XStack: 'XStack',
  YStack: 'YStack',
  useTheme: () => ({ gray10: { val: '#888' }, gray3: { val: '#eee' }, color: { val: '#000' } }),
}));
jest.mock('@tamagui/lucide-icons', () => ({
  ClipboardPaste: 'ClipboardPaste',
  ScanLine: 'ScanLine',
}));
jest.mock('expo-clipboard', () => ({ getStringAsync: jest.fn() }));
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'Button' }));
jest.mock('~/shared/ui/AppSwitch', () => ({ AppSwitch: 'Switch' }));
jest.mock('~/shared/ui/ListTable', () => ({
  ListTable: 'Table',
  ListTableRow: ({ rightContent, ...props }: any) =>
    require('react').createElement('Row', props, rightContent),
}));
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

const key = secp256k1.Point.BASE.toHex(true);
let tree: ReactTestRenderer;
const onKey = jest.fn();
function Card({ offline = false }: { offline?: boolean }) {
  const [enabled, setEnabled] = React.useState(false);
  const [publicKey, setPublicKey] = React.useState('');
  return (
    <P2PKLockCard
      enabled={enabled}
      onEnabledChange={setEnabled}
      publicKey={publicKey}
      onKeyChange={(value) => {
        setPublicKey(value);
        onKey(value);
      }}
      offline={offline}
    />
  );
}
const button = (label: string) =>
  tree.root.findAllByType('Button' as any).find((n) => n.props.children === label)!;
const input = () => tree.root.findByType('KeyInput' as any);
beforeEach(() => {
  jest.clearAllMocks();
  mockStore.result = null;
  jest.spyOn(global, 'requestAnimationFrame').mockImplementation((callback) => {
    callback(0);
    return 1;
  });
});
afterEach(async () => {
  await act(async () => tree?.unmount());
  jest.restoreAllMocks();
});

it('keeps locking off by default and saves a typed public key only after confirmation', async () => {
  await act(async () => {
    tree = create(<Card />);
  });
  expect(tree.root.findByType('Switch' as any).props.checked).toBe(false);
  await act(async () => tree.root.findByType('Switch' as any).props.onCheckedChange(true));
  expect(mockPresent).toHaveBeenCalledTimes(1);
  await act(async () => input().props.onChangeText('invalid'));
  expect(button('Use public key').props.disabled).toBe(true);
  await act(async () => input().props.onChangeText(secp256k1.Point.BASE.toHex(false)));
  expect(onKey).not.toHaveBeenCalled();
  await act(async () => button('Use public key').props.onPress());
  expect(onKey).toHaveBeenCalledWith(key);
});

it('accepts pasted keys and scanner results into the sheet draft without automatically saving', async () => {
  await act(async () => {
    tree = create(<Card />);
  });
  await act(async () => tree.root.findByType('Switch' as any).props.onCheckedChange(true));
  jest.mocked(Clipboard.getStringAsync).mockResolvedValue(key);
  await act(async () => button('Paste').props.onPress());
  expect(input().props.value).toBe(key);
  await act(async () => button('Scan').props.onPress());
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/(modals)/scanner',
    params: { p2pkScanId: expect.any(String) },
  });
  const scanned = secp256k1.Point.BASE.negate().toHex(true);
  mockStore.result = { id: mockPush.mock.calls[0][0].params.p2pkScanId, value: scanned };
  await act(async () => mockFocus());
  expect(input().props.value).toBe(scanned);
  expect(mockStore.result).toBeNull();
  expect(onKey).not.toHaveBeenCalled();
  await act(async () => button('Use public key').props.onPress());
  expect(onKey).toHaveBeenCalledWith(scanned);
});

it('disables enabling a new lock offline', async () => {
  await act(async () => {
    tree = create(<Card offline />);
  });
  const toggle = tree.root.findByType('Switch' as any);
  expect(toggle.props.disabled).toBe(true);
  await act(async () => toggle.props.onCheckedChange(true));
  expect(toggle.props.checked).toBe(false);
  expect(mockPresent).not.toHaveBeenCalled();
});

it('preserves the saved key when editing or scanning is canceled and permits explicitly removing a lock offline', async () => {
  await act(async () => {
    tree = create(<Card />);
  });
  await act(async () => tree.root.findByType('Switch' as any).props.onCheckedChange(true));
  await act(async () => input().props.onChangeText(key));
  await act(async () => button('Use public key').props.onPress());
  const open = () => tree.root.findByProps({ label: 'Public key' }).props.onPress();
  await act(async () => open());
  await act(async () => input().props.onChangeText('unsaved draft'));
  await act(async () => tree.root.findByType('Sheet' as any).props.onClose());
  await act(async () => open());
  expect(input().props.value).toBe(key);
  await act(async () => button('Scan').props.onPress());
  await act(async () => mockFocus());
  expect(input().props.value).toBe(key);
  expect(onKey).toHaveBeenCalledTimes(1);
  await act(async () => tree.update(<Card offline />));
  expect(tree.root.findByType('Switch' as any).props.disabled).toBe(false);
  await act(async () => tree.root.findByType('Switch' as any).props.onCheckedChange(false));
  expect(tree.root.findByType('Switch' as any).props.checked).toBe(false);
});
