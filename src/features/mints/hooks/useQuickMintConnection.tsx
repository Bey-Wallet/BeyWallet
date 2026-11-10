import React, { useCallback, useEffect, useRef, useState } from 'react';
import { usePreventRemove } from '@react-navigation/native';
import type { AppBottomSheetRef } from '~/shared/ui/AppBottomSheet';
import { useWalletStore } from '~/state/walletStore';
import { useSettingsStore } from '~/state/settingsStore';
import { useAppToast } from '~/shared/hooks/useAppToast';
import { interactionCopy } from '~/services/feedback/interactionCopy';
import { mintUrlKey } from '~/shared/utils/mintUrl';
import { connectMint } from '../connectMint';
import { MintTrustSheet, type MintConnectionTarget } from '../components/MintTrustSheet';

/** Quick add stays on its owning screen, with explicit or previously remembered consent. */
export function useQuickMintConnection() {
  const sheetRef = useRef<AppBottomSheetRef>(null);
  const lock = useRef(false);
  const [mint, setMint] = useState<MintConnectionTarget | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ url: string; message: string } | null>(null);
  const [remember, setRemember] = useState(false);
  const [presentation, setPresentation] = useState(0);
  const [finished, setFinished] = useState(false);
  const toast = useAppToast();
  usePreventRemove(busy, () => {});

  useEffect(() => {
    if (presentation) sheetRef.current?.present();
  }, [presentation]);
  useEffect(() => {
    if (finished && !busy) sheetRef.current?.dismiss();
  }, [finished, busy]);

  const confirm = useCallback(
    async (target: MintConnectionTarget, rememberChoice: boolean, direct = false) => {
      if (lock.current) return;
      lock.current = true;
      setBusy(true);
      setError(null);
      try {
        await connectMint(target.url);
        const settings = useSettingsStore.getState();
        if (rememberChoice !== settings.hideMintConnectionDisclaimer) {
          await settings.setHideMintConnectionDisclaimer(rememberChoice);
        }
        setFinished(true);
        toast.showFeedback(interactionCopy.mintConnected);
      } catch (cause) {
        setError({
          url: mintUrlKey(target.url),
          message: cause instanceof Error ? cause.message : 'Could not connect to this mint.',
        });
        if (direct) setPresentation((value) => value + 1);
      } finally {
        lock.current = false;
        setBusy(false);
      }
    },
    [toast],
  );

  const requestConnection = useCallback(
    async (target: MintConnectionTarget) => {
      if (lock.current) return;
      if (
        useWalletStore
          .getState()
          .mints.some((item) => item.trusted && mintUrlKey(item.mintUrl) === mintUrlKey(target.url))
      )
        return;
      setMint(target);
      setError(null);
      setFinished(false);
      const remembered = useSettingsStore.getState().hideMintConnectionDisclaimer;
      setRemember(remembered);
      if (remembered) await confirm(target, true, true);
      else setPresentation((value) => value + 1);
    },
    [confirm],
  );

  return {
    requestConnection,
    connectingUrl: busy && mint ? mintUrlKey(mint.url) : null,
    connectionError: error,
    sheet: (
      <MintTrustSheet
        ref={sheetRef}
        mint={mint}
        busy={busy}
        error={error?.message}
        remember={remember}
        onRememberChange={setRemember}
        onConfirm={() => (mint ? confirm(mint, remember) : undefined)}
      />
    ),
  };
}
