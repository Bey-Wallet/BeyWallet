import React, { useCallback, useState } from 'react';
import { Text, YStack } from 'tamagui';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Coins, Plus, Server, ShieldCheck, Sparkles } from '@tamagui/lucide-icons';
import { useWalletStore } from '~/state/walletStore';
import { useSettingsStore } from '~/state/settingsStore';
import { proofService } from '~/services/wallet/proofService';
import { consolidationService } from '~/services/wallet/consolidationService';
import { biometricService } from '~/services/platform/biometricService';
import { nostrDiagnosticsService } from '~/services/wallet/nostrDiagnosticsService';
import { RELAYS } from '~/services/wallet/nostrService';
import { useOfflineStatus } from '~/shared/hooks/useOfflineStatus';
import { AppButton } from '~/shared/ui/AppButton';
import ProofsScreen from '~/features/payments/ProofsScreen';
import { useProtectedValue } from './hooks/useProtectedValue';
import { useSettingsOperation } from './hooks/useSettingsOperation';
import {
  SettingsDescription,
  SettingsGroup,
  SettingsMessage,
  SettingsPage,
  SettingsRow,
} from './components/SettingsLayout';

export function MintsSettingsScreen() {
  const router = useRouter();
  const mints = useWalletStore((state) => state.mints);
  return (
    <SettingsPage>
      <SettingsDescription>
        Manage your connected Cashu mints. Each mint holds a separate balance and trust
        relationship.
      </SettingsDescription>
      {mints.length > 0 ? (
        <SettingsGroup>
          {mints.map((mint) => (
            <SettingsRow
              key={mint.mintUrl}
              title={mint.nickname || mint.name || mint.mintUrl}
              icon={Server}
              value={mint.trusted ? 'Trusted' : 'Not trusted'}
              onPress={() =>
                router.push({
                  pathname: '/(modals)/mint-details',
                  params: { mintUrl: mint.mintUrl },
                })
              }
            />
          ))}
        </SettingsGroup>
      ) : (
        <SettingsMessage>No connected mints yet.</SettingsMessage>
      )}
      <SettingsGroup>
        <SettingsRow
          title="Add mint"
          icon={Plus}
          onPress={() => router.push('/(modals)/add-mint')}
        />
        <SettingsRow
          title="Discover mints"
          icon={Server}
          onPress={() => router.push('/(modals)/discover-mints')}
        />
      </SettingsGroup>
    </SettingsPage>
  );
}

export function FallbackMintSettingsScreen() {
  const mints = useWalletStore((state) => state.mints);
  const selected = useSettingsStore((state) => state.defaultMintUrl);
  const setSelected = useSettingsStore((state) => state.setDefaultMintUrl);
  return (
    <SettingsPage>
      <SettingsDescription>
        Choose the fallback mint used by the wallet. Selecting a fallback does not change a mint’s
        trust status.
      </SettingsDescription>
      {mints.length > 0 ? (
        <SettingsGroup>
          {mints.map((mint) => (
            <SettingsRow
              key={mint.mintUrl}
              title={mint.nickname || mint.name || mint.mintUrl}
              description={mint.mintUrl}
              selected={selected === mint.mintUrl}
              onPress={() => void setSelected(mint.mintUrl)}
            />
          ))}
        </SettingsGroup>
      ) : (
        <SettingsMessage>Connect a mint before choosing a fallback.</SettingsMessage>
      )}
    </SettingsPage>
  );
}

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
          selected={value === mint.mintUrl}
          disabled={disabled}
          onPress={() => onSelect(mint.mintUrl)}
        />
      ))}
    </SettingsGroup>
  );
}

