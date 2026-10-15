import { useEffect, useRef } from 'react';
import * as Haptics from 'expo-haptics';

/** Runs the existing creation sequence independently of progress presentation. */
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
      await delay(800);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await delay(600);
      const mnemonic = callbacks.current.generateMnemonic();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await delay(700);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await delay(500);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await delay(400);
      if (mnemonic) await callbacks.current.onComplete(mnemonic);
    })().catch((error: unknown) => callbacks.current.onError(error));
  }, [open]);
  return null;
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}
