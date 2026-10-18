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
import { BackHandler } from 'react-native';

jest.mock('tamagui', () => ({
  useTheme: () => ({ color8: { val: 'gray' }, color2: { val: 'black' } }),
}));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
}));
jest.mock('@gorhom/bottom-sheet', () => {
  const React = require('react');
  return {
    BottomSheetModal: React.forwardRef((props: any, ref: any) => {
      React.useImperativeHandle(ref, () => ({ present: jest.fn(), dismiss: mockDismiss }));
      return React.createElement('Modal', props, props.children);
    }),
    BottomSheetView: 'View',
    BottomSheetBackdrop: 'Backdrop',
  };
});
const mockDismiss = jest.fn();
import AppBottomSheet, { type AppBottomSheetRef } from '~/shared/ui/AppBottomSheet';

it('guards Android Back, backdrop, swipe and imperative dismissal consistently', async () => {
  let back!: () => boolean | null | undefined;
  const listener = jest
    .spyOn(BackHandler, 'addEventListener')
    .mockImplementation((_name, callback) => {
      back = callback;
      return { remove: jest.fn() };
    });
  const ref = React.createRef<AppBottomSheetRef>();
  const onOpenChange = jest.fn();
  let sheet!: ReactTestRenderer;
  await act(async () => {
    sheet = create(
      <AppBottomSheet ref={ref} canDismiss={false} onOpenChange={onOpenChange}>
        <React.Fragment />
      </AppBottomSheet>,
    );
  });
  const modal = () => sheet.root.findByType('Modal' as any);
  await act(async () => modal().props.onChange(0));
  expect(onOpenChange).toHaveBeenLastCalledWith(true);
  await act(async () => modal().props.onChange(-1));
  expect(onOpenChange).toHaveBeenCalledTimes(1);
  expect(back()).toBe(true);
  ref.current?.dismiss();
  expect(mockDismiss).not.toHaveBeenCalled();
  expect(modal().props.enablePanDownToClose).toBe(false);
  expect(modal().props.backdropComponent({}).props.pressBehavior).toBe('none');
  await act(async () => {
    sheet.update(
      <AppBottomSheet ref={ref} onOpenChange={onOpenChange}>
        <React.Fragment />
      </AppBottomSheet>,
    );
  });
  expect(modal().props.enablePanDownToClose).toBe(true);
  expect(modal().props.backdropComponent({}).props.pressBehavior).toBe('close');
  expect(back()).toBe(true);
  ref.current?.dismiss();
  expect(mockDismiss).toHaveBeenCalledTimes(2);
  await act(async () => modal().props.onChange(-1));
  expect(onOpenChange).toHaveBeenLastCalledWith(false);
  await act(async () => sheet.unmount());
  listener.mockRestore();
});
