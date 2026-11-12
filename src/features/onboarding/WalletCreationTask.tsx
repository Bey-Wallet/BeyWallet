import { useEffect, useRef } from 'react';
import * as Haptics from 'expo-haptics';

/** Completes creation as soon as generation and the completion callback finish. */
export function WalletCreationTask({
  open,
  onComplete,
  generateMnemonic,
  onError,
}: {
  open: boolean;
  onComplete: (mnemonic: string) => void | Promise<void>;
  generateMnemonic: () => string;
  onError: (error: unknown) => void;
}) {
  const started = useRef(false);
  const callbacks = useRef({ onComplete, generateMnemonic, onError });
  callbacks.current = { onComplete, generateMnemonic, onError };
  useEffect(() => {
    if (!open) {
      started.current = false;
      return;
    }
    if (started.current) return;
    started.current = true;
    void (async () => {
      const mnemonic = callbacks.current.generateMnemonic();
      if (mnemonic) {
        await callbacks.current.onComplete(mnemonic);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
    })().catch((error: unknown) => callbacks.current.onError(error));
  }, [open]);
  return null;
}
