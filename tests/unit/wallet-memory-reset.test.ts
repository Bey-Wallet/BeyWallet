import { resetWalletMemory } from '~/services/wallet/walletMemoryReset';
import { useSettingsStore } from '~/state/settingsStore';
import { useWalletStore } from '~/state/walletStore';
import { useOnboardingStore } from '~/state/onboardingStore';
import { useAuthStore } from '~/state/authStore';
import { useP2PKScanStore } from '~/state/p2pkScanStore';
import { queryClient } from '~/shared/utils/queryClient';

function mockStore(initial: Record<string, unknown>) {
  return require('zustand').create(() => initial);
}
jest.mock('~/shared/utils/queryClient', () => ({ queryClient: { clear: jest.fn() } }));
jest.mock('~/state/walletStore', () => ({
  useWalletStore: mockStore({
    balance: 0,
    balances: {},
    mints: [],
    activeMintUrl: null,
    scannerResult: null,
    initialize: jest.fn(),
  }),
}));
jest.mock('~/state/settingsStore', () => ({
  useSettingsStore: mockStore({
    npub: null,
    nsec: null,
    nip05: null,
    initialized: false,
    biometricEnabled: false,
    theme: 'system',
    initialize: jest.fn(),
  }),
}));
jest.mock('~/state/onboardingStore', () => ({
  useOnboardingStore: mockStore({
    isOnboarded: false,
    currentStep: 'welcome',
    generatedMnemonic: null,
  }),
}));
jest.mock('~/state/authStore', () => ({
  useAuthStore: mockStore({
    isAuthenticated: false,
    hasBackgrounded: false,
    isLockDisabled: false,
  }),
}));
jest.mock('~/state/peopleStore', () => ({ usePeopleStore: mockStore({ people: {} }) }));
jest.mock('~/state/nostrInboxStore', () => ({
  useNostrInboxStore: mockStore({ items: [], activeClaimId: null }),
}));
jest.mock('~/state/nostrReceiveSettingsStore', () => ({
  useNostrReceiveSettingsStore: mockStore({ policy: 'ask' }),
}));
jest.mock('~/state/nostrHistoryStore', () => ({
  useNostrHistoryStore: mockStore({ walletId: null, restoredAt: null, includeOlder: false }),
}));
jest.mock('~/state/nostrRelayStore', () => ({
  useNostrRelayStore: mockStore({ relays: ['wss://default.example'] }),
}));
jest.mock('~/state/mintBackupStore', () => ({
  useMintBackupStore: mockStore({ automatic: true, publishing: false }),
}));
jest.mock('~/state/recoverySessionStore', () => ({
  useRecoverySessionStore: mockStore({ session: null }),
  releaseRecoveryPause: jest.fn(),
}));
jest.mock('~/state/messageStore', () => ({ useMessageStore: mockStore({ clear: jest.fn() }) }));
jest.mock('~/state/nostrRequestStore', () => ({
  useNostrRequestStore: mockStore({ clear: jest.fn() }),
}));
jest.mock('~/state/lightningAddressStore', () => ({
  useLightningAddressStore: mockStore({ pending: [], loaded: false }),
}));
jest.mock('~/state/p2pkScanStore', () => ({ useP2PKScanStore: mockStore({ result: null }) }));
jest.mock('~/state/bitcoinStore', () => ({ useBitcoinStore: mockStore({ data: null }) }));
jest.mock('~/state/fileRestoreStore', () => ({
  useFileRestoreStore: mockStore({ phase: 'idle', mode: null, error: null, preview: null }),
}));

it('removes old private identity, balances, scan results and auth while returning to onboarding with working store actions', () => {
  useSettingsStore.setState({
    nsec: 'fixture-private-identity',
    npub: 'fixture-public-identity',
    initialized: true,
    biometricEnabled: true,
    theme: 'dark',
  });
  useWalletStore.setState({
    balance: 123,
    balances: { 'https://old.example': 123 },
    activeMintUrl: 'https://old.example',
    scannerResult: 'fixture-token',
  });
  useAuthStore.setState({ isAuthenticated: true, isLockDisabled: true });
  useP2PKScanStore.setState({ result: { id: 'old', value: 'fixture-key' } });
  useOnboardingStore.setState({
    isOnboarded: true,
    currentStep: 'complete',
    generatedMnemonic: 'fixture-setup-material',
  });
  resetWalletMemory();
  expect(useSettingsStore.getState()).toMatchObject({
    nsec: null,
    npub: null,
    initialized: false,
    theme: 'system',
    biometricEnabled: false,
  });
  expect(useWalletStore.getState()).toMatchObject({
    balance: 0,
    balances: {},
    activeMintUrl: null,
    scannerResult: null,
  });
  expect(typeof useWalletStore.getState().initialize).toBe('function');
  expect(useAuthStore.getState()).toMatchObject({ isAuthenticated: false, isLockDisabled: false });
  expect(useP2PKScanStore.getState().result).toBeNull();
  expect(useOnboardingStore.getState()).toMatchObject({
    isOnboarded: false,
    isCheckingOnboarding: false,
    currentStep: 'welcome',
    generatedMnemonic: null,
  });
  expect(queryClient.clear).toHaveBeenCalled();
});

it('preserves the generated seed and current step when new-wallet initialization clears old storage', () => {
  useOnboardingStore.setState({
    currentStep: 'permissions',
    generatedMnemonic: 'fixture-new-setup-material',
  });
  resetWalletMemory(true);
  expect(useOnboardingStore.getState()).toMatchObject({
    currentStep: 'permissions',
    generatedMnemonic: 'fixture-new-setup-material',
  });
});
