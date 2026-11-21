import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Share, useWindowDimensions } from 'react-native';
import { LegendList } from '@legendapp/list/react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Coins, Landmark, RefreshCw, Share2, Trash2 } from '@tamagui/lucide-icons';
import { Text, XStack, YStack } from 'tamagui';
import { proofService, type CoreProof } from '~/services/wallet';
import { useWalletStore } from '~/state/walletStore';
import { AppButton } from '~/shared/ui/AppButton';
import {
  SettingsDescription,
  SettingsGroup,
  SettingsMessage,
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
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<ProofState>('unspent');
  const [mint, setMint] = useState('all');
  const mints = useWalletStore((value) => value.mints);
  const client = useQueryClient();
  const task = useSettingsOperation();
  const ready = useQuery({
    queryKey: ['proofs', 'unspent'],
    queryFn: () => proofService.getAllReadyProofs(),
    enabled: state === 'unspent',
    staleTime: 30_000,
  });
  const pending = useQuery({
    queryKey: ['proofs', 'inflight'],
    queryFn: () => proofService.getAllProofsByState('inflight'),
    enabled: state === 'inflight',
    staleTime: 30_000,
  });
  const spent = useQuery({
    queryKey: ['proofs', 'spent'],
    queryFn: () => proofService.getAllProofsByState('spent'),
    enabled: state === 'spent',
    staleTime: 30_000,
  });
  const groups = {
    unspent: ready.data ?? [],
    inflight: pending.data ?? [],
    spent: spent.data ?? [],
  };
  const selectedQuery = { unspent: ready, inflight: pending, spent }[state];
  const loading = selectedQuery.isFetching;
  const failed = selectedQuery.isError;
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
  const selectedProofs = selectedQuery.data;
  const rows = useMemo(
    () =>
      (selectedProofs ?? []).filter(
        (proof) => mint === 'all' || proof.mintUrl.replace(/\/$/, '') === mint.replace(/\/$/, ''),
      ),
    [selectedProofs, mint],
  );
  const mintNames = useMemo(
    () => new Map(mints.map((value) => [value.mintUrl, value.nickname || value.name])),
    [mints],
  );
  const name = useCallback(
    (url: string) => mintNames.get(url) || url.replace(/^https?:\/\//, '').replace(/\/$/, ''),
    [mintNames],
  );
  const refresh = async () => {
    await selectedQuery.refetch();
  };
  const renderProof = useCallback(
    ({ item: proof, index }: { item: CoreProof; index: number }) => (
      <YStack
        bg="$gray2"
        overflow="hidden"
        borderTopLeftRadius={index === 0 ? '$6' : 0}
        borderTopRightRadius={index === 0 ? '$6' : 0}
        borderBottomLeftRadius={index === rows.length - 1 ? '$6' : 0}
        borderBottomRightRadius={index === rows.length - 1 ? '$6' : 0}
      >
        {index > 0 && <YStack height={2} width="100%" bg="$background" />}
        <XStack px="$4" py="$3" minHeight={56} gap="$3" items="center">
          <Coins size={20} color="$color" />
          <Text flex={1} fontSize="$5" color="$color">
            {proof.amount.toLocaleString()} sat
          </Text>
          <Text fontSize="$3" color="$gray10" maxWidth="45%" numberOfLines={1}>
            {name(proof.mintUrl)} · {index + 1}
          </Text>
        </XStack>
      </YStack>
    ),
    [name, rows.length],
  );
  const exportProofs = () =>
    void task.run(async () => {
      const byMint = new Map<string, CoreProof[]>();
      for (const proof of rows)
        byMint.set(proof.mintUrl, [...(byMint.get(proof.mintUrl) ?? []), proof]);
      const tokens = [...byMint].map(([url, proofs]) =>
        proofService.encodeProofsAsToken(url, proofs, 'sat'),
      );
      await Share.share({ message: tokens.join('\n\n') });
      return '';
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
    <YStack flex={1} bg="$background">
      <LegendList
        data={rows}
        dataKey={`${state}:${mint}`}
        keyExtractor={(_proof, index) => String(index)}
        renderItem={renderProof}
        recycleItems
        estimatedItemSize={58}
        drawDistance={Math.min(1200, Math.max(600, windowHeight))}
        contentContainerStyle={{ padding: 16, paddingBottom: Math.max(insets.bottom, 16) + 16 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <YStack gap="$5" pb="$5">
            <SettingsDescription>
              View your proofs by mint and state. Unspent proofs represent your spendable ecash;
              in-flight proofs belong to pending payments.
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
                  value={
                    { unspent: ready, inflight: pending, spent }[value].data
                      ? String(groups[value].length)
                      : '—'
                  }
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
              <SettingsMessage error>
                Could not load proofs. Please refresh to try again.
              </SettingsMessage>
            )}
            {!failed && !loading && (
              <SettingsDescription>
                {rows.length} proofs ·{' '}
                {rows.reduce((sum, proof) => sum + proof.amount, 0).toLocaleString()} sat
              </SettingsDescription>
            )}
          </YStack>
        }
        ListEmptyComponent={
          !failed && !loading ? (
            <SettingsDescription>
              No {labels[state].toLowerCase()} proofs for this selection.
            </SettingsDescription>
          ) : null
        }
        ListFooterComponent={
          <YStack gap="$5" pt="$5">
            <AppButton icon={RefreshCw} loading={loading} disabled={task.busy} onPress={refresh}>
              Refresh proofs
            </AppButton>
            {state === 'unspent' && rows.length > 0 && (
              <>
                <SettingsDescription>
                  Exported tokens can be spent by anyone who receives them. Share only with someone
                  you trust.
                </SettingsDescription>
                <AppButton
                  haptic
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
                haptic
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
          </YStack>
        }
      />
    </YStack>
  );
}
