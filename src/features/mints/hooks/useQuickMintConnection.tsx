import React, { useCallback, useEffect, useRef, useState } from 'react';
import { usePreventRemove } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import type { AppBottomSheetRef } from '~/shared/ui/AppBottomSheet';
import { useWalletStore } from '~/state/walletStore';
import { useAppToast } from '~/shared/hooks/useAppToast';
import { interactionCopy } from '~/services/feedback/interactionCopy';
import { mintUrlKey } from '~/shared/utils/mintUrl';
import { connectMint } from '../connectMint';
import { MintTrustSheet, type MintConnectionTarget } from '../components/MintTrustSheet';

/** Review and confirm a connection from Home or mint discovery. */
export function useQuickMintConnection() {
  const router = useRouter();
  const sheetRef = useRef<AppBottomSheetRef>(null);
  const lock = useRef(false);
  const pendingPreview = useRef<string | null>(null);
  const [mint, setMint] = useState<MintConnectionTarget | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ url: string; message: string } | null>(null);
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
    async (target: MintConnectionTarget) => {
      if (lock.current || pendingPreview.current) return;
      lock.current = true;
      setBusy(true);
      setError(null);
      try {
        await connectMint(target.url);
        setFinished(true);
        toast.showFeedback(interactionCopy.mintConnected);
      } catch (cause) {
        setError({
          url: mintUrlKey(target.url),
          message: cause instanceof Error ? cause.message : 'Could not connect to this mint.',
        });
      } finally {
        lock.current = false;
        setBusy(false);
      }
    },
    [toast],
  );

  const requestConnection = useCallback((target: MintConnectionTarget) => {
    if (lock.current || pendingPreview.current) return;
    if (
      useWalletStore
        .getState()
        .mints.some((item) => item.trusted && mintUrlKey(item.mintUrl) === mintUrlKey(target.url))
    )
      return;
    setMint(target);
    setError(null);
    setFinished(false);
    setPresentation((value) => value + 1);
  }, []);

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
        onPreview={() => {
          if (!mint || lock.current || pendingPreview.current) return;
          pendingPreview.current = mint.url;
          sheetRef.current?.dismiss();
        }}
        onClose={() => {
          const url = pendingPreview.current;
          pendingPreview.current = null;
          if (url) router.push({ pathname: '/(modals)/mint-profile', params: { url } });
        }}
        onConfirm={() => (mint ? confirm(mint) : undefined)}
      />
    ),
  };
}