export function OptimizeSettingsScreen() {
  const activeMint = useWalletStore((state) => state.activeMintUrl);
  const [mintUrl, setMintUrl] = useState(activeMint || '');
  const offline = useOfflineStatus();
  const task = useSettingsOperation();
  const queryClient = useQueryClient();
  const proofs = useQuery({
    queryKey: ['readyProofs', mintUrl],
    queryFn: () => proofService.getReadyProofs(mintUrl),
    enabled: !!mintUrl,
  });
  const analysis = useQuery({
    queryKey: ['fragmentationAnalysis', mintUrl],
    queryFn: () => consolidationService.getFragmentationAnalysis(mintUrl),
    enabled: !!mintUrl,
  });
  const count = proofs.data?.length ?? 0;
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
      {analysis.data && (
        <SettingsMessage>{`${count} ready proofs · fragmentation score ${analysis.data.score} · estimated ${analysis.data.estimatedAfterCount} proofs after optimization`}</SettingsMessage>
      )}
      {proofs.isError || analysis.isError ? (
        <SettingsMessage error>Could not load the wallet analysis.</SettingsMessage>
      ) : null}
      {!!mintUrl && !proofs.isPending && count <= 3 && (
        <SettingsMessage>This mint already has a small number of ready proofs.</SettingsMessage>
      )}
      {offline && <SettingsMessage>Go online to optimize your wallet.</SettingsMessage>}
      <AppButton
        icon={Sparkles}
        loading={task.busy}
        loadingText="Optimizing wallet…"
        disabled={offline || !mintUrl || proofs.isPending || proofs.isError || count <= 3}
        onPress={() =>
          void task.run(async () => {
            if (!(await biometricService.authenticateAsync('Authorize wallet optimization')))
              return 'Optimization cancelled.';
            const result = await consolidationService.consolidateMint(mintUrl);
            await useWalletStore.getState().refreshBalance();
            await queryClient.invalidateQueries({ queryKey: ['readyProofs'] });
            await queryClient.invalidateQueries({ queryKey: ['fragmentationAnalysis'] });
            return `Proofs reduced from ${result.before.count} to ${result.after.count}. Balance: ${result.after.totalAmount} sats.`;
          })
        }
      >
        Optimize wallet
      </AppButton>
      {task.message && <SettingsMessage error={task.error}>{task.message}</SettingsMessage>}
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
        icon={ShieldCheck}
        loading={task.busy}
        loadingText="Verifying proofs…"
        disabled={!mintUrl}
        onPress={() =>
          void task.run(async () => {
            const results = await proofService.verifyDleqProofs(mintUrl);
            if (!results.length)
              return 'No DLEQ data is available for these proofs. This is normal for older proofs or mints that do not provide it.';
            const validCount = results.filter((result) => result.valid).length;
            return validCount === results.length
              ? `All ${validCount} proofs verified successfully.`
              : `${validCount}/${results.length} proofs verified. Verification failed for some proofs. Contact the mint operator before taking further action.`;
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

export function RelaysSettingsScreen() {
  const diagnostics = useQuery({
    queryKey: ['settings', 'relay-health'],
    queryFn: () => nostrDiagnosticsService.getDiagnostics(),
  });
  return (
    <SettingsPage>
      <SettingsDescription>
        These relays connect Bey Wallet to Nostr. This screen shows connection health; relay
        configuration is managed by the app.
      </SettingsDescription>
      <SettingsGroup>
        {RELAYS.map((url) => {
          const reachable = diagnostics.data?.relays.find((relay) => relay.url === url)?.reachable;
          return (
            <YStack key={url} p="$4" gap="$2">
              <Text color="$color">{url}</Text>
              <Text color="$gray10">
                {reachable === true
                  ? 'Reachable'
                  : reachable === false
                    ? 'Unavailable'
                    : diagnostics.isPending
                      ? 'Checking…'
                      : 'Unknown'}
              </Text>
            </YStack>
          );
        })}
      </SettingsGroup>
      {diagnostics.isError && (
        <SettingsMessage error>Could not check relay health.</SettingsMessage>
      )}
      <AppButton
        variant="default"
        emphasis="secondary"
        loading={diagnostics.isFetching}
        onPress={() => void diagnostics.refetch()}
      >
        Refresh status
      </AppButton>
    </SettingsPage>
  );
}

export function ProofManagerSettingsScreen() {
  const access = useProtectedValue(
    'Authenticate to view wallet proofs',
    useCallback(async () => true, []),
  );
  if (access.value) return <ProofsScreen settingsMode />;
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
