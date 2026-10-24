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
  useTheme: () => ({
    color8: { val: 'gray' },
    color2: { val: 'black' },
    sheetBackground: { val: 'black' },
    overlayLight: { val: '#0F0F0F7A' },
  }),
}));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
}));
jest.mock('@gorhom/bottom-sheet', () => {
  const React = require('react');
  return {
    BottomSheetModal: React.forwardRef((props: any, ref: any) => {
      React.useImperativeHandle(ref, () => ({ present: mockPresent, dismiss: mockDismiss }));
      return React.createElement('Modal', props, props.children);
    }),
    BottomSheetView: 'View',
    BottomSheetBackdrop: 'Backdrop',
  };
});
const mockDismiss = jest.fn();
const mockPresent = jest.fn();
import AppBottomSheet, { type AppBottomSheetRef } from '~/shared/ui/AppBottomSheet';

beforeEach(() => jest.clearAllMocks());

it.each([false, true])(
  'does not reopen an approved dismissal from a stale callback (relocked: %s)',
  async (relocked) => {
    const ref = React.createRef<AppBottomSheetRef>();
    const onClose = jest.fn();
    let sheet!: ReactTestRenderer;
    const render = (canDismiss: boolean) => (
      <AppBottomSheet ref={ref} canDismiss={canDismiss} onClose={onClose}>
        <React.Fragment />
      </AppBottomSheet>
    );
    await act(async () => {
      sheet = create(render(false));
    });
    const lockedOnChange = sheet.root.findByType('Modal' as any).props.onChange;
    await act(async () => {
      sheet.update(render(true));
    });
    await act(async () => ref.current!.dismiss());
    expect(mockDismiss).toHaveBeenCalledTimes(1);
    if (relocked)
      await act(async () => {
        sheet.update(render(false));
      });
    await act(async () => lockedOnChange(-1));
    expect(mockPresent).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
    // A new presentation must restore the lock for the new operation.
    await act(async () => {
      sheet.update(render(false));
      ref.current!.present();
    });
    mockPresent.mockClear();
    await act(async () => sheet.root.findByType('Modal' as any).props.onChange(-1));
    expect(mockPresent).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    await act(async () => sheet.unmount());
  },
);

it('lets a Gorhom scrollable measure dynamic content without an extra fixed view', async () => {
  let sheet!: ReactTestRenderer;
  await act(async () => {
    sheet = create(
      <AppBottomSheet scrollable>
        <React.Fragment />
      </AppBottomSheet>,
    );
  });
  expect(sheet.root.findByType('Modal' as any).props.enableDynamicSizing).toBe(true);
  expect(sheet.root.findAllByType('View' as any)).toHaveLength(0);
  await act(async () => sheet.unmount());
});

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
