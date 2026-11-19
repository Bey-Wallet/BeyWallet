import { queryClient } from '~/shared/utils/queryClient';
import { clearDiagnosticFailures } from '~/services/feedback/diagnosticFailures';

/** Deferred store imports keep this lifecycle leaf out of the stores' initialization cycle.
 * Call with SQLite writes suspended, after wallet services and queries have stopped.
 */
export function resetWalletMemory(preserveSetup = false) {
  clearDiagnosticFailures();
  const { useWalletStore } = require('~/state/walletStore') as typeof import('~/state/walletStore');
  const { usePeopleStore } = require('~/state/peopleStore') as typeof import('~/state/peopleStore');
  const { useNostrInboxStore } =
    require('~/state/nostrInboxStore') as typeof import('~/state/nostrInboxStore');
  const { useNostrReceiveSettingsStore } =
    require('~/state/nostrReceiveSettingsStore') as typeof import('~/state/nostrReceiveSettingsStore');
  const { useNostrHistoryStore } =
    require('~/state/nostrHistoryStore') as typeof import('~/state/nostrHistoryStore');
  const { useNostrRelayStore } =
    require('~/state/nostrRelayStore') as typeof import('~/state/nostrRelayStore');
  const { useMintBackupStore } =
    require('~/state/mintBackupStore') as typeof import('~/state/mintBackupStore');
  const { useRecoverySessionStore, releaseRecoveryPause } =
    require('~/state/recoverySessionStore') as typeof import('~/state/recoverySessionStore');
  const { useMessageStore } =
    require('~/state/messageStore') as typeof import('~/state/messageStore');
  const { useNostrRequestStore } =
    require('~/state/nostrRequestStore') as typeof import('~/state/nostrRequestStore');
  const { useLightningAddressStore } =
    require('~/state/lightningAddressStore') as typeof import('~/state/lightningAddressStore');
  const { useP2PKScanStore } =
    require('~/state/p2pkScanStore') as typeof import('~/state/p2pkScanStore');
  const { useBitcoinStore } =
    require('~/state/bitcoinStore') as typeof import('~/state/bitcoinStore');
  const { useAuthStore } = require('~/state/authStore') as typeof import('~/state/authStore');
  const { useSettingsStore } =
    require('~/state/settingsStore') as typeof import('~/state/settingsStore');
  const { useOnboardingStore } =
    require('~/state/onboardingStore') as typeof import('~/state/onboardingStore');
  const { useFileRestoreStore } =
    require('~/state/fileRestoreStore') as typeof import('~/state/fileRestoreStore');

  queryClient.clear();
  useMessageStore.getState().clear();
  useNostrRequestStore.getState().clear();
  useWalletStore.setState(useWalletStore.getInitialState());
  usePeopleStore.setState(usePeopleStore.getInitialState());
  useNostrInboxStore.setState(useNostrInboxStore.getInitialState());
  useNostrReceiveSettingsStore.setState(useNostrReceiveSettingsStore.getInitialState());
  useNostrHistoryStore.setState(useNostrHistoryStore.getInitialState());
  useNostrRelayStore.setState(useNostrRelayStore.getInitialState());
  useMintBackupStore.setState(useMintBackupStore.getInitialState());
  useRecoverySessionStore.setState({ session: null });
  releaseRecoveryPause();
  useLightningAddressStore.setState(useLightningAddressStore.getInitialState());
  useP2PKScanStore.setState({ result: null });
  useBitcoinStore.setState(useBitcoinStore.getInitialState());
  useFileRestoreStore.setState({ phase: 'idle', mode: null, error: null, preview: null });
  useAuthStore.setState(useAuthStore.getInitialState());
  // Clear cached private identity and preferences before onboarding becomes visible.
  useSettingsStore.setState(useSettingsStore.getInitialState());
  if (!preserveSetup)
    useOnboardingStore.setState({
      isOnboarded: false,
      isCheckingOnboarding: false,
      currentStep: 'welcome',
      generatedMnemonic: null,
    });
}
