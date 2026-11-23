import React, { useCallback, useState } from 'react';

import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Coins, Landmark, ShieldCheck, Sparkles } from '~/shared/icons';
import { useWalletStore } from '~/state/walletStore';
import { proofService } from '~/services/wallet/proofService';
import { consolidationService } from '~/services/wallet/consolidationService';
import { biometricService } from '~/services/platform/biometricService';

import { useOfflineStatus } from '~/shared/hooks/useOfflineStatus';
import { AppButton } from '~/shared/ui/AppButton';
import { Spinner } from '~/shared/ui/Spinner';
import ProofManagerScreen from './ProofManagerScreen';
import { useProtectedValue } from './hooks/useProtectedValue';
import { useSettingsOperation } from './hooks/useSettingsOperation';
import {
  SettingsDescription,
  SettingsGroup,
  SettingsMessage,
  SettingsPage,
  SettingsRow,
} from './components/SettingsLayout';

/** Shared selection UI stays on the operation page instead of opening a sheet. */
function OperationMintList({
  value,
  onSelect,
  disabled,
}: {
  value: string;
  onSelect: (url: string) => void;
  disabled: boolean;
}) {
  const mints = useWalletStore((state) => state.mints);
  return mints.length === 0 ? (
    <SettingsMessage>No connected mints.</SettingsMessage>
  ) : (
    <SettingsGroup>
      {mints.map((mint) => (
        <SettingsRow
          key={mint.mintUrl}
          title={mint.nickname || mint.name || mint.mintUrl}
          icon={Landmark}
          selected={value === mint.mintUrl}
          disabled={disabled}
          onPress={() => onSelect(mint.mintUrl)}
        />
      ))}
    </SettingsGroup>
  );
}

export function OptimizeSettingsScreen() {
  const router = useRouter();
  const activeMint = useWalletStore((state) => state.activeMintUrl);
  const [mintUrl, setMintUrl] = useState(activeMint || '');
  const offline = useOfflineStatus();
  const task = useSettingsOperation();
  const queryClient = useQueryClient();
  const proofs = useQuery({
    queryKey: ['readyProofs', mintUrl],
    networkMode: 'always',
    queryFn: () => proofService.getReadyProofs(mintUrl),
    enabled: !!mintUrl,
  });
  const analysis = useQuery({
    queryKey: ['fragmentationAnalysis', mintUrl],
    networkMode: 'always',
    queryFn: () => consolidationService.getFragmentationAnalysis(mintUrl),
    enabled: !!mintUrl,
  });
  const count = proofs.data?.length ?? 0;
  const loading = !!mintUrl && (proofs.isPending || analysis.isPending);
  const failed = proofs.isError || analysis.isError;
  return (
    <SettingsPage>
      <SettingsDescription>
        Consolidate small ecash proofs into fewer, larger denominations. Review the selected mint
        before continuing. Authentication is required.
      </SettingsDescription>
      <OperationMintList
        value={mintUrl}
        onSelect={(url) => {
          task.clear();
          setMintUrl(url);
        }}
        disabled={task.busy}
      />
      {loading && <Spinner size={20} accessibilityLabel="Loading wallet analysis" />}
      {!loading && !failed && analysis.data && (
        <SettingsMessage>{`${count} ready proofs · fragmentation score ${analysis.data.score} · estimated ${analysis.data.estimatedAfterCount} proofs after optimization`}</SettingsMessage>
      )}
      {failed && (
        <>
          <SettingsMessage error>Could not load the wallet analysis.</SettingsMessage>
          <AppButton
            emphasis="secondary"
            size="small"
            loading={proofs.isFetching || analysis.isFetching}
            onPress={() => void Promise.all([proofs.refetch(), analysis.refetch()])}
          >
            Try again
          </AppButton>
        </>
      )}
      {!!mintUrl && !loading && !failed && count <= 3 && (
        <SettingsMessage>This mint already has a small number of ready proofs.</SettingsMessage>
      )}
      {offline && <SettingsMessage>Go online to optimize your wallet.</SettingsMessage>}
      <AppButton
        haptic
        icon={Sparkles}
        loading={task.busy}
        loadingText="Optimizing wallet…"
        disabled={offline || !mintUrl || loading || failed || count <= 3}
        onPress={() =>
          void task.run(async () => {
            if (!(await biometricService.authenticateAsync('Authorize wallet optimization')))
              return 'Optimization cancelled.';
            const result = await consolidationService.consolidateMint(mintUrl);
            await useWalletStore.getState().refreshBalance();
            await queryClient.invalidateQueries({ queryKey: ['readyProofs'] });
            await queryClient.invalidateQueries({ queryKey: ['fragmentationAnalysis'] });
            return `Proofs reduced from ${result.before.count} to ${result.after.count}. Balance: ${result.after.totalAmount} sat.`;
          }, 'Optimization needs review. Check History before trying again.')
        }
      >
        Optimize wallet
      </AppButton>
      {task.message && <SettingsMessage error={task.error}>{task.message}</SettingsMessage>}
      {task.error && (
        <AppButton emphasis="text" onPress={() => router.push('/(tabs)/history')}>
          View History
        </AppButton>
      )}
    </SettingsPage>
  );
}

export function VerifyProofsSettingsScreen() {
  const activeMint = useWalletStore((state) => state.activeMintUrl);
  const [mintUrl, setMintUrl] = useState(activeMint || '');
  const task = useSettingsOperation();
  return (
    <SettingsPage>
      <SettingsDescription>
        Verify stored DLEQ mint signatures without a network connection. Older proofs and some mints
        do not include DLEQ data; this check does not establish whether a proof is unspent.
      </SettingsDescription>
      <OperationMintList
        value={mintUrl}
        onSelect={(url) => {
          task.clear();
          setMintUrl(url);
        }}
        disabled={task.busy}
      />
      <AppButton
        haptic
        icon={ShieldCheck}
        loading={task.busy}
        loadingText="Verifying proofs…"
        disabled={!mintUrl}
        onPress={() =>
          void task.run(async () => {
            const results = await proofService.verifyDleqProofs(mintUrl);
            if (!results.length)
              return 'No DLEQ data is available for these proofs. This is normal for older proofs or mints that do not provide it.';
            const verified = results.filter((result) => result.status === 'verified').length;
            const invalid = results.filter((result) => result.status === 'invalid').length;
            const unverifiable = results.filter(
              (result) => result.status === 'unverifiable',
            ).length;
            return `${results.length} proofs with DLEQ: ${verified} verified, ${invalid} invalid, ${unverifiable} unverifiable.${
              invalid ? ' Verification failed for invalid proofs.' : ''
            }${
              unverifiable
                ? ' Unverifiable proofs need complete DLEQ data and usable cached keys.'
                : ''
            }`;
          })
        }
      >
        Verify proofs offline
      </AppButton>
      {task.message && (
        <SettingsMessage error={task.error || task.message.includes('Verification failed')}>
          {task.message}
        </SettingsMessage>
      )}
    </SettingsPage>
  );
}

export function ProofManagerSettingsScreen() {
  const access = useProtectedValue(
    'Authenticate to view wallet proofs',
    useCallback(async () => true, []),
  );
  if (access.value) return <ProofManagerScreen />;
  return (
    <SettingsPage>
      <SettingsDescription>
        Proofs contain spendable ecash. Authenticate to inspect or manage them.
      </SettingsDescription>
      <AppButton icon={Coins} loading={access.busy} onPress={access.reveal}>
        Open proof manager
      </AppButton>
      {access.error && <SettingsMessage error>{access.error}</SettingsMessage>}
    </SettingsPage>
  );
}
