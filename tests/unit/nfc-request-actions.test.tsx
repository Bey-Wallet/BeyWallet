jest.mock('~/services/wallet/nfcReceiveCoordinator', () => ({
  nfcReceiveCoordinator: {
    getSnapshot: () => ({ status: 'idle' }),
    subscribe: () => () => {},
    setReady: jest.fn(),
    processPending: jest.fn(async () => {}),
    retry: jest.fn(),
  },
}));
jest.mock('~/shared/ui/PaymentAmount', () => ({ PaymentAmount: 'PaymentAmount' }));
jest.mock('~/shared/ui/ListTable', () => ({
  ListTable: 'ListTable',
  ListTableRow: 'ListTableRow',
}));
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { AppState, Modal } from 'react-native';
import { appColors } from '~/shared/theme/appearance';

let mockAppearance: 'dark' | 'light' = 'light';
const mockSheetPresent = jest.fn();
const mockSheetDismiss = jest.fn();
jest.mock('@gorhom/bottom-sheet', () => ({ BottomSheetScrollView: 'ScrollView' }));
jest.mock('react-native-screens', () => ({ FullWindowOverlay: 'Overlay' }));
jest.mock('~/shared/ui/AppBottomSheet', () => ({
  __esModule: true,
  default: require('react').forwardRef((props: any, ref: any) => {
    require('react').useImperativeHandle(ref, () => ({
      present: mockSheetPresent,
      dismiss: mockSheetDismiss,
    }));
    return require('react').createElement('Sheet', props, props.children);
  }),
}));

jest.mock('tamagui', () => ({
  Button: 'Button',
  Text: 'Text',
  View: 'View',
  XStack: 'XStack',
  YStack: 'YStack',
  useTheme: () => ({
    color: { val: mockAppearance === 'dark' ? '#D9D9D9' : '#000000' },
    gray3: { val: require('~/shared/theme/appearance').appColors[mockAppearance].raised },
    iconPrimary: { val: mockAppearance === 'dark' ? '#FFFFFF' : '#000000' },
  }),
}));
jest.mock('@tamagui/lucide-icons', () => ({
  ArrowUpRight: 'Icon',
  ArrowDownLeft: 'Icon',
  AlertTriangle: 'Icon',
  Settings2: 'Icon',
  Ban: 'Icon',
  Check: 'Icon',
  X: 'X',
}));
jest.mock('~/shared/icons/NfcIcon', () => 'Icon');
jest.mock('~/shared/ui/Spinner', () => ({ Spinner: 'Spinner' }));
jest.mock('~/shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('~/shared/ui/HeaderIconButton', () => ({ HeaderIconButton: 'HeaderIconButton' }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 0 }),
}));
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
    foreground: jest.fn(),
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
  mockAppearance = 'light';
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

it('shows startup progress before asking users to hold phones together', async () => {
  mockState = {
    ...mockState,
    status: 'starting',
    hasPayment: false,
    canRetryDelivery: false,
    message: 'Starting NFC…',
  };
  let sheet!: ReactTestRenderer;
  await act(async () => {
    sheet = create(<NfcSheetHost walletReady />);
  });
  expect(
    sheet.root.findAllByType('Text' as any).some((text) => text.props.children === 'Starting NFC'),
  ).toBe(true);
  expect(sheet.root.findAllByType('Spinner' as any)).toHaveLength(1);
  expect(sheet.root.findByProps({ testID: 'nfc-sheet-status' }).props).toMatchObject({
    items: 'center',
    justify: 'center',
  });
  mockState = {
    ...mockState,
    status: 'ready',
    message: 'Hold phones together to receive ecash or read a payment request.',
  };
  await act(async () => {
    sheet.update(<NfcSheetHost walletReady />);
  });
  expect(
    sheet.root
      .findAllByType('Text' as any)
      .some((text) => text.props.children === 'Hold phones together'),
  ).toBe(true);
  await act(async () => sheet.unmount());
});

it('offers Done after confirmation without retrying or refreshing the payment', async () => {
  mockState = {
    ...mockState,
    status: 'confirmed',
    canRetryDelivery: false,
    amount: 21,
    message: 'Payment confirmed.',
  };
  let sheet!: ReactTestRenderer;
  await act(async () => {
    sheet = create(<NfcSheetHost walletReady />);
  });
  const buttons = sheet.root.findAllByType('Button' as any);
  expect(buttons.map((button) => button.props.accessibilityLabel)).toEqual(['Done']);
  expect(sheet.root.findByType('PaymentAmount' as any).props).toMatchObject({
    amount: 21,
    size: 'prominent',
  });
  await act(async () => buttons[0].props.onPress({}));
  expect(nfcFlow.dismiss).toHaveBeenCalledTimes(1);
  expect(nfcFlow.retry).not.toHaveBeenCalled();
  expect(nfcFlow.refresh).not.toHaveBeenCalled();
  await act(async () => sheet.unmount());
});

