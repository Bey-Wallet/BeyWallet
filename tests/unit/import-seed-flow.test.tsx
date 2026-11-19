import React from 'react';
import { BackHandler } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import * as Clipboard from 'expo-clipboard';
import { ImportSeedStep } from '~/features/onboarding/ImportSeedStep';
import { walletFileService } from '~/services/platform/walletFileService';

jest.mock('~/services/platform/walletFileService', () => ({
  walletFileService: { selectWalletBackupFile: jest.fn() },
}));

const mockPresent = jest.fn();
jest.mock('~/shared/components/info-sheets/InfoSheet', () => ({
  InfoSheet: require('react').forwardRef((props: any, ref: any) => {
    require('react').useImperativeHandle(ref, () => ({ present: mockPresent, dismiss: jest.fn() }));
    return require('react').createElement('InfoSheet', props);
  }),
}));
jest.mock('~/shared/ui/BUI/BUIHeader', () => ({
  BUIHeader: (props: any) => require('react').createElement('Header', props, props.actions),
  BUIHeaderAction: 'HeaderAction',
}));
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'Button' }));
jest.mock('~/shared/ui/AppInput', () => ({ AppInput: 'Input' }));
jest.mock('~/shared/ui/AppText', () => ({ AppText: 'Text' }));
jest.mock('~/shared/ui/AppPressable', () => ({ AppPressable: 'Pressable' }));
jest.mock('~/shared/ui/BUI/BUISelectionControl', () => ({
  BUISelectionRow: ({ onCheckedChange, ...props }: any) =>
    require('react').createElement('Checkbox', {
      ...props,
      accessibilityRole: 'checkbox',
      onPress: () => {
        if (!props.disabled) onCheckedChange(!props.checked);
      },
    }),
}));
jest.mock('~/shared/hooks/useAppToast', () => ({
  useAppToast: () => ({ openExternal: jest.fn() }),
}));
jest.mock('tamagui', () =>
  Object.fromEntries(
    ['YStack', 'XStack', 'Text', 'ScrollView', 'View', 'Separator'].map((name) => [name, name]),
  ),
);
jest.mock('@tamagui/lucide-icons', () =>
  Object.fromEntries(
    [
      'CircleHelp',
      'ClipboardPaste',
      'CheckCircle2',
      'AlertCircle',
      'Trash2',
      'Lock',
      'Key',
      'AlertTriangle',
      'FileText',
      'ChevronRight',
      'Check',
      'Landmark',
      'Sprout',
      'ExternalLink',
    ].map((name) => [name, name]),
  ),
);
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 16 }),
}));
jest.mock('expo-clipboard', () => ({ getStringAsync: jest.fn() }));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));

// Public BIP39 test vector; never use this phrase for funds.
const phrase = `${'abandon '.repeat(11)}about`;
const onImport = jest.fn();
const onImportFromFile = jest.fn();
const onBack = jest.fn();
let tree: ReactTestRenderer;
beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(BackHandler, 'addEventListener');
  jest.mocked(Clipboard.getStringAsync).mockResolvedValue(phrase);
  jest.mocked(walletFileService.selectWalletBackupFile).mockResolvedValue('file:///backup.json');
});
afterEach(async () => {
  await act(async () => tree?.unmount());
  jest.restoreAllMocks();
});

async function render() {
  await act(async () => {
    tree = create(
      <ImportSeedStep onImport={onImport} onImportFromFile={onImportFromFile} onBack={onBack} />,
    );
  });
}
const button = (label: string) =>
  tree.root.findAllByType('Button' as any).find((node) => node.props.children === label)!;
const header = () => tree.root.findByType('Header' as any);
const acknowledgment = () => tree.root.findByProps({ accessibilityRole: 'checkbox' });
async function enterPhrase() {
  await act(async () => button('Paste').props.onPress());
  await act(async () => button('Continue').props.onPress());
}

it('uses a top-left BUI back action, opens help on demand, and has no inline consent', async () => {
  await render();
  expect(header().props).toMatchObject({
    title: 'Enter seed phrase',
    navigation: 'back',
    topInset: 24,
  });
  expect(button('Back')).toBeUndefined();
  expect(tree.root.findAllByProps({ accessibilityRole: 'checkbox' })).toHaveLength(0);
  expect(button('Continue').props.disabled).toBe(true);
  await act(async () => button('Continue').props.onPress());
  expect(header().props.title).toBe('Enter seed phrase');
  await act(async () => tree.root.findByType('HeaderAction' as any).props.onPress());
  expect(mockPresent).toHaveBeenCalledTimes(1);
  expect(tree.root.findByType('InfoSheet' as any).props.topic).toBe('import-seed');
  expect(onImport).not.toHaveBeenCalled();
  await act(async () => header().props.onNavigate());
  expect(onBack).toHaveBeenCalledTimes(1);
});

