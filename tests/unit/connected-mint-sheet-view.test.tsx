import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import {
  ConnectedMintSheetView,
  type ConnectedMintSheetViewProps,
} from '~/features/mints/components/ConnectedMintSheetView';

jest.mock('tamagui', () => ({ XStack: 'XStack', YStack: 'YStack' }));
jest.mock('~/shared/icons', () => new Proxy({}, { get: (_, name) => String(name) }));
jest.mock('~/shared/ui/AppText', () => ({ AppText: 'Text' }));
jest.mock('~/shared/ui/AppPressable', () => ({ AppPressable: 'Pressable' }));
jest.mock('~/shared/ui/HeaderIconButton', () => ({ HeaderIconButton: 'HeaderButton' }));
jest.mock('~/features/settings/components/SettingsLayout', () => ({
  SettingsGroup: 'Group',
  SettingsRow: 'Row',
}));
let tree: ReactTestRenderer;
const fields: ConnectedMintSheetViewProps = {
  name: 'Mint',
  url: 'https://mint.example',
  icon: null,
  amount: '24,000',
  unit: 'sat',
  connection: 'Online',
  offline: false,
  units: 'sat',
  payments: 'Lightning, BOLT 12, On-chain',
  removeDisabled: true,
  onClose: jest.fn(),
  onCopy: jest.fn(),
  onRemove: jest.fn(),
  onRefresh: jest.fn(),
  onTransfer: jest.fn(),
  onRecover: jest.fn(),
  onQr: jest.fn(),
  onRename: jest.fn(),
  onDetails: jest.fn(),
};
afterEach(async () => {
  await act(async () => tree?.unmount());
  jest.clearAllMocks();
});
it('shows connection first and allows every payment method to wrap without truncation', async () => {
  await act(async () => {
    tree = create(<ConnectedMintSheetView {...fields} />);
  });
  const group = tree.root.findAllByType('Group' as any)[0];
  expect(group.children[0]).toMatchObject({ props: {} });
  expect((group.children[0] as any).findByProps({ children: 'Connection' })).toBeDefined();
  const methods = tree.root.findByProps({ children: fields.payments });
  expect(methods.props.numberOfLines).toBeUndefined();
  expect(methods.props.ellipsizeMode).toBeUndefined();
  const rows = tree.root.findAllByType('Row' as any);
  expect(rows.map((row) => row.props.title)).toEqual(['Units', 'View full mint details']);
  expect(rows.at(-1)!.props.onPress).toBe(fields.onDetails);
  expect(tree.root.findAllByProps({ bg: '$green3' })).toHaveLength(0);
});

it('opens QR from its tile and separates name editing from URL copying', async () => {
  await act(async () => {
    tree = create(<ConnectedMintSheetView {...fields} />);
  });
  tree.root.findByProps({ accessibilityLabel: 'QR' }).props.onPress();
  expect(fields.onQr).toHaveBeenCalledTimes(1);
  tree.root.findByProps({ accessibilityLabel: 'Rename Mint' }).props.onPress();
  expect(fields.onRename).toHaveBeenCalledTimes(1);
  expect(fields.onCopy).not.toHaveBeenCalled();
  tree.root.findByProps({ accessibilityLabel: 'Copy mint URL' }).props.onPress();
  expect(fields.onCopy).toHaveBeenCalledTimes(1);
  expect(tree.root.findByProps({ accessibilityLabel: 'Recover' })).toBeDefined();
});

it('keeps tile actions guarded while disabled or busy', async () => {
  await act(async () => {
    tree = create(<ConnectedMintSheetView {...fields} transferDisabled />);
  });
  const transfer = () => tree.root.findByProps({ accessibilityLabel: 'Transfer' });
  transfer().props.onPress();
  expect(fields.onTransfer).not.toHaveBeenCalled();
  await act(async () => tree.update(<ConnectedMintSheetView {...fields} busy />));
  transfer().props.onPress();
  expect(fields.onTransfer).not.toHaveBeenCalled();
  await act(async () => tree.update(<ConnectedMintSheetView {...fields} />));
  transfer().props.onPress();
  expect(fields.onTransfer).toHaveBeenCalledTimes(1);
});
it('only offers a connection refresh while offline/checking and wires its callback', async () => {
  await act(async () => {
    tree = create(<ConnectedMintSheetView {...fields} />);
  });
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Refresh mint connection' })).toHaveLength(
    0,
  );
  await act(async () =>
    tree.update(<ConnectedMintSheetView {...fields} offline connection="Offline" />),
  );
  tree.root.findByProps({ accessibilityLabel: 'Refresh mint connection' }).props.onPress();
  expect(fields.onRefresh).toHaveBeenCalledTimes(1);
});
it('replaces the remove control with an enabled Done action while editing a funded mint', async () => {
  const save = jest.fn();
  const cancel = jest.fn();
  await act(async () => {
    tree = create(
      <ConnectedMintSheetView
        {...fields}
        renameEditor={{ input: <></>, onSave: save, onCancel: cancel }}
      />,
    );
  });
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Remove mint' })).toHaveLength(0);
  const done = tree.root.findByProps({ accessibilityLabel: 'Save mint name' });
  expect(done.props.icon).toBe('Check');
  expect(done.props.disabled).toBe(false);
  done.props.onPress();
  expect(save).toHaveBeenCalledTimes(1);
  tree.root.findByProps({ accessibilityLabel: 'Cancel renaming' }).props.onPress();
  expect(cancel).toHaveBeenCalledTimes(1);
});
