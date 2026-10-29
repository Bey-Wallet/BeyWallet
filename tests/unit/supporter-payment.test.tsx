import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { SupporterContent } from '~/features/supporter/SupporterContent';
import { SupporterSettingsScreen } from '~/features/supporter/SupporterSettingsScreen';
import {
  SUPPORT_LIGHTNING_ADDRESS,
  SUPPORT_PAYMENT_ROUTE,
} from '~/features/supporter/supporterPayment';

const mockCopy = jest.fn();
const mockToastShow = jest.fn();
jest.mock('@tamagui/toast', () => ({
  useToastController: () => ({ show: mockToastShow, hide: jest.fn() }),
}));
const mockPay = jest.fn();
const mockPush = jest.fn();
let mockFocused = true;
jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  StyleSheet: { create: (styles: unknown) => styles },
  useWindowDimensions: () => ({ width: 360 }),
}));
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => mockFocused }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('expo-clipboard', () => ({ setStringAsync: (...args: unknown[]) => mockCopy(...args) }));
jest.mock('tamagui', () => ({
  ScrollView: 'ScrollView',
  Text: 'Text',
  YStack: 'YStack',
  View: 'View',
  XStack: 'XStack',
}));
jest.mock('@tamagui/lucide-icons', () => ({
  Copy: 'Copy',
  Code2: 'Code2',
  HeartHandshake: 'HeartHandshake',
  ClipboardCheck: 'ClipboardCheck',
}));
jest.mock('~/shared/theme/appearance', () => ({ appTypography: {}, appSpacing: { large: 32 } }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 24 }) }));
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'Button' }));
jest.mock('~/shared/ui/CustomQRCode', () => ({ CustomQRCode: 'QRCode' }));

let tree: ReactTestRenderer;
const button = (label: string) =>
  tree.root.findAllByType('Button' as any).find((b) => b.props.children === label)!;
beforeEach(() => {
  jest.clearAllMocks();
  mockFocused = true;
  mockCopy.mockResolvedValue(undefined);
});
afterEach(async () => {
  await act(async () => tree?.unmount());
});
async function open(content = <SupporterContent onPay={mockPay} />) {
  await act(async () => {
    tree = create(content);
  });
}

it('shows a static Lightning-address QR and copies the exact recipient without invoicing', async () => {
  await open();
  expect(tree.root.findByType('QRCode' as any).props.value).toBe(
    `lightning:${SUPPORT_LIGHTNING_ADDRESS}`,
  );
  expect(tree.root.findByType('QRCode' as any).props.size).toBeLessThanOrEqual(360 - 64);
  await act(async () => button('Copy').props.onPress());
  expect(mockCopy).toHaveBeenCalledWith('beywallet@blitzwalletapp.com');
  expect(mockToastShow).toHaveBeenCalledWith(
    'Copied',
    expect.objectContaining({ duration: 1000, kind: 'success' }),
  );
  expect(mockPay).not.toHaveBeenCalled();
  const content = JSON.stringify(tree.toJSON());
  expect(content).toContain('Built in the open.');
  expect(content).toContain('Time to build and maintain');
  expect(content).toContain('Always optional. Still your wallet.');
  expect(content).not.toMatch(/monthly|yearly|preview|USD|membership/i);
  expect(content).toContain('One-time support. No subscription.');
});

it('handles failed clipboard writes without showing a false copied confirmation', async () => {
  mockCopy.mockRejectedValueOnce(new Error('Clipboard unavailable'));
  await open();
  await act(async () => button('Copy').props.onPress());
  expect(button('Copy')).toBeDefined();
  expect(mockToastShow).toHaveBeenCalledWith(
    'Could not copy',
    expect.objectContaining({ duration: 4000, kind: 'error' }),
  );
  expect(mockToastShow).toHaveBeenCalledTimes(1);
});

it('guards duplicate Pay now presses and allows another payment after returning', async () => {
  await open();
  await act(async () => {
    button('Pay now').props.onPress();
    button('Pay now').props.onPress();
  });
  expect(mockPay).toHaveBeenCalledTimes(1);
  mockFocused = false;
  await act(async () => tree.update(<SupporterContent onPay={mockPay} />));
  mockFocused = true;
  await act(async () => tree.update(<SupporterContent onPay={mockPay} />));
  await act(async () => button('Pay now').props.onPress());
  expect(mockPay).toHaveBeenCalledTimes(2);
});

it('keeps support available in Settings without a Home dismissal control', async () => {
  await open(<SupporterSettingsScreen />);
  expect(button('Do not show again')).toBeUndefined();
  expect(mockPush).not.toHaveBeenCalled();
  await act(async () => button('Pay now').props.onPress());
  expect(mockPush).toHaveBeenCalledWith(SUPPORT_PAYMENT_ROUTE);
  expect(SUPPORT_PAYMENT_ROUTE.params).toEqual({
    lightningAddress: SUPPORT_LIGHTNING_ADDRESS,
    source: 'support',
  });
});