it('requires the separate risk acknowledgment before starting import', async () => {
  await render();
  await enterPhrase();
  expect(header().props.title).toBe('Risk acknowledgment');
  expect(onImport).not.toHaveBeenCalled();
  expect(button('Agree & Continue').props.disabled).toBe(true);
  await act(async () => button('Agree & Continue').props.onPress());
  expect(onImport).not.toHaveBeenCalled();
  await act(async () => acknowledgment().props.onPress());
  expect(button('Agree & Continue').props.disabled).toBe(false);
  await act(async () => button('Agree & Continue').props.onPress());
  expect(onImport).toHaveBeenCalledTimes(1);
  expect(onImport).toHaveBeenCalledWith(phrase);
});

it('preserves entered words on back and requires acknowledgment again on re-entry', async () => {
  await render();
  await enterPhrase();
  await act(async () => acknowledgment().props.onPress());
  await act(async () => header().props.onNavigate());
  expect(header().props.title).toBe('Enter seed phrase');
  expect(button('Continue').props.disabled).toBe(false);
  expect(tree.root.findAllByProps({ children: 'about' })).toHaveLength(1);
  expect(onBack).not.toHaveBeenCalled();
  await act(async () => button('Continue').props.onPress());
  expect(button('Agree & Continue').props.disabled).toBe(true);
  expect(onImport).not.toHaveBeenCalled();
});

it('keeps invalid phrases on seed entry', async () => {
  jest.mocked(Clipboard.getStringAsync).mockResolvedValue('abandon '.repeat(12).trim());
  await render();
  await act(async () => button('Paste').props.onPress());
  expect(button('Continue').props.disabled).toBe(true);
  await act(async () => button('Continue').props.onPress());
  expect(header().props.title).toBe('Enter seed phrase');
  expect(onImport).not.toHaveBeenCalled();
});

it('routes Android back to seed entry and blocks navigation and resubmission while importing', async () => {
  await render();
  await enterPhrase();
  const hardwareBack = () => jest.mocked(BackHandler.addEventListener).mock.calls.at(-1)![1]();
  await act(async () => {
    expect(hardwareBack()).toBe(true);
  });
  expect(header().props.title).toBe('Enter seed phrase');
  await act(async () => button('Continue').props.onPress());
  await act(async () => acknowledgment().props.onPress());
  await act(async () => button('Agree & Continue').props.onPress());
  await act(async () =>
    tree.update(
      <ImportSeedStep
        onImport={onImport}
        onImportFromFile={onImportFromFile}
        onBack={onBack}
        isImporting
      />,
    ),
  );
  expect(header().props.navigationDisabled).toBe(true);
  expect(button('Agree & Continue').props).toMatchObject({ disabled: true, loading: true });
  await act(async () => {
    header().props.onNavigate();
    button('Agree & Continue').props.onPress();
    hardwareBack();
  });
  expect(onImport).toHaveBeenCalledTimes(1);
  expect(onBack).not.toHaveBeenCalled();
  expect(header().props.title).toBe('Risk acknowledgment');
});

it('selects a backup without processing it until risk acceptance', async () => {
  await render();
  expect(button('Import backup file').props).toMatchObject({ size: 'small', emphasis: 'text' });
  await act(async () => button('Import backup file').props.onPress());
  expect(walletFileService.selectWalletBackupFile).toHaveBeenCalledTimes(1);
  expect(header().props.title).toBe('Risk acknowledgment');
  expect(onImportFromFile).not.toHaveBeenCalled();
  await act(async () => button('Agree & Continue').props.onPress());
  expect(onImportFromFile).not.toHaveBeenCalled();
  await act(async () => acknowledgment().props.onPress());
  await act(async () => button('Agree & Continue').props.onPress());
  expect(onImportFromFile).toHaveBeenCalledWith('file:///backup.json');
  expect(onImport).not.toHaveBeenCalled();
});

it('discards a selected file on back and preserves seed entry', async () => {
  await render();
  await act(async () => button('Paste').props.onPress());
  await act(async () => button('Import backup file').props.onPress());
  await act(async () => header().props.onNavigate());
  expect(button('Continue').props.disabled).toBe(false);
  expect(onImportFromFile).not.toHaveBeenCalled();
  await act(async () => button('Continue').props.onPress());
  await act(async () => acknowledgment().props.onPress());
  await act(async () => button('Agree & Continue').props.onPress());
  expect(onImport).toHaveBeenCalledWith(phrase);
  expect(onImportFromFile).not.toHaveBeenCalled();
});

it('stays on seed entry when file selection is cancelled', async () => {
  jest
    .mocked(walletFileService.selectWalletBackupFile)
    .mockRejectedValueOnce(new Error('File selection was cancelled.'));
  await render();
  await act(async () => button('Import backup file').props.onPress());
  expect(header().props.title).toBe('Enter seed phrase');
  expect(onImportFromFile).not.toHaveBeenCalled();
  expect(
    tree.root.findAllByProps({ children: 'Could not select a backup file. Please try again.' }),
  ).toHaveLength(0);
});
