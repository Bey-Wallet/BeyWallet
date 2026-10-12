import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('tamagui', () => ({
  Button: 'Button',
  Text: 'Text',
  View: 'View',
  XStack: 'XStack',
  YStack: 'YStack',
  useTheme: () => ({ color: { val: 'black' } }),
}));
jest.mock('react-native-screens', () => ({ FullWindowOverlay: 'Overlay' }));
jest.mock('@tamagui/lucide-icons', () => ({
  ArrowUpRight: 'Icon',
  ArrowDownLeft: 'Icon',
  AlertTriangle: 'Icon',
  Settings2: 'Icon',
  Ban: 'Icon',
  Check: 'Icon',
}));
jest.mock('~/shared/icons/NfcIcon', () => 'Icon');
jest.mock('~/shared/ui/Spinner', () => ({ Spinner: 'Spinner' }));
jest.mock('~/shared/ui/AppBottomSheet', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: React.forwardRef((props: any, _ref: any) =>
      React.createElement('Sheet', props, props.children),
    ),
  };
});
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));
jest.mock('~/state/authStore', () => ({
  useAuthStore: (select: any) => select({ isAuthenticated: true }),
}));
jest.mock('~/state/settingsStore', () => ({
  useSettingsStore: (select: any) => select({ biometricEnabled: false, initialized: true }),
}));
jest.mock('~/state/walletStore', () => ({
  useWalletStore: (select: any) => select({ mints: [] }),
}));
jest.mock('~/services/platform/nfcService', () => ({ nfcService: { goToNfcSetting: jest.fn() } }));
jest.mock('~/features/nfc/nfcFlow', () => ({
  nfcFlow: {
    subscribe: () => () => {},
    getSnapshot: () => mockState,
    setReady: jest.fn(),
    background: jest.fn(),
    dismiss: jest.fn(() => true),
    retry: jest.fn(),
    refresh: jest.fn(),
  },
}));

import { NfcSheetHost } from '~/features/nfc/NfcSheetHost';
import { nfcFlow, type NfcPresentation } from '~/features/nfc/nfcFlow';

let mockState: NfcPresentation;
beforeEach(() => {
  jest.clearAllMocks();
  mockState = {
    visible: true,
    status: 'unconfirmed',
    direction: 'pay',
    message: 'Delivery unconfirmed.',
    locked: false,
    hasPayment: true,
    canRetryDelivery: true,
  };
});

it('offers delivery retry, settlement refresh and History when delivery is unconfirmed', async () => {
  let sheet!: ReactTestRenderer;
  await act(async () => {
    sheet = create(<NfcSheetHost walletReady />);
  });
  const buttons = sheet.root.findAllByType('Button' as any);
  const retry = buttons.find((button) => button.props.children === 'Retry delivery');
  const refresh = buttons.find((button) => button.props.children === 'Refresh status');
  expect(retry).toBeDefined();
  expect(refresh).toBeDefined();
  expect(buttons.some((button) => button.props.children === 'View History')).toBe(true);
  await act(async () => {
    retry!.props.onPress();
    refresh!.props.onPress();
  });
  expect(nfcFlow.retry).toHaveBeenCalledTimes(1);
  expect(nfcFlow.refresh).toHaveBeenCalledTimes(1);
  await act(async () => sheet.unmount());
});

it('offers settlement refresh without delivery retry after acknowledged publication', async () => {
  mockState = { ...mockState, status: 'pending', canRetryDelivery: false };
  let sheet!: ReactTestRenderer;
  await act(async () => {
    sheet = create(<NfcSheetHost walletReady />);
  });
  const buttons = sheet.root.findAllByType('Button' as any);
  expect(buttons.map((button) => button.props.children)).toEqual(['Refresh status']);
  await act(async () => sheet.unmount());
});