it('presents NFC as a bottom sheet and protects dismissal during a payment', async () => {
  let sheet!: ReactTestRenderer;
  await act(async () => {
    sheet = create(<NfcSheetHost walletReady />);
  });
  const presentation = () => sheet.root.findByType('Sheet' as any);
  const close = () => sheet.root.findByProps({ accessibilityLabel: 'Close NFC' });
  expect(sheet.root.findAllByType(Modal)).toHaveLength(0);
  expect(mockSheetPresent).toHaveBeenCalledTimes(1);
  expect(presentation().props.canDismiss).toBe(true);
  expect(presentation().props.scrollable).toBe(true);
  expect(presentation().props.snapPoints).toBeUndefined();
  await act(async () => presentation().props.onClose());
  expect(nfcFlow.dismiss).toHaveBeenCalledTimes(1);
  mockState = { ...mockState, locked: true };
  // Read the current controller lock even before React has updated the button.
  await act(async () => close().props.onPress());
  expect(nfcFlow.dismiss).toHaveBeenCalledTimes(1);
  await act(async () => {
    sheet.update(<NfcSheetHost walletReady />);
  });
  expect(close().props.disabled).toBe(true);
  expect(presentation().props.canDismiss).toBe(false);
  await act(async () => presentation().props.onClose());
  expect(nfcFlow.dismiss).toHaveBeenCalledTimes(1);
  mockState = { ...mockState, locked: false };
  await act(async () => {
    sheet.update(<NfcSheetHost walletReady />);
  });
  await act(async () => close().props.onPress());
  expect(nfcFlow.dismiss).toHaveBeenCalledTimes(2);
  mockState = { ...mockState, visible: false };
  await act(async () => {
    sheet.update(<NfcSheetHost walletReady />);
  });
  expect(mockSheetDismiss).toHaveBeenCalledTimes(1);
  await act(async () => sheet.unmount());
});

it.each(['dark', 'light'] as const)(
  'keeps the NFC glyph visible on its neutral %s circle',
  async (appearance) => {
    mockAppearance = appearance;
    mockState = { ...mockState, status: 'ready' };
    let sheet!: ReactTestRenderer;
    await act(async () => {
      sheet = create(<NfcSheetHost walletReady />);
    });
    const icon = sheet.root.findByType('Icon' as any);
    expect(icon.props.color).toBe(appColors[appearance].icon);
    expect(icon.parent!.props.backgroundColor).toBe(appColors[appearance].raised);
    expect(icon.props.color).not.toBe(icon.parent!.props.backgroundColor);
    await act(async () => sheet.unmount());
  },
);

it('offers delivery retry, settlement refresh and History when delivery is unconfirmed', async () => {
  let sheet!: ReactTestRenderer;
  await act(async () => {
    sheet = create(<NfcSheetHost walletReady />);
  });
  const buttons = sheet.root.findAllByType('Button' as any);
  const retry = buttons.find((button) => button.props.accessibilityLabel === 'Retry delivery');
  const refresh = buttons.find((button) => button.props.accessibilityLabel === 'Refresh status');
  expect(retry).toBeDefined();
  expect(refresh).toBeDefined();
  expect(buttons.some((button) => button.props.accessibilityLabel === 'View History')).toBe(true);
  await act(async () => {
    retry!.props.onPress();
    refresh!.props.onPress();
  });
  expect(nfcFlow.retry).toHaveBeenCalledTimes(1);
  expect(nfcFlow.refresh).toHaveBeenCalledTimes(1);
  await act(async () => sheet.unmount());
});

it('synchronizes foreground state on host remount without waiting for an AppState change', async () => {
  const previous = AppState.currentState;
  AppState.currentState = 'active';
  let sheet!: ReactTestRenderer;
  try {
    await act(async () => {
      sheet = create(<NfcSheetHost walletReady />);
    });
    expect(nfcFlow.foreground).toHaveBeenCalledTimes(1);
    await act(async () => sheet.unmount());
    expect(nfcFlow.background).toHaveBeenCalled();
    await act(async () => {
      sheet = create(<NfcSheetHost walletReady />);
    });
    expect(nfcFlow.foreground).toHaveBeenCalledTimes(2);
    await act(async () => sheet.unmount());
  } finally {
    AppState.currentState = previous;
  }
});

it('offers settlement refresh without delivery retry after acknowledged publication', async () => {
  mockState = { ...mockState, status: 'pending', canRetryDelivery: false };
  let sheet!: ReactTestRenderer;
  await act(async () => {
    sheet = create(<NfcSheetHost walletReady />);
  });
  const buttons = sheet.root.findAllByType('Button' as any);
  expect(buttons.map((button) => button.props.accessibilityLabel)).toEqual(['Refresh status']);
  await act(async () => sheet.unmount());
});

it('keeps NFC retry and refresh blocked while the session is locked', async () => {
  mockState = { ...mockState, locked: true };
  let sheet!: ReactTestRenderer;
  await act(async () => {
    sheet = create(<NfcSheetHost walletReady />);
  });
  for (const button of sheet.root.findAllByType('Button' as any)) {
    expect(button.props.disabled).toBe(true);
    button.props.onPress({});
  }
  expect(nfcFlow.retry).not.toHaveBeenCalled();
  expect(nfcFlow.refresh).not.toHaveBeenCalled();
  await act(async () => sheet.unmount());
});
