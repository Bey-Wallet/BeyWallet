import React, { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Landmark, ScanSearch } from '@tamagui/lucide-icons';
import { Text, XStack, YStack } from 'tamagui';
import { useWalletStore } from '~/state/walletStore';
import {
  acknowledgeRecovery,
  recoveryCandidates,
  updateRecoverySession,
  useRecoverySessionStore,
} from '~/state/recoverySessionStore';
import { seedService } from '~/services/platform/seedService';
import { retryRecoveryDiscovery } from '~/services/wallet/recoveryDiscovery';
import { biometricService } from '~/services/platform/biometricService';
import { useOfflineStatus } from '~/shared/hooks/useOfflineStatus';
import { AppButton } from '~/shared/ui/AppButton';
import { Spinner } from '~/shared/ui/Spinner';
import { useSettingsBusy } from './hooks/useSettingsBusy';
import { useFeedbackOwner } from '~/shared/hooks/useFeedbackOwner';
import {
  SettingsDescription,
  SettingsGroup,
  SettingsMessage,
  SettingsPage,
  SettingsRow,
} from './components/SettingsLayout';

export function RecoverFundsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mintUrl?: string }>();
  const session = useRecoverySessionStore((s) => s.session);
  useFeedbackOwner(session?.feedbackId);
  const mints = useWalletStore((s) => s.mints);
  const isRestoring = useWalletStore((s) => s.isRestoring);
  const entries = useWalletStore((s) => s.mintRestoreStatuses);
  const progress = useWalletStore((s) => s.restoringMintKeysetProgress);
  const current = useWalletStore((s) => s.restoringMintUrl);
  const balances = useWalletStore((s) => s.balances);
  const [busy, setBusy] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [message, setMessage] = useState<string>();
  const locked = useRef(false);
  const offline = useOfflineStatus();
  const client = useQueryClient();
  const running = isRestoring || session?.phase === 'recovering';
  useSettingsBusy(busy || running);

  useEffect(() => {
    let active = true;
    const open = async () => {
      const existing = useRecoverySessionStore.getState().session;
      if (existing?.needsReview) return;
      const mnemonic = await seedService.getMnemonic();
      if (!mnemonic) return;
      const { pubkey } = await seedService.getNostrKeys(mnemonic);
      if (!active) return;
      const wallet = useWalletStore.getState();
      const trusted = wallet.mints.filter((m) => m.trusted);
      const candidates = recoveryCandidates([
        { urls: trusted.map((m) => m.mintUrl), source: 'Connected trusted mint' },
      ]);
      const requested = recoveryCandidates([
        { urls: [params.mintUrl ?? wallet.activeMintUrl ?? ''], source: '' },
      ])[0]?.mintUrl;
      const selected =
        candidates.find((c) => c.mintUrl === requested)?.mintUrl ?? candidates[0]?.mintUrl;
      useRecoverySessionStore.setState({
        session: {
          walletId: pubkey,
          origin: 'manual',
          candidates,
          selected: selected ? [selected] : [],
          phase: 'review',
          results: [],
          needsReview: true,
        },
      });
    };
    void open().catch(() => setMessage('Wallet unavailable. Reopen Recover funds to try again.'));
    return () => {
      active = false;
      const latest = useRecoverySessionStore.getState().session;
      if (latest?.origin === 'manual' && latest.phase !== 'recovering') acknowledgeRecovery();
    };
  }, [params.mintUrl]);

  const name = (url: string) => {
    const mint = mints.find((m) => m.mintUrl.replace(/\/+$/, '') === url);
    return mint?.nickname || mint?.name || url.replace(/^https?:\/\//, '');
  };
  const select = (selected: string[]) => {
    if (!busy && !running) updateRecoverySession({ selected });
  };
  const recover = async (urls = session?.selected ?? []) => {
    if (locked.current || running || offline || !urls.length) return;
    locked.current = true;
    setBusy(true);
    setMessage(undefined);
    try {
      if (!(await biometricService.authenticateAsync('Authorize fund recovery'))) {
        setMessage('Recovery cancelled.');
        return;
      }
      if (useRecoverySessionStore.getState().session !== session)
        throw new Error('Recovery changed. Review your selected mints again.');
      await useWalletStore.getState().recoverSelectedMints(urls);
      await Promise.all(
        ['proofs', 'readyProofs', 'history'].map((key) =>
          client.invalidateQueries({ queryKey: [key] }),
        ),
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Recovery could not finish. Retry when online.',
      );
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };
  const leave = () => {
    if (busy || running) return;
    acknowledgeRecovery();
    router.replace('/(tabs)');
  };
  const review = session?.phase === 'review';
  const incomplete =
    session?.results.filter((r) => r.status !== 'done').map((r) => r.mintUrl) ?? [];
  if (!session) {
    return (
      <SettingsPage>
        {message ? <SettingsMessage error>{message}</SettingsMessage> : <Spinner size={20} />}
      </SettingsPage>
    );
  }
  return (
    <SettingsPage>
      {review && <SettingsDescription>Choose mints to recover funds from.</SettingsDescription>}
      {review && session.discoveryMessage && (
        <SettingsMessage>{session.discoveryMessage}</SettingsMessage>
      )}
      {session.origin === 'import' && review && session.discoveryMessage && (
        <AppButton
          variant="default"
          emphasis="text"
          disabled={busy || discovering || offline}
          onPress={async () => {
            setDiscovering(true);
            try {
              await retryRecoveryDiscovery();
            } finally {
              setDiscovering(false);
            }
          }}
        >
          Check again
        </AppButton>
      )}
      {review && (
        <XStack items="center" justify="space-between">
          <SettingsDescription>{session.selected.length} selected</SettingsDescription>
          {session.candidates.length > 1 && (
            <AppButton
              variant="default"
              emphasis="text"
              disabled={busy || discovering}
              onPress={() =>
                select(
                  session.selected.length === session.candidates.length
                    ? []
                    : session.candidates.map((c) => c.mintUrl),
                )
              }
            >
              {session.selected.length === session.candidates.length
                ? 'Deselect all'
                : 'Select all'}
            </AppButton>
          )}
        </XStack>
      )}
      {review && (
        <SettingsGroup>
          {session?.candidates
            .filter((c) => review || session.selected.includes(c.mintUrl))
            .map((candidate) => (
              <SettingsRow
                key={candidate.mintUrl}
                title={name(candidate.mintUrl)}
                description={`${candidate.mintUrl}\n${candidate.sources.join(' · ')}`}
                icon={Landmark}
                selected={session.selected.includes(candidate.mintUrl)}
                selectionRole="checkbox"
                disabled={!review || busy || discovering}
                onPress={() =>
                  select(
                    session.selected.includes(candidate.mintUrl)
                      ? session.selected.filter((url) => url !== candidate.mintUrl)
                      : [...session.selected, candidate.mintUrl],
                  )
                }
              />
            ))}
        </SettingsGroup>
      )}
      {session?.candidates.length === 0 && (
        <SettingsMessage>Connect a trusted mint to get started.</SettingsMessage>
      )}
      {running && (
        <>
          <Spinner size={20} />
          <SettingsMessage>
            {current ? `Scanning ${name(current)}…` : 'Preparing…'}
            {progress && ` Keyset ${progress.current} of ${progress.total}.`}
            {entries.some((e) => e.mintUrl === current && e.slow) &&
              ' Taking a little longer. Still scanning.'}
          </SettingsMessage>
          {entries.some((e) => e.status === 'pending') && (
            <SettingsDescription>
              {entries
                .filter((e) => e.status === 'pending')
                .map((e) => name(e.mintUrl))
                .join(', ')}{' '}
              queued
            </SettingsDescription>
          )}
        </>
      )}
      {session?.phase === 'interrupted' && (
        <SettingsMessage>Recovery interrupted. Retry to continue.</SettingsMessage>
      )}
      {!review && session.results.length > 0 && (
        <SettingsGroup>
          {session.results.map((result) => (
            <YStack key={result.mintUrl} p="$3" gap="$1" minHeight={48}>
              <XStack items="center" justify="space-between" gap="$3">
                <Text fontSize={14} color="$color" flex={1}>
                  {name(result.mintUrl)}
                </Text>
                <Text
                  fontSize={12}
                  color={
                    result.status === 'error'
                      ? '$red10'
                      : result.status === 'partial'
                        ? '$orange10'
                        : '$gray10'
                  }
                >
                  {result.status === 'done'
                    ? 'Completed'
                    : result.status === 'partial'
                      ? 'Partial'
                      : result.status === 'interrupted'
                        ? 'Interrupted'
                        : 'Failed'}
                </Text>
              </XStack>
              <Text fontSize={12} color="$gray10">
                Current balance: {(balances[result.mintUrl] ?? result.balance).toLocaleString()} sat
              </Text>
            </YStack>
          ))}
        </SettingsGroup>
      )}
      {message && <SettingsMessage error>{message}</SettingsMessage>}
      {offline && !running && (
        <SettingsMessage>Connect to the internet to recover funds.</SettingsMessage>
      )}
      {review && (
        <AppButton
          icon={ScanSearch}
          disabled={offline || !session.selected.length || busy || running || discovering}
          loading={busy}
          onPress={() => void recover()}
        >
          Recover selected mints
        </AppButton>
      )}
      {!running && !review && incomplete.length > 0 && (
        <AppButton disabled={busy || offline} onPress={() => void recover(incomplete)}>
          Retry incomplete mints
        </AppButton>
      )}
      {!running && !review && (
        <AppButton
          variant="default"
          emphasis="text"
          disabled={busy}
          onPress={() => updateRecoverySession({ phase: 'review' })}
        >
          Change selection
        </AppButton>
      )}
      {!running && session?.origin === 'import' && (
        <AppButton
          variant="default"
          emphasis={review ? 'text' : 'secondary'}
          disabled={busy || discovering}
          onPress={leave}
        >
          {review ? 'Skip for now' : 'Go to Wallet'}
        </AppButton>
      )}
    </SettingsPage>
  );
}
