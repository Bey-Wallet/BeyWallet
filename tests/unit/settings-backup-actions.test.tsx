jest.mock('@tamagui/toast', () => ({
  useToastController: () => ({ show: jest.fn(), hide: jest.fn() }),
}));
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Alert, StyleSheet } from 'react-native';
import { seedService } from '~/services/platform/seedService';
import {
  RecoveryPhraseSettingsScreen,
  ExportBackupSettingsScreen,
  RestoreBackupSettingsScreen,
  DeleteWalletSettingsScreen,
} from '~/features/settings/BackupScreens';

const mockAuthenticate = jest.fn();
const mockExport = jest.fn();
const mockImport = jest.fn();
const mockPrepare = jest.fn();
jest.mock('~/services/wallet/fileRestoreService', () => ({
  fileRestoreService: { prepare: (...args: unknown[]) => mockPrepare(...args) },
}));
const mockExportState = jest.fn();
const mockImportState = jest.fn();
const mockDestroy = jest.fn(async () => {});
const mockRestore = jest.fn(async (..._args: unknown[]) => {});
const mockReinit = jest.fn(async () => {});
const mockCopy = jest.fn(async () => {});
jest.mock('~/shared/hooks/useAppToast', () => ({ useAppToast: () => ({ copy: mockCopy }) }));
const mockSettings = {
  secondaryCurrency: 'USD',
  theme: 'dark',
  setSecondaryCurrency: jest.fn(async () => {}),
  setTheme: jest.fn(async () => {}),
  setBackupDismissedAt: jest.fn(async () => {}),
  setSeedBackedUp: jest.fn(async () => {}),
};
jest.mock('@react-navigation/native', () => ({ usePreventRemove: jest.fn() }));
jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void) => require('react').useEffect(callback, [callback]),
}));
jest.mock('tamagui', () => ({ Text: 'Text', XStack: 'XStack', YStack: 'YStack' }));
jest.mock('~/shared/icons', () => ({
  Copy: 'Copy',
  EyeOff: 'EyeOff',
  FileDown: 'FileDown',
  FileUp: 'FileUp',
  ShieldCheck: 'ShieldCheck',
  Trash2: 'Trash2',
}));
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'AppButton' }));
jest.mock('~/features/settings/components/SettingsLayout', () => ({
  SettingsPage: 'Page',
  SettingsMessage: 'Message',
  SettingsDescription: 'Description',
}));
jest.mock('~/services/platform/biometricService', () => ({
  biometricService: { authenticateAsync: (...args: unknown[]) => mockAuthenticate(...args) },
}));
jest.mock('~/services/platform/seedService', () => ({
  seedService: { getMnemonic: jest.fn(async () => 'test-backup-material') },
}));
jest.mock('~/services/platform/walletFileService', () => ({
  walletFileService: {
    exportWallet: (...args: unknown[]) => mockExport(...args),
    importWalletFromFile: () => mockImport(),
  },
}));
jest.mock('~/services/wallet/backupService', () => ({
  backupService: {
    exportState: () => mockExportState(),
    importState: (...args: unknown[]) => mockImportState(...args),
  },
}));
jest.mock('~/services/wallet', () => ({
  initService: {
    destroyWallet: () => mockDestroy(),
    restoreWallet: (...args: unknown[]) => mockRestore(...args),
    reinitFast: () => mockReinit(),
  },
}));
jest.mock('~/state/settingsStore', () => ({
  useSettingsStore: Object.assign((selector: any) => selector(mockSettings), {
    getState: () => mockSettings,
  }),
}));
jest.mock('~/state/onboardingStore', () => ({
  useOnboardingStore: { getState: () => ({ resetOnboarding: jest.fn() }) },
}));

beforeEach(() => jest.clearAllMocks());

it('deletes only after authentication and the explicit delete action, without asking for an app restart', async () => {
  const alert = jest.spyOn(Alert, 'alert');
  mockAuthenticate.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<DeleteWalletSettingsScreen />);
  });
  const buttons = () => tree.root.findAllByType('AppButton' as any);
  await act(async () => buttons()[0].props.onPress());
  expect(mockDestroy).not.toHaveBeenCalled();
  await act(async () => buttons()[0].props.onPress());
  expect(mockDestroy).not.toHaveBeenCalled();
  const remove = buttons().find(
    (node) => node.props.children === 'I’ve backed up, delete everything',
  )!;
  await act(async () => remove.props.onPress());
  expect(mockDestroy).toHaveBeenCalledTimes(1);
  expect(alert).not.toHaveBeenCalled();
  expect(buttons()[0].props.children).toBe('Authenticate to continue');
  await act(async () => tree.unmount());
  alert.mockRestore();
});

