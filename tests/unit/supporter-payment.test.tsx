import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { SupporterContent } from '~/features/supporter/SupporterContent';
import { SupporterModal } from '~/features/supporter/SupporterModal';
import { SupporterSettingsScreen } from '~/features/supporter/SupporterSettingsScreen';
import {
  SUPPORT_LIGHTNING_ADDRESS,
  SUPPORT_PAYMENT_ROUTE,
} from '~/features/supporter/supporterPayment';

const mockCopy = jest.fn();
const mockPay = jest.fn();
const mockClose = jest.fn();
const mockDismiss = jest.fn();
const mockPush = jest.fn();
let mockPlatform = 'ios';
let mockFocused = true;
jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  StyleSheet: { create: (styles: unknown) => styles },
  Platform: {
    get OS() {
      return mockPlatform;
    },
  },
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
jest.mock('~/shared/ui/AppFullScreenModal', () => ({ AppFullScreenModal: 'Modal' }));
jest.mock('~/state/supporterStore', () => ({
  useSupporterStore: (selector: any) =>
    selector({ homeCardDismissed: false, dismissHomeCard: mockDismiss }),
}));

let tree: ReactTestRenderer;
const button = (label: string) =>
  tree.root.findAllByType('Button' as any).find((b) => b.props.children === label)!;
beforeEach(() => {
  jest.clearAllMocks();
  mockPlatform = 'ios';
  mockFocused = true;
  mockCopy.mockResolvedValue(undefined);
});
afterEach(async () => {
  await act(async () => tree?.unmount());
});
async function open(content = <SupporterContent onPay={mockPay} onDoNotShowAgain={mockDismiss} />) {
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
  expect(button('Copied')).toBeDefined();
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
  expect(JSON.stringify(tree.toJSON())).toContain('Could not copy. Try again.');
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

it('dismisses the native iOS support modal before opening the payment route', async () => {
  await open(
    <SupporterModal
      visible
      animationType="slide"
      onClose={mockClose}
      onPay={mockPay}
      onDoNotShowAgain={mockDismiss}
    />,
  );
  await act(async () => button('Pay now').props.onPress());
  expect(mockClose).toHaveBeenCalledTimes(1);
  expect(mockPay).not.toHaveBeenCalled();
  await act(async () => tree.root.findByType('Modal' as any).props.onDismiss());
  expect(mockPay).toHaveBeenCalledTimes(1);
  await act(async () => tree.root.findByType('Modal' as any).props.onDismiss());
  expect(mockPay).toHaveBeenCalledTimes(1);
});

it('opens Android payment without relying on the iOS-only dismissal callback', async () => {
  mockPlatform = 'android';
  await open(
    <SupporterModal
      visible
      animationType="none"
      onClose={mockClose}
      onPay={mockPay}
      onDoNotShowAgain={mockDismiss}
    />,
  );
  await act(async () => button('Pay now').props.onPress());
  expect(mockClose).toHaveBeenCalledTimes(1);
  expect(mockPay).toHaveBeenCalledTimes(1);
});

it('opens the same Lightning payment flow from Settings and retains Home dismissal', async () => {
  await open(<SupporterSettingsScreen />);
  await act(async () => button('Do not show again').props.onPress());
  expect(mockDismiss).toHaveBeenCalledTimes(1);
  expect(mockPush).not.toHaveBeenCalled();
  await act(async () => button('Pay now').props.onPress());
  expect(mockPush).toHaveBeenCalledWith(SUPPORT_PAYMENT_ROUTE);
  expect(SUPPORT_PAYMENT_ROUTE.params).toEqual({
    lightningAddress: SUPPORT_LIGHTNING_ADDRESS,
    source: 'support',
  });
});
