import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { RootLayout } from '~/shared/layout/RootLayout';
import { DatabaseEncryptionUnavailableError } from '~/storage/sqlite/encryptedDatabase';
import { useFileRestoreStore } from '~/state/fileRestoreStore';

let mockStorageFailure: Error | null = null;
let mockActiveFailure = false;
const mockOpenActive = jest.fn(() => {
  if (mockActiveFailure) throw new Error('damaged active');
  return {};
});
const mockInitialize = jest.fn();
const mockRecover = jest.fn(async () => {
  useFileRestoreStore.setState({ phase: 'idle' });
  return false;
});
const mockCheckOnboarding = jest.fn(async () => false);
const mockWalletExists = jest.fn(async () => false);
jest.mock('~/storage/sqlite/sqliteStorage', () => ({
  getDb: () => {
    if (mockStorageFailure) throw mockStorageFailure;
    return mockOpenActive();
  },
}));
jest.mock('~/storage/sqlite/encryptedDatabase', () => ({
  DatabaseEncryptionUnavailableError: class extends Error {},
  WalletDeletionPendingError: class extends Error {},
  assertEncryptedStorageAvailable: () => {
    if (mockStorageFailure) throw mockStorageFailure;
  },
}));
jest.mock('~/state/walletStore', () => ({
  useWalletStore: (selector: any) =>
    selector({ initialize: mockInitialize, isInitializing: false }),
}));
const mockSettings = { initialized: true, initialize: jest.fn() };
jest.mock('~/state/settingsStore', () => ({
  useSettingsStore: Object.assign((selector: any) => selector(mockSettings), {
    getState: () => mockSettings,
  }),
}));
jest.mock('~/state/onboardingStore', () => ({
  useOnboardingStore: () => ({
    isOnboarded: false,
    isCheckingOnboarding: false,
    checkOnboardingStatus: mockCheckOnboarding,
  }),
}));
jest.mock('~/services/wallet', () => ({
  initService: {
    resumePendingWalletDeletion: async () => {},
    walletExists: () => mockWalletExists(),
    getManager: () => null,
  },
}));
jest.mock('~/services/wallet/fileRestoreService', () => ({
  fileRestoreService: { recoverOnStartup: () => mockRecover() },
}));
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('expo-router', () => ({
  SplashScreen: { preventAutoHideAsync: jest.fn(), hideAsync: jest.fn() },
}));
jest.mock('tamagui', () => ({ YStack: 'YStack', Text: 'Text' }));
jest.mock('@tanstack/react-query', () => ({
  QueryClient: class {},
  QueryClientProvider: 'QueryProvider',
}));
jest.mock('~/shared/ui/Provider', () => ({ Provider: 'Provider' }));
jest.mock('~/shared/layout/RootLayoutNav', () => ({ RootLayoutNav: 'Nav' }));
jest.mock('~/features/onboarding', () => ({ OnboardingScreen: 'Onboarding' }));
jest.mock('~/features/nostr/components/NostrPaymentReceived', () => ({
  NostrPaymentReceived: 'Received',
}));
jest.mock('~/features/nostr/components/NostrClaimSheet', () => ({ NostrClaimSheet: 'Claim' }));
jest.mock('~/features/nfc/NfcSheetHost', () => ({ NfcSheetHost: 'Nfc' }));
jest.mock('~/shared/hooks/useAutomaticMintBackup', () => ({ useAutomaticMintBackup: jest.fn() }));
jest.mock('~/shared/utils/bitcoinPriceQueryCache', () => ({ hydrateBitcoinPriceCache: jest.fn() }));
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'Button' }));
jest.mock('~/features/settings/FileRestoreGate', () => ({ FileRestoreGate: 'Restore' }));

let tree: ReactTestRenderer;
beforeEach(() => {
  jest.clearAllMocks();
  mockStorageFailure = null;
  mockActiveFailure = false;
  useFileRestoreStore.setState({ phase: 'checking', error: null });
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
});
async function mount() {
  await act(async () => {
    tree = create(<RootLayout />);
  });
}

it('does not show onboarding or begin recovery when encrypted storage is unavailable', async () => {
  mockStorageFailure = new DatabaseEncryptionUnavailableError();
  await mount();
  expect(tree.root.findAllByType('Onboarding' as any)).toHaveLength(0);
  expect(mockRecover).not.toHaveBeenCalled();
  expect(mockCheckOnboarding).not.toHaveBeenCalled();
  expect(mockInitialize).not.toHaveBeenCalled();
  expect(JSON.stringify(tree.toJSON())).toContain('Install the updated app build');
});

it('keeps missing-key diagnostics private and permits a retry without resetting a wallet', async () => {
  mockStorageFailure = new Error('synthetic-private-SQL-key');
  await mount();
  expect(JSON.stringify(tree.toJSON())).not.toContain('synthetic-private');
  expect(JSON.stringify(tree.toJSON())).toContain('has not been reset');
  mockStorageFailure = null;
  await act(async () => tree.root.findByType('Button' as any).props.onPress());
  expect(mockRecover).toHaveBeenCalledTimes(1);
  expect(tree.root.findAllByType('Onboarding' as any)).toHaveLength(1);
});

it('opens the normal onboarding screen directly for a new user once storage opens', async () => {
  await mount();
  expect(tree.root.findAllByType('Onboarding' as any)).toHaveLength(1);
  expect(tree.root.findAllByType('Button' as any)).toHaveLength(0);
  expect(mockInitialize).not.toHaveBeenCalled();
});

it('lets journal recovery repair an interrupted install before opening the active database', async () => {
  mockActiveFailure = true;
  mockRecover.mockImplementationOnce(async () => {
    mockActiveFailure = false;
    useFileRestoreStore.setState({ phase: 'idle' });
    return false;
  });
  await mount();
  expect(mockRecover).toHaveBeenCalledTimes(1);
  expect(mockOpenActive).toHaveBeenCalledTimes(1);
  expect(tree.root.findAllByType('Onboarding' as any)).toHaveLength(1);
});

it('leaves installed-wallet validation to the existing initialization/rollback flow', async () => {
  mockActiveFailure = true;
  mockRecover.mockImplementationOnce(async () => {
    useFileRestoreStore.setState({ phase: 'idle' });
    return true;
  });
  await mount();
  expect(mockOpenActive).not.toHaveBeenCalled();
  expect(mockCheckOnboarding).toHaveBeenCalledTimes(1);
});
