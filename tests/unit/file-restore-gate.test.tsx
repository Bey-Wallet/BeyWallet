import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { reloadAppAsync } from 'expo';
import { StyleSheet } from 'react-native';
import { FileRestoreGate } from '~/features/settings/FileRestoreGate';
import { useFileRestoreStore } from '~/state/fileRestoreStore';

jest.mock('expo', () => ({ reloadAppAsync: jest.fn(async () => {}) }));
jest.mock('tamagui', () => ({
  Text: 'Text',
  YStack: 'YStack',
  XStack: 'XStack',
  ScrollView: 'ScrollView',
}));
jest.mock('~/shared/ui/AppText', () => ({ AppText: 'Text' }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 20 }),
}));
jest.mock('@tamagui/lucide-icons', () => ({
  AlertCircle: 'AlertCircle',
  CheckCircle2: 'CheckCircle2',
  FileCheck2: 'FileCheck2',
}));
jest.mock('~/shared/ui/Spinner', () => ({ Spinner: 'Spinner' }));
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'AppButton' }));
jest.mock('~/services/wallet/fileRestoreService', () => ({
  fileRestoreService: { finish: jest.fn(), cancel: jest.fn() },
}));

let tree: ReactTestRenderer;
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(reloadAppAsync).mockResolvedValue(undefined);
  useFileRestoreStore.setState({ phase: 'preparing', mode: 'merge', error: null, preview: null });
});
afterEach(async () => {
  await act(async () => tree?.unmount());
});

it('centers the processing spinner and title as one group', async () => {
  await act(async () => {
    tree = create(<FileRestoreGate />);
  });
  const layout = tree.root.findByProps({ testID: 'file-restore-status' }).props;
  const style = StyleSheet.flatten(layout.style) ?? {};
  expect(layout.flex ?? style.flex).toBe(1);
  expect(layout.justify ?? layout.justifyContent ?? style.justifyContent).toBe('center');
  expect(layout.items ?? layout.alignItems ?? style.alignItems).toBe('center');
  const text = tree.root.findAllByType('Text' as any);
  expect(
    text.map((node) => node.props.textAlign ?? StyleSheet.flatten(node.props.style)?.textAlign),
  ).toEqual(['center']);
  expect(tree.root.findAllByType('Spinner' as any)).toHaveLength(1);
  expect(tree.root.findAllByType('AppButton' as any)).toHaveLength(0);
});

it('keeps review actions in a safe-area footer outside the scrollable content', async () => {
  useFileRestoreStore.setState({ phase: 'ready', mode: 'replace' });
  await act(async () => {
    tree = create(<FileRestoreGate />);
  });
  const footer = tree.root.findByProps({ testID: 'file-restore-actions' });
  const actions = footer.findAllByType('AppButton' as any);
  expect(actions.map((action) => action.props.children)).toEqual([
    'Replace wallet',
    'Cancel restore',
  ]);
  expect(actions.every((action) => action.props.size === 'large' && action.props.fullWidth)).toBe(
    true,
  );
  expect(tree.root.findByType('ScrollView' as any).findAllByType('AppButton' as any)).toHaveLength(
    0,
  );
});

it('shows the amount, mint and separate pending funds before confirmation', async () => {
  useFileRestoreStore.setState({
    phase: 'ready',
    mode: 'new',
    preview: {
      balance: 1200,
      pendingBalance: 30,
      mints: [
        { mintUrl: 'https://mint.test', name: 'Test mint', balance: 1200, pendingBalance: 30 },
      ],
    },
  });
  await act(async () => {
    tree = create(<FileRestoreGate />);
  });
  const content = JSON.stringify(tree.toJSON());
  expect(content).toContain('1,200 sat');
  expect(content).toContain('Mints (1)');
  expect(content).toContain('Test mint');
  expect(content).toContain('30 sat pending or reserved');
  expect(tree.root.findAllByType('AppButton' as any)[0].props.children).toBe('Restore wallet');
});

it('shows a success result only for the completed restore and opens the wallet on acknowledgment', async () => {
  useFileRestoreStore.setState({ phase: 'success', mode: 'new' });
  await act(async () => {
    tree = create(<FileRestoreGate />);
  });
  expect(JSON.stringify(tree.toJSON())).toContain('Backup restored');
  expect(tree.root.findAllByType('CheckCircle2' as any)).toHaveLength(1);
  expect(reloadAppAsync).not.toHaveBeenCalled();
  const action = tree.root.findByType('AppButton' as any);
  expect(action.props.children).toBe('Open wallet');
  await act(async () => action.props.onPress());
  expect(useFileRestoreStore.getState().phase).toBe('idle');
});

it('opens the restored wallet automatically once, with no restart button', async () => {
  useFileRestoreStore.setState({ phase: 'restart' });
  await act(async () => {
    tree = create(<FileRestoreGate />);
  });
  expect(reloadAppAsync).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(tree.toJSON())).toContain('Opening wallet');
  expect(tree.root.findAllByType('AppButton' as any)).toHaveLength(0);
  await act(async () => {
    useFileRestoreStore.setState({ mode: 'replace' });
  });
  expect(reloadAppAsync).toHaveBeenCalledTimes(1);
});

it('offers a manual retry if automatic opening fails', async () => {
  useFileRestoreStore.setState({ phase: 'restart' });
  jest.mocked(reloadAppAsync).mockRejectedValueOnce(new Error('Reload unavailable'));
  await act(async () => {
    tree = create(<FileRestoreGate />);
  });
  const button = tree.root.findByType('AppButton' as any);
  expect(button.props.children).toBe('Try opening wallet again');
  expect(JSON.stringify(tree.toJSON())).toContain('Close and reopen the app');
  await act(async () => {
    await button.props.onPress();
  });
  expect(reloadAppAsync).toHaveBeenCalledTimes(2);
});

it('keeps a recovery error visible until the user chooses to reopen the wallet', async () => {
  useFileRestoreStore.setState({ phase: 'restart', error: 'Your previous wallet is unchanged.' });
  await act(async () => {
    tree = create(<FileRestoreGate />);
  });
  expect(reloadAppAsync).not.toHaveBeenCalled();
  expect(JSON.stringify(tree.toJSON())).toContain('Your previous wallet is unchanged.');
  expect(tree.root.findByType('AppButton' as any).props.children).toBe('Try opening wallet again');
});
