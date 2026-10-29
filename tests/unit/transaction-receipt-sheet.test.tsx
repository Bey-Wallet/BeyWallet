import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { TransactionReceiptSheet } from '~/features/history/components/TransactionReceiptSheet';
import { useReceiptSheet } from '~/shared/ui/ReceiptSheetContext';
const mockPresent = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();
let mockCanBack = true;
let mockAuthenticated = true;
const mockRouter = { canGoBack: () => mockCanBack, back: mockBack, replace: mockReplace };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('tamagui', () => ({ YStack: 'YStack', Text: 'Text', ScrollView: 'ScrollView' }));
jest.mock('~/shared/ui/Spinner', () => ({ Spinner: 'Spinner' }));
jest.mock('~/shared/ui/AppTextButton', () => ({ AppTextButton: 'TextButton' }));
jest.mock('~/state/authStore', () => ({
  useAuthStore: (select: any) => select({ isAuthenticated: mockAuthenticated }),
}));
jest.mock('~/state/settingsStore', () => ({
  useSettingsStore: (select: any) => select({ biometricEnabled: true }),
}));
jest.mock('~/shared/ui/ListTable', () => ({
  ListTableVariantProvider: ({ children }: any) => children,
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 30, bottom: 20 }),
}));
jest.mock('@gorhom/bottom-sheet', () => ({ BottomSheetScrollView: 'SheetScrollView' }));
jest.mock('~/shared/ui/AppBottomSheet', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: React.forwardRef(({ children, ...props }: any, ref: any) => {
      React.useImperativeHandle(ref, () => ({ present: mockPresent, dismiss: jest.fn() }));
      return React.createElement('Sheet', props, children);
    }),
  };
});
let tree: ReactTestRenderer;
beforeEach(() => {
  jest.clearAllMocks();
  mockCanBack = true;
  mockAuthenticated = true;
});
afterEach(async () => {
  await act(async () => tree?.unmount());
});
it('presents a content-sized sheet and returns to its originating list', async () => {
  await act(async () => {
    tree = create(<TransactionReceiptSheet>Receipt</TransactionReceiptSheet>);
  });
  expect(mockPresent).toHaveBeenCalledTimes(1);
  const sheet = tree.root.findByType('Sheet' as any);
  expect(sheet.props).toMatchObject({ scrollable: true, canDismiss: true });
  expect(sheet.props.snapPoints).toBeUndefined();
  sheet.props.onClose();
  expect(mockBack).toHaveBeenCalledTimes(1);
});
function CloseControl() {
  const context = useReceiptSheet();
  return React.createElement('CloseControl' as any, { onPress: context!.close });
}

it('keeps active transactions full screen after settlement and blocks closing during operations', async () => {
  await act(async () => {
    tree = create(
      <TransactionReceiptSheet active expanded busy>
        <CloseControl />
      </TransactionReceiptSheet>,
    );
  });
  expect(tree.root.findAllByType('Sheet' as any)).toHaveLength(0);
  tree.root.findByType('CloseControl' as any).props.onPress();
  expect(mockBack).not.toHaveBeenCalled();
  await act(async () => {
    tree.update(
      <TransactionReceiptSheet>
        <CloseControl />
      </TransactionReceiptSheet>,
    );
  });
  expect(tree.root.findAllByType('Sheet' as any)).toHaveLength(0);
  expect(tree.root.findAllByType('ScrollView' as any)).toHaveLength(1);
  tree.root.findByType('CloseControl' as any).props.onPress();
  expect(mockBack).toHaveBeenCalledTimes(1);
});

it('waits for classification before presenting a settled receipt sheet', async () => {
  await act(async () => {
    tree = create(<TransactionReceiptSheet ready={false}>Loading</TransactionReceiptSheet>);
  });
  expect(mockPresent).not.toHaveBeenCalled();
  expect(tree.root.findAllByProps({ testID: 'transaction-full-screen' })).toHaveLength(0);
  expect(tree.root.findAllByProps({ testID: 'transaction-loading-overlay' })).toHaveLength(1);
  expect(tree.root.findAllByType('Sheet' as any)).toHaveLength(0);
  await act(async () => {
    tree.update(<TransactionReceiptSheet>Receipt</TransactionReceiptSheet>);
  });
  expect(mockPresent).toHaveBeenCalledTimes(1);
  expect(tree.root.findAllByType('Sheet' as any)).toHaveLength(1);
});
it('allows loading cancellation without presenting a receipt or bypassing busy guards', async () => {
  await act(async () => {
    tree = create(
      <TransactionReceiptSheet ready={false} busy>
        Loading
      </TransactionReceiptSheet>,
    );
  });
  tree.root.findByType('TextButton' as any).props.onPress();
  expect(mockBack).not.toHaveBeenCalled();
  await act(async () => {
    tree.update(<TransactionReceiptSheet ready={false}>Loading</TransactionReceiptSheet>);
  });
  tree.root.findByType('TextButton' as any).props.onPress();
  expect(mockBack).toHaveBeenCalledTimes(1);
  expect(mockPresent).not.toHaveBeenCalled();
});

it('keeps one receipt sheet mounted during later detail refreshes', async () => {
  await act(async () => {
    tree = create(<TransactionReceiptSheet>Receipt</TransactionReceiptSheet>);
  });
  await act(async () => {
    tree.update(<TransactionReceiptSheet ready={false}>Refreshing</TransactionReceiptSheet>);
  });
  expect(tree.root.findAllByProps({ testID: 'transaction-loading-overlay' })).toHaveLength(0);
  expect(tree.root.findAllByProps({ testID: 'transaction-full-screen' })).toHaveLength(0);
  expect(tree.root.findAllByType('Sheet' as any)).toHaveLength(1);
  await act(async () => {
    tree.update(<TransactionReceiptSheet>Updated receipt</TransactionReceiptSheet>);
  });
  expect(mockPresent).toHaveBeenCalledTimes(1);
});
it('masks receipt content when locked and provides a direct-entry fallback', async () => {
  mockAuthenticated = false;
  mockCanBack = false;
  await act(async () => {
    tree = create(<TransactionReceiptSheet>SENSITIVE RECEIPT</TransactionReceiptSheet>);
  });
  expect(JSON.stringify(tree.toJSON())).not.toContain('SENSITIVE RECEIPT');
  tree.root.findByType('Sheet' as any).props.onClose();
  expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
});
