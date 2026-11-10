import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { ScanSearch } from '@tamagui/lucide-icons';
import { XStack } from 'tamagui';
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
import { useSettingsStore } from '~/state/settingsStore';
import { useAuthStore } from '~/state/authStore';
import { useOfflineStatus } from '~/shared/hooks/useOfflineStatus';
import { AppButton } from '~/shared/ui/AppButton';
import { Spinner } from '~/shared/ui/Spinner';
import { PaymentInfoHeader } from '~/shared/ui/PaymentInfoHeader';
import { AppText } from '~/shared/ui/AppText';
import { RecoveryMintRow, type RecoveryMintStatus } from './components/RecoveryMintRow';
import { useSettingsBusy } from './hooks/useSettingsBusy';
import { useFeedbackOwner } from '~/shared/hooks/useFeedbackOwner';
import { SettingsGroup, SettingsMessage, SettingsPage } from './components/SettingsLayout';

export function RecoverFundsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mintUrl?: string }>();
  const session = useRecoverySessionStore((s) => s.session);
  useFeedbackOwner(session?.feedbackId);
  const mints = useWalletStore((s) => s.mints);
  const isRestoring = useWalletStore((s) => s.isRestoring);
  const entries = useWalletStore((s) => s.mintRestoreStatuses);
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
    if (!busy && !running && !discovering) updateRecoverySession({ selected, phase: 'review' });
  };
  const recover = async (urls = session?.selected ?? []) => {
    if (locked.current || running || offline || !urls.length) return;
    locked.current = true;
    setBusy(true);
    setMessage(undefined);
    try {
      if (
        useSettingsStore.getState().biometricEnabled &&
        !useAuthStore.getState().isAuthenticated
      ) {
        if (!(await biometricService.authenticateAsync('Unlock wallet for recovery'))) {
          setMessage('Recovery cancelled.');
          return;
        }
        useAuthStore.getState().setAuthenticated(true);
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
  const leave = useCallback(() => {
    if (locked.current || busy || running) return;
    acknowledgeRecovery();
    router.dismissTo('/(tabs)');
  }, [busy, running, router]);
  useFocusEffect(
    useCallback(() => {
      const back = BackHandler.addEventListener('hardwareBackPress', () => {
        leave();
        return true;
      });
      return () => back.remove();
    }, [leave]),
  );
  const header = (
    <PaymentInfoHeader
      title="Recover funds"
      infoTopic="recover-funds"
      navigationAction="close"
      onBack={leave}
      disabled={busy || running}
    />
  );
  const review = session?.phase === 'review';
  const incomplete =
    session?.selected.filter(
      (url) => session.results.find((r) => r.mintUrl === url)?.status !== 'done',
    ) ?? [];
  const completed =
    session?.results.filter((r) => session.selected.includes(r.mintUrl) && r.status === 'done')
      .length ?? 0;
  const complete =
    session?.phase === 'results' &&
    !!session.selected.length &&
    completed === session.selected.length;
  const activeEntry = entries.find((entry) => entry.mintUrl === current);
  const finishing =
    running && !!activeEntry && ['done', 'partial', 'error'].includes(activeEntry.status);
  if (!session) {
    return (
      <>
        {header}
        <SettingsPage>
          {message ? <SettingsMessage error>{message}</SettingsMessage> : <Spinner size={20} />}
        </SettingsPage>
      </>
    );
  }
  return (
    <>
      {header}
      <SettingsPage>
        {running ? (
          <XStack items="center" gap="$3" accessibilityLiveRegion="polite">
            <Spinner size={20} accessibilityLabel="Recovery in progress" />
            <AppText variant="body2" tone="secondary" flex={1}>
              {finishing ? 'Finishing recovery…' : 'Recovering funds… Keep Bey open.'}
            </AppText>
          </XStack>
        ) : (
          <AppText
            variant="body2"
            tone={review ? 'secondary' : complete ? 'success' : 'warning'}
            accessibilityLiveRegion="polite"
          >
            {review
              ? 'Select mints to recover from.'
              : complete
                ? 'Recovery complete.'
                : session.phase === 'interrupted'
                  ? 'Recovery interrupted. Retry to continue.'
                  : 'Some mints need another try.'}
          </AppText>
        )}
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
        <XStack items="center" justify="space-between" gap="$3" flexWrap="wrap">
          <AppText variant="label1">Mints · {session.selected.length} selected</AppText>
          {session.candidates.length > 1 && (
            <AppButton
              variant="default"
              emphasis="text"
              disabled={busy || running || discovering}
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
        <SettingsGroup>
          {session.candidates.map((candidate) => {
            const result = !review
              ? session.results.find((r) => r.mintUrl === candidate.mintUrl)
              : undefined;
            const entry = running
              ? entries.find((e) => e.mintUrl === candidate.mintUrl)
              : undefined;
            const status: RecoveryMintStatus =
              entry?.status === 'pending'
                ? 'queued'
                : (entry?.status ?? result?.status ?? (running ? 'queued' : 'ready'));
            return (
              <RecoveryMintRow
                key={candidate.mintUrl}
                name={name(candidate.mintUrl)}
                url={candidate.mintUrl}
                selected={session.selected.includes(candidate.mintUrl)}
                disabled={running || busy || discovering}
                status={status}
                balance={balances[candidate.mintUrl] ?? result?.balance ?? 0}
                onToggle={() =>
                  select(
                    session.selected.includes(candidate.mintUrl)
                      ? session.selected.filter((url) => url !== candidate.mintUrl)
                      : [...session.selected, candidate.mintUrl],
                  )
                }
              />
            );
          })}
        </SettingsGroup>
        {session?.candidates.length === 0 && (
          <SettingsMessage>Connect a trusted mint to get started.</SettingsMessage>
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
        {!running && (!review || session.origin === 'import') && (
          <AppButton
            variant="default"
            emphasis={complete ? 'primary' : review ? 'text' : 'secondary'}
            disabled={busy || discovering}
            onPress={leave}
          >
            {review ? 'Skip for now' : session.origin === 'import' ? 'Go to Wallet' : 'Done'}
          </AppButton>
        )}
      </SettingsPage>
    </>
  );
}