it('authenticates phrase access and offers only side-by-side Copy and Hide actions', async () => {
  const phrase = Array.from({ length: 12 }, (_, index) => `fixture${index + 1}`).join(' ');
  jest.mocked(seedService.getMnemonic).mockResolvedValueOnce(phrase);
  mockAuthenticate.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<RecoveryPhraseSettingsScreen />);
  });
  try {
    const buttons = () => tree.root.findAllByType('AppButton' as any);
    await act(async () => buttons()[0].props.onPress());
    expect(buttons().map((button) => button.props.children)).toEqual(['Reveal recovery phrase']);
    await act(async () => buttons()[0].props.onPress());
    expect(buttons().map((button) => button.props.children)).toEqual(['Copy', 'Hide']);
    expect(buttons()[0].parent).toBe(buttons()[1].parent);
    const row = buttons()[0].parent!.props;
    expect(row.flexDirection ?? StyleSheet.flatten(row.style)?.flexDirection).toBe('row');
    for (const label of ['11.', '12.']) {
      const number = tree.root.findByProps({ children: label }).props;
      expect(number.numberOfLines).toBe(1);
      expect(number.flexShrink ?? StyleSheet.flatten(number.style)?.flexShrink).toBe(0);
    }
    await act(async () => buttons()[0].props.onPress());
    expect(mockCopy).toHaveBeenCalledWith(phrase);
    expect(mockSettings.setSeedBackedUp).not.toHaveBeenCalled();
    await act(async () => buttons()[1].props.onPress());
    expect(buttons().map((button) => button.props.children)).toEqual(['Reveal recovery phrase']);
    expect(tree.root.findAllByProps({ children: 'fixture12' })).toHaveLength(0);
  } finally {
    await act(async () => tree.unmount());
  }
});

it('does not export when authentication is rejected and blocks duplicate export taps', async () => {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<ExportBackupSettingsScreen />);
  });
  const press = () => tree.root.findByType('AppButton' as any).props.onPress();
  mockAuthenticate.mockResolvedValueOnce(false);
  await act(async () => press());
  expect(mockExportState).not.toHaveBeenCalled();
  expect(mockExport).not.toHaveBeenCalled();
  let complete!: (value: boolean) => void;
  mockAuthenticate.mockReturnValueOnce(
    new Promise((resolve) => {
      complete = resolve;
    }),
  );
  mockExportState.mockResolvedValue({
    mints: [],
    keysets: [],
    proofs: [],
    counters: [],
    history: [],
    mintQuotes: [],
    changeOperations: [],
  });
  mockExport.mockResolvedValue('backup.json');
  await act(async () => {
    press();
    press();
  });
  expect(mockAuthenticate).toHaveBeenCalledTimes(2);
  await act(async () => complete(true));
  expect(mockExport).toHaveBeenCalledTimes(1);
  expect(mockDestroy).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});

it('requires authentication, confirmation and a parsed backup before preparing a restore without deleting the wallet', async () => {
  let confirm!: () => void;
  const alert = jest.spyOn(Alert, 'alert').mockImplementation((title, _message, buttons) => {
    if (title === 'Prepare backup restore')
      confirm = buttons!.find((button) => button.text === 'Continue')!.onPress as () => void;
  });
  mockAuthenticate.mockResolvedValue(true);
  mockImport.mockRejectedValueOnce(new Error('File selection was cancelled.'));
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<RestoreBackupSettingsScreen />);
  });
  const press = () => tree.root.findByType('AppButton' as any).props.onPress();
  await act(async () => press());
  expect(mockImport).not.toHaveBeenCalled();
  expect(mockDestroy).not.toHaveBeenCalled();
  await act(async () => confirm());
  expect(mockDestroy).not.toHaveBeenCalled();
  const payload = {
    mnemonic: 'test-backup-material',
    mints: [],
    keysets: [],
    proofs: [],
    counters: [],
    history: [],
    mintQuotes: [],
    changeOperations: [{ id: 'change-test' }],
    defaultMintUrl: 'https://mint.example',
    secondaryCurrency: 'USD',
    theme: 'dark',
  };
  mockImport.mockResolvedValueOnce(payload);
  await act(async () => press());
  await act(async () => confirm());
  expect(mockPrepare).toHaveBeenCalledWith(payload);
  expect(mockDestroy).not.toHaveBeenCalled();
  expect(mockRestore).not.toHaveBeenCalled();
  expect(mockImportState).not.toHaveBeenCalled();
  expect(mockReinit).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
  alert.mockRestore();
});
