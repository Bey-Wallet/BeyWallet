import React, { useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Landmark, Plus, ScanSearch } from '@tamagui/lucide-icons';
import { useWalletStore } from '~/state/walletStore';
import { biometricService } from '~/services/platform/biometricService';
import { useOfflineStatus } from '~/shared/hooks/useOfflineStatus';
import { AppButton } from '~/shared/ui/AppButton';
import { useSettingsBusy } from './hooks/useSettingsBusy';
import {
  SettingsDescription,
  SettingsGroup,
  SettingsMessage,
  SettingsPage,
  SettingsRow,
} from './components/SettingsLayout';

type ScanResult = { mintUrl: string; label: string; failed: boolean };

export function RecoverFundsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mintUrl?: string }>();
  const mints = useWalletStore((state) => state.mints);
  const activeMint = useWalletStore((state) => state.activeMintUrl);
  const isRestoring = useWalletStore((state) => state.isRestoring);
  const restoringMint = useWalletStore((state) => state.restoringMintUrl);
  const progress = useWalletStore((state) => state.restoringMintKeysetProgress);
  const trusted = mints.filter((mint) => mint.trusted);
  const [selection, setSelection] = useState(params.mintUrl ?? '');
  const selected =
    selection ||
    trusted.find((mint) => mint.mintUrl === activeMint)?.mintUrl ||
    trusted[0]?.mintUrl ||
    '';
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<ScanResult[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const locked = useRef(false);
  const offline = useOfflineStatus();
  const client = useQueryClient();
  useSettingsBusy(busy);
  const chosen = selected === 'all' ? trusted : trusted.filter((mint) => mint.mintUrl === selected);
  const name = (url: string) => {
    const mint = mints.find((item) => item.mintUrl === url);
    return mint?.nickname || mint?.name || url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  };
  const select = (url: string) => {
    setSelection(url);
    setResults([]);
    setMessage(null);
    setFailed(false);
  };
  const recover = async () => {
    const wallet = useWalletStore.getState();
    if (
      locked.current ||
      offline ||
      !chosen.length ||
      wallet.isRestoring ||
      wallet.restoreQueue.length
    )
      return;
    locked.current = true;
    setBusy(true);
    setResults([]);
    setMessage(null);
    setFailed(false);
    try {
      if (!(await biometricService.authenticateAsync('Authorize fund recovery'))) {
        setMessage('Recovery cancelled.');
        return;
      }
      for (const mint of chosen) {
        const current = useWalletStore.getState();
        if (current.isRestoring || current.restoreQueue.length) {
          setMessage(
            'Another recovery is already running. Wait for it to finish before scanning again.',
          );
          return;
        }
        if (!current.mints.some((item) => item.mintUrl === mint.mintUrl && item.trusted)) {
          setResults((items) => [
            ...items,
            {
              mintUrl: mint.mintUrl,
              label: 'Skipped — mint is no longer trusted.',
              failed: true,
            },
          ]);
          continue;
        }
        const before = current.balances[mint.mintUrl] ?? 0;
        const outcome = await current.restoreFromSeed(mint.mintUrl);
        const after = useWalletStore.getState().balances[mint.mintUrl] ?? before;
        const added = Math.max(0, after - before);
        setResults((items) => [
          ...items,
          {
            mintUrl: mint.mintUrl,
            failed: outcome !== 'completed',
            label:
              outcome === 'queued'
                ? 'Already queued in another recovery. Check again when it finishes.'
                : outcome === 'failed'
                  ? 'Scan could not complete. Some funds may have been recovered; reconnect and retry.'
                  : outcome === 'partial'
                    ? 'Some keysets could not be checked. Recovered funds are saved; try again later.'
                    : added > 0
                      ? `Scan finished · balance increased by ${added.toLocaleString()} sats.`
                      : 'Scan finished · no additional balance found.',
          },
        ]);
      }
      await Promise.all([
        client.invalidateQueries({ queryKey: ['proofs'] }),
        client.invalidateQueries({ queryKey: ['readyProofs'] }),
        client.invalidateQueries({ queryKey: ['history'] }),
      ]);
    } catch {
      setFailed(true);
      setMessage(
        'Recovery could not finish. Reconnect and try again. Funds already recovered remain in your wallet.',
      );
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };
  return (
    <SettingsPage>
      <SettingsDescription>
        Check a mint for recoverable ecash using this wallet’s recovery phrase. Your existing wallet
        stays in place. Connect any missing mints before scanning.
      </SettingsDescription>
      {trusted.length > 0 ? (
        <SettingsGroup>
          {trusted.length > 1 && (
            <SettingsRow
              title="All connected trusted mints"
              icon={Landmark}
              selected={selected === 'all'}
              disabled={busy || isRestoring}
              onPress={() => select('all')}
            />
          )}
          {trusted.map((mint) => (
            <SettingsRow
              key={mint.mintUrl}
              title={name(mint.mintUrl)}
              description={mint.mintUrl}
              icon={Landmark}
              selected={selected === mint.mintUrl}
              disabled={busy || isRestoring}
              onPress={() => select(mint.mintUrl)}
            />
          ))}
        </SettingsGroup>
      ) : (
        <SettingsMessage>Connect and trust a mint before recovering funds.</SettingsMessage>
      )}
      {isRestoring && (
        <SettingsMessage>
          {restoringMint ? `Scanning ${name(restoringMint)}…` : 'A recovery is already running…'}
          {progress && ` Checking keyset ${progress.current} of ${progress.total}.`}
        </SettingsMessage>
      )}
      {results.map((result) => (
        <SettingsMessage key={result.mintUrl} error={result.failed}>
          {name(result.mintUrl)}: {result.label}
        </SettingsMessage>
      ))}
      {message && <SettingsMessage error={failed}>{message}</SettingsMessage>}
      {offline && (
        <SettingsMessage>Go online to check your mints for recoverable funds.</SettingsMessage>
      )}
      <AppButton
        icon={ScanSearch}
        loading={busy}
        loadingText="Recovering funds…"
        disabled={offline || !chosen.length || isRestoring}
        onPress={() => void recover()}
      >
        {results.length ? 'Scan again' : 'Recover funds'}
      </AppButton>
      <AppButton
        icon={Plus}
        variant="default"
        emphasis="secondary"
        disabled={busy || isRestoring}
        onPress={() => router.push('/(tabs)/settings/mints')}
      >
        Connect another mint
      </AppButton>
      <SettingsDescription>
        Scanning may take several minutes. Keep the app open. This checks deterministic ecash from
        your current phrase; it does not import another wallet or guarantee recovery of every token.
        A balance increase can also include payments received during the scan.
      </SettingsDescription>
    </SettingsPage>
  );
}
