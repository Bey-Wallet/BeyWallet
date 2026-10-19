import React, { useEffect, useRef, useState } from 'react';
import { Text, YStack } from 'tamagui';
import { AppButton } from '~/shared/ui/AppButton';
import { ListTable, ListTableRow } from '~/shared/ui/ListTable';
import { useOfflineStatus } from '~/shared/hooks/useOfflineStatus';
import { useWalletStore } from '~/state/walletStore';
import {
  getChangePreparation,
  ChangePreparationError,
  type ChangeReview,
} from '~/services/wallet/changePreparationService';
import { useQueryClient } from '@tanstack/react-query';
import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { SettingsPage, SettingsGroup, SettingsRow } from './components/SettingsLayout';
import { useSettingsBusy } from './hooks/useSettingsBusy';

export function GetChangeSettingsScreen() {
  const { activeMintUrl, mints, refreshBalance } = useWalletStore();
  const queryClient = useQueryClient();
  const offline = useOfflineStatus();
  const open = useIsFocused();
  const router = useRouter();
  const [mintUrl, setMintUrl] = useState(
    () => mints.find((mint) => mint.mintUrl === activeMintUrl && mint.trusted)?.mintUrl ?? '',
  );
  const [review, setReview] = useState<ChangeReview | null>(null);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  useSettingsBusy(executing);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ amount: number; coinCount: number } | null>(null);
  const reviewRef = useRef<ChangeReview | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const locked = useRef(false);
  const completedMint = useRef<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (locked.current) return;
    if (open && completedMint.current === mintUrl) return;
    let canceled = false;
    setReview(null);
    setResult(null);
    setError(null);
    setLoading(open && !!mintUrl && !offline);
    queue.current = queue.current
      .then(async () => {
        const previous = reviewRef.current;
        await previous?.dispose();
        if (reviewRef.current === previous) reviewRef.current = null;
        if (canceled || !open || !mintUrl || offline) return;
        const prepared = await getChangePreparation().prepare(mintUrl);
        if (canceled) {
          await prepared.dispose();
          return;
        }
        reviewRef.current = prepared;
        setReview(prepared);
      })
      .catch((failure) => {
        if (!canceled)
          setError(
            failure instanceof ChangePreparationError
              ? failure.message
              : 'Could not prepare change. Check your connection and try again.',
          );
      })
      .finally(() => {
        if (!canceled) setLoading(false);
      });
    return () => {
      canceled = true;
      // Review changes and closure are serialized with preparation, including unmount.
      queue.current = queue.current
        .then(async () => {
          if (locked.current) return;
          const previous = reviewRef.current;
          await previous?.dispose();
          if (reviewRef.current === previous) reviewRef.current = null;
        })
        .catch(() => {});
    };
  }, [open, mintUrl, offline, retry]);

  const dismiss = () => {
    if (!locked.current) router.back();
  };
  const execute = async () => {
    if (locked.current || !review || offline) return;
    locked.current = true;
    setExecuting(true);
    setError(null);
    try {
      const completed = await review.execute();
      completedMint.current = review.mintUrl;
      setResult(completed);
      await refreshBalance();
      void queryClient.invalidateQueries({ queryKey: ['history'] });
    } catch (failure) {
      if (failure instanceof ChangePreparationError && failure.needsReview) {
        reviewRef.current = null;
        setReview(null);
      }
      setError(
        failure instanceof ChangePreparationError
          ? failure.message
          : 'Could not get change. Reconnect and retry.',
      );
    } finally {
      locked.current = false;
      setExecuting(false);
    }
  };

  return (
    <SettingsPage>
      <YStack gap="$4">
        <Text fontFamily="$body" fontSize="$3" color="$gray10">
          Prepare smaller coins for offline payments. Mint fees may apply.
        </Text>
        <SettingsGroup>
          {mints
            .filter((mint) => mint.trusted)
            .map((mint) => (
              <SettingsRow
                key={mint.mintUrl}
                title={mint.nickname || mint.name || mint.mintUrl}
                selected={mintUrl === mint.mintUrl}
                disabled={executing}
                onPress={() => {
                  completedMint.current = null;
                  setMintUrl(mint.mintUrl);
                }}
              />
            ))}
        </SettingsGroup>
        <ListTable compact bg="$buttonDefaultSecondary">
          {review && (
            <>
              <ListTableRow label="Available balance" value={`${review.inputAmount} sats`} />
              <ListTableRow label="Mint fee" value={`${review.fee} sats`} />
              <ListTableRow label="After preparation" value={`${review.outputAmount} sats`} />
            </>
          )}
        </ListTable>
        {offline && (
          <Text fontFamily="$body" fontSize="$3" color="$gray10">
            Go online to get change.
          </Text>
        )}
        {!mintUrl && (
          <Text fontFamily="$body" fontSize="$3" color="$gray10">
            Select a trusted mint to continue.
          </Text>
        )}
        {error && (
          <Text fontFamily="$body" fontSize="$3" color="$red10" accessibilityRole="alert">
            {error}
          </Text>
        )}
        {result && (
          <Text
            fontFamily="$body"
            fontSize="$3"
          >{`${result.amount} sats prepared as ${result.coinCount} coins. Ready for offline payments.`}</Text>
        )}
        {!result && (
          <AppButton
            fullWidth
            loading={loading || executing}
            loadingText={executing ? 'Getting change' : 'Preparing review'}
            disabled={offline || !mintUrl || loading || executing || (!review && !error)}
            onPress={() => {
              if (review) void execute();
              else setRetry((value) => value + 1);
            }}
          >
            {error || review?.submitted ? 'Retry' : 'Get change'}
          </AppButton>
        )}
        <AppButton
          fullWidth
          variant="default"
          emphasis="secondary"
          disabled={executing}
          onPress={dismiss}
        >
          {result ? 'Done' : 'Cancel'}
        </AppButton>
      </YStack>
    </SettingsPage>
  );
}
