import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { nfcService } from '~/services/platform/nfcService';
import { NfcDiagnosticsControl } from '~/features/payments/receive/NfcDiagnosticsControl';

jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return Object.defineProperties(
    {},
    {
      ...Object.getOwnPropertyDescriptors(native),
      ScrollView: { value: 'ScrollView', enumerable: true },
    },
  );
});
jest.mock('expo-application', () => ({
  nativeApplicationVersion: '0.2.0',
  nativeBuildVersion: '7',
}));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => {}) }));
jest.mock('tamagui', () => ({ Text: 'Text', XStack: 'XStack', YStack: 'YStack' }));
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'Button' }));
jest.mock('~/shared/ui/AppBottomSheet', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: React.forwardRef((props: any, ref: any) => {
      React.useImperativeHandle(ref, () => ({ present: jest.fn() }));
      return React.createElement('Sheet', props, props.children);
    }),
  };
});
jest.mock('~/services/platform/nfcService', () => ({
  nfcService: {
    getDiagnostics: jest.fn(async () => ({
      androidVersion: '15',
      deviceModel: 'Test phone',
      report: 'NFC diagnostics v1 enabled=true\nACTIVATED',
    })),
    clearDiagnostics: jest.fn(async () => {}),
  },
}));

let tree: ReactTestRenderer;
const originalOS = Platform.OS;
const originalDev = __DEV__;
beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
});
afterEach(async () => {
  if (tree!) await act(async () => tree.unmount());
  Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS });
  (globalThis as any).__DEV__ = originalDev;
});
async function press(label: string) {
  await act(async () => {
    await tree.root
      .findAllByType('Button' as any)
      .find((b) => b.props.children === label)!
      .props.onPress();
  });
}

it('refreshes on open, copies a fresh report with device metadata, and clears the buffer', async () => {
  await act(async () => {
    tree = create(<NfcDiagnosticsControl />);
  });
  await press('NFC diagnostics');
  expect(nfcService.getDiagnostics).toHaveBeenCalledTimes(1);
  await press('Refresh');
  await press('Copy report');
  expect(Clipboard.setStringAsync).toHaveBeenCalledWith(
    'Bey 0.2.0 (7)\nAndroid 15\nModel Test phone\nNFC diagnostics v1 enabled=true\nACTIVATED',
  );
  await press('Clear');
  expect(nfcService.clearDiagnostics).toHaveBeenCalledTimes(1);
  expect(nfcService.getDiagnostics).toHaveBeenCalledTimes(4);
});

it('shows a fixed error without exposing native exception messages', async () => {
  jest
    .mocked(nfcService.getDiagnostics)
    .mockRejectedValueOnce(new Error('cashuB_SYNTHETIC_SECRET'));
  await act(async () => {
    tree = create(<NfcDiagnosticsControl />);
  });
  await press('NFC diagnostics');
  const rendered = JSON.stringify(tree.toJSON());
  expect(rendered).toContain('Could not complete diagnostics action');
  expect(rendered).not.toContain('SYNTHETIC_SECRET');
});

it.each(['release', 'ios'])('hides diagnostics on %s', async (mode) => {
  if (mode === 'release') (globalThis as any).__DEV__ = false;
  else Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
  await act(async () => {
    tree = create(<NfcDiagnosticsControl />);
  });
  expect(tree.toJSON()).toBeNull();
  expect(nfcService.getDiagnostics).not.toHaveBeenCalled();
});
