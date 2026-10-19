import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Share } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Coins, Landmark, RefreshCw, Share2, Trash2 } from '@tamagui/lucide-icons';
import { Text, XStack } from 'tamagui';
import { proofService, type CoreProof } from '~/services/wallet';
import { useWalletStore } from '~/state/walletStore';
import { AppButton } from '~/shared/ui/AppButton';
import {
  SettingsDescription,
  SettingsGroup,
  SettingsMessage,
  SettingsPage,
  SettingsRow,
} from './components/SettingsLayout';
import { useSettingsOperation } from './hooks/useSettingsOperation';

type ProofState = 'unspent' | 'inflight' | 'spent';
const labels: Record<ProofState, string> = {
  unspent: 'Unspent',
  inflight: 'In-flight',
  spent: 'Spent',
};

export default function ProofManagerScreen() {
  const [state, setState] = useState<ProofState>('unspent');
  const [mint, setMint] = useState('all');
  const mints = useWalletStore((value) => value.mints);
  const client = useQueryClient();
  const task = useSettingsOperation();
  const ready = useQuery({
    queryKey: ['proofs', 'unspent'],
    queryFn: () => proofService.getAllReadyProofs(),
  });
  const pending = useQuery({
    queryKey: ['proofs', 'inflight'],
    queryFn: () => proofService.getAllProofsByState('inflight'),
  });
  const spent = useQuery({
    queryKey: ['proofs', 'spent'],
    queryFn: () => proofService.getAllProofsByState('spent'),
  });
  const groups = {
    unspent: ready.data ?? [],
    inflight: pending.data ?? [],
    spent: spent.data ?? [],
  };
  const queries = [ready, pending, spent];
  const loading = queries.some((query) => query.isFetching);
  const failed = queries.some((query) => query.isError);
  useFocusEffect(
    useCallback(() => {
      void client.invalidateQueries({ queryKey: ['proofs'] });
    }, [client]),
  );
  const allMints = useMemo(
    () => [
      ...new Set([
        ...mints.map((value) => value.mintUrl),
        ...(ready.data ?? []).map((value) => value.mintUrl),
        ...(pending.data ?? []).map((value) => value.mintUrl),
        ...(spent.data ?? []).map((value) => value.mintUrl),
      ]),
    ],
    [mints, ready.data, pending.data, spent.data],
  );
  const rows = groups[state].filter(
    (proof) => mint === 'all' || proof.mintUrl.replace(/\/$/, '') === mint.replace(/\/$/, ''),
  );
  const name = (url: string) =>
    mints.find((value) => value.mintUrl === url)?.nickname ||
    mints.find((value) => value.mintUrl === url)?.name ||
    url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const refresh = async () => {
    await Promise.all(queries.map((query) => query.refetch()));
  };
  const exportProofs = () =>
    void task.run(async () => {
      const byMint = new Map<string, CoreProof[]>();
      for (const proof of rows)
        byMint.set(proof.mintUrl, [...(byMint.get(proof.mintUrl) ?? []), proof]);
      const tokens = [...byMint].map(([url, proofs]) =>
        proofService.encodeProofsAsToken(url, proofs, 'sat'),
      );
      await Share.share({ message: tokens.join('\n\n') });
      return 'Share dialog closed.';
    });
  const eraseSpent = () => {
    if (state !== 'spent') return;
    const records = rows.filter((proof) => proof.state === 'spent');
    if (!records.length) return;
    Alert.alert(
      'Erase shown spent proofs?',
      'This removes spent proof records from this device. It cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Erase',
          style: 'destructive',
          onPress: () =>
            void task.run(async () => {
              const byMint = new Map<string, string[]>();
              for (const proof of records)
                byMint.set(proof.mintUrl, [...(byMint.get(proof.mintUrl) ?? []), proof.secret]);
              await Promise.all(
                [...byMint].map(([url, secrets]) => proofService.deleteProofs(url, secrets)),
              );
              await refresh();
              return 'Spent proof records erased.';
            }),
        },
      ],
    );
  };
  return (
    <SettingsPage>
      <SettingsDescription>
        View your proofs by mint and state. Unspent proofs represent your spendable ecash; in-flight
        proofs belong to pending payments.
      </SettingsDescription>
      <SettingsGroup>
        <SettingsRow
          title="All mints"
          icon={Landmark}
          selected={mint === 'all'}
          disabled={task.busy}
          onPress={() => {
            task.clear();
            setMint('all');
          }}
        />
        {allMints.map((url) => (
          <SettingsRow
            key={url}
            title={name(url)}
            icon={Landmark}
            selected={mint === url}
            disabled={task.busy}
            onPress={() => {
              task.clear();
              setMint(url);
            }}
          />
        ))}
      </SettingsGroup>
      <SettingsGroup>
        {(['unspent', 'inflight', 'spent'] as const).map((value) => (
          <SettingsRow
            key={value}
            title={labels[value]}
            value={String(groups[value].length)}
            selected={state === value}
            disabled={task.busy}
            onPress={() => {
              task.clear();
              setState(value);
            }}
          />
        ))}
      </SettingsGroup>
      {failed && (
        <SettingsMessage error>Could not load proofs. Please refresh to try again.</SettingsMessage>
      )}
      {!failed && !loading && (
        <SettingsDescription>
          {rows.length} proofs ·{' '}
          {rows.reduce((sum, proof) => sum + proof.amount, 0).toLocaleString()} sats
        </SettingsDescription>
      )}
      {rows.length > 0 && (
        <SettingsGroup>
          {rows.map((proof, index) => (
            <XStack
              key={proof.mintUrl + proof.secret}
              px="$4"
              py="$3"
              minHeight={56}
              gap="$3"
              items="center"
            >
              <Coins size={20} color="$color" />
              <Text flex={1} fontSize="$5" color="$color">
                {proof.amount.toLocaleString()} sats
              </Text>
              <Text fontSize="$3" color="$gray10" maxWidth="45%" numberOfLines={1}>
                {name(proof.mintUrl)} · {index + 1}
              </Text>
            </XStack>
          ))}
        </SettingsGroup>
      )}
      {!failed && !loading && rows.length === 0 && (
        <SettingsDescription>
          No {labels[state].toLowerCase()} proofs for this selection.
        </SettingsDescription>
      )}
      <AppButton icon={RefreshCw} loading={loading} disabled={task.busy} onPress={refresh}>
        Refresh proofs
      </AppButton>
      {state === 'unspent' && rows.length > 0 && (
        <>
          <SettingsDescription>
            Exported tokens can be spent by anyone who receives them. Share only with someone you
            trust.
          </SettingsDescription>
          <AppButton
            icon={Share2}
            variant="default"
            emphasis="secondary"
            disabled={task.busy || loading}
            onPress={exportProofs}
          >
            Export shown proofs
          </AppButton>
        </>
      )}
      {state === 'spent' && rows.length > 0 && (
        <AppButton
          icon={Trash2}
          variant="critical"
          emphasis="secondary"
          disabled={loading}
          loading={task.busy}
          onPress={eraseSpent}
        >
          Erase shown spent proofs
        </AppButton>
      )}
      {task.message && <SettingsMessage error={task.error}>{task.message}</SettingsMessage>}
    </SettingsPage>
  );
}
