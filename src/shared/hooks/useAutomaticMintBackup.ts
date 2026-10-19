import { useEffect } from 'react';
import { AppState } from 'react-native';

/** Run quietly once the wallet is ready and when returning from the background. */
export function useAutomaticMintBackup(walletReady: boolean) {
  useEffect(() => {
    if (!walletReady) return;
    let mounted = true;
    const backup = () => {
      if (!mounted) return;
      const { publishMintBackup } =
        require('~/services/wallet/mintBackupService') as typeof import('~/services/wallet/mintBackupService');
      void publishMintBackup(true).catch(() => {});
    };
    let backgrounded = AppState.currentState === 'background';
    let initial = true;
    if (AppState.currentState === 'active') {
      initial = false;
      backup();
    }
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') backgrounded = true;
      if (state === 'active' && (initial || backgrounded)) {
        initial = false;
        backgrounded = false;
        backup();
      }
    });
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, [walletReady]);
}
