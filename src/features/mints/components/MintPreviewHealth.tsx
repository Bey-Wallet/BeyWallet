import React from 'react';
import { Linking } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Text, View, XStack, YStack } from 'tamagui';
import { ExternalLink, RefreshCw } from '@tamagui/lucide-icons';
import { ListTable, ListTableRow } from '~/shared/ui/ListTable';
import { AppButton } from '~/shared/ui/AppButton';
import { AppIconButton } from '~/shared/ui/AppIconButton';
import countryNames from '~/shared/utils/countryNames.json';
import {
  mintHealthService,
  mintHealthUrl,
  type CashuUptimeDay,
  type PaymentTestStats,
} from '~/services/api/mintHealthService';

const tableProps = {
  compact: true,
};
const time = (value: string | number | null | undefined) =>
  value ? new Date(value).toLocaleString() : 'Not checked';
const percent = (value: number | null | undefined) =>
  value == null ? 'Unavailable' : `${Number(value.toFixed(1))}%`;
export const paymentTestRate = (stats: PaymentTestStats | null | undefined) =>
  !stats || stats.total === 0
    ? 'No recent tests'
    : `${percent((stats.success / stats.total) * 100)} (${stats.success}/${stats.total})`;

function UptimeHistory({ daily = [] }: { daily?: CashuUptimeDay[] }) {
  const byDay = new Map(daily.map((day) => [day.day, day]));
  const end = Date.parse(`${daily.at(-1)?.day ?? new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  const days = Array.from({ length: 30 }, (_, index) => {
    const day = new Date(end - (29 - index) * 86_400_000).toISOString().slice(0, 10);
    const sample = byDay.get(day);
    return { day, uptime: sample?.checks ? sample.uptime : null };
  });
  const monitored = days.filter(({ uptime }) => uptime != null);
  const history = monitored.length
    ? days.filter(
        ({ day }) => day >= monitored[0].day && day <= monitored[monitored.length - 1].day,
      )
    : [];
  if (!history.length) {
    return (
      <YStack px="$page" py="$rowGap" gap="$2">
        <Text color="$gray10" fontSize="$3">
          Uptime history
        </Text>
        <Text color="$gray10" fontSize={12}>
          No uptime history available
        </Text>
      </YStack>
    );
  }
  return (
    <YStack px="$page" py="$rowGap" gap="$2">
      <Text color="$gray10" fontSize="$3">
        Uptime history · {history.length} {history.length === 1 ? 'day' : 'days'}
      </Text>
      <XStack gap={3}>
        {history.map(({ day, uptime }) => (
          <View
            key={day}
            flex={1}
            height={30}
            rounded={3}
            bg={uptime == null ? '$gray5' : uptime < 100 ? '$red9' : '$green11'}
            accessible
            accessibilityRole="image"
            accessibilityLabel={`${day}: ${uptime == null ? 'No data' : `${percent(uptime)} uptime`}`}
          />
        ))}
      </XStack>
      <XStack justify="space-between">
        <Text color="$gray10" fontSize={12}>
          {history[0].day}
        </Text>
        <Text color="$gray10" fontSize={12}>
          {history[history.length - 1].day}
        </Text>
      </XStack>
    </YStack>
  );
}

function useRadarHealth(url: string) {
  const cache = React.useMemo(() => mintHealthService.cachedRadar(url), [url]);
  return useQuery({
    queryKey: ['mint-health', 'radar', url],
    queryFn: ({ signal }) => mintHealthService.radar(url, signal),
    initialData: cache?.data,
    initialDataUpdatedAt: cache?.savedAt,
    staleTime: 300_000,
    retry: false,
  });
}

export function MintReliabilityRow({
  url,
  connection,
  onRecheck,
}: {
  url: string;
  connection: 'online' | 'offline' | 'checking';
  onRecheck: () => void;
}) {
  const radar = useRadarHealth(url);
  const score = radar.data?.score;
  const value =
    score == null
      ? radar.isFetching
        ? 'Checking…'
        : radar.data === null
          ? 'Not rated'
          : 'Unavailable'
      : `${score}%`;
  return (
    <YStack gap="$2">
      <ListTable {...tableProps}>
        <ListTableRow
          label="Reliability score"
          value={value}
          valueColor={
            score == null ? '$color' : score < 75 ? '$red11' : score > 75 ? '$green11' : '$color'
          }
        />
        <ListTableRow
          label="Connection"
          value={
            connection === 'online' ? 'Online' : connection === 'offline' ? 'Offline' : 'Checking…'
          }
          valueColor={
            connection === 'online' ? '$green11' : connection === 'offline' ? '$red11' : '$gray10'
          }
          rightContent={
            <AppIconButton
              variant="default"
              emphasis="tertiary"
              size="xxsmall"
              accessibilityLabel="Recheck mint connection"
              loadingText="Checking mint connection…"
              icon={RefreshCw}
              loading={connection === 'checking'}
              disabled={connection === 'checking'}
              onPress={onRecheck}
            />
          }
        />
      </ListTable>
      {radar.data?.scoreCappedNew && (
        <Text color="$gray10" fontSize={12}>
          New mint · Score capped
        </Text>
      )}
    </YStack>
  );
}

function countryName(code: string | null | undefined) {
  // Hermes does not consistently provide Intl.DisplayNames on Android.
  return countryNames[code?.trim().toUpperCase() as keyof typeof countryNames] ?? 'Unknown';
}

export function MintPreviewHealth({
  url,
  connection,
  connectionCheckedAt,
  onRecheck,
}: {
  url: string;
  connection: 'online' | 'offline' | 'checking';
  connectionCheckedAt?: number;
  onRecheck: () => void;
}) {
  const [listCache, detailCache] = React.useMemo(
    () => [mintHealthService.cachedCashuList(), mintHealthService.cachedCashuDetail(url)] as const,
    [url],
  );
  const radar = useRadarHealth(url);
  const list = useQuery({
    queryKey: ['mint-health', 'cashu-info-list'],
    queryFn: ({ signal }) => mintHealthService.cashuList(signal),
    initialData: listCache?.data,
    initialDataUpdatedAt: listCache?.savedAt,
    staleTime: 300_000,
    retry: false,
  });
  const mint = list.data?.find((item) => item.url === mintHealthUrl(url));
  const matchingDetailCache = !mint || detailCache?.data?.id === mint.id ? detailCache : undefined;
  const detail = useQuery({
    queryKey: ['mint-health', 'cashu-info-detail', url, mint?.id, 'daily-v1'],
    queryFn: ({ signal }) => mintHealthService.cashuDetail(mint!, signal),
    enabled: !!mint,
    initialData: matchingDetailCache?.data,
    initialDataUpdatedAt: matchingDetailCache?.data?.daily?.length
      ? matchingDetailCache.savedAt
      : 0,
    staleTime: 300_000,
    retry: false,
  });
  const unavailable = (loading: boolean, notCovered: boolean) =>
    loading ? 'Checking…' : notCovered ? 'Not monitored' : 'Unavailable';
  const audit = detail.data;
  const stats = audit?.swaps7d.all;
  const uptime24 = audit?.uptime['24h'] ?? mint?.uptime24h ?? radar.data?.uptime24hPct;
  const uptime7 = audit?.uptime['7d'] ?? mint?.uptime7d ?? radar.data?.uptime7dPct;
  const monitoringLoading = list.isFetching || detail.isFetching;
  const notCovered = !!list.data && !mint;
  const testMint = radar.data?.isTest || mint?.isTest;
  const monitoringTime = mint?.lastCheck ?? radar.data?.lastCheckedAt;
  const uptimeSource =
    [
      ...new Set(
        [
          (audit?.uptime['24h'] ?? mint?.uptime24h) != null
            ? 'cashu.info'
            : radar.data?.uptime24hPct != null
              ? 'MintRadar'
              : null,
          (audit?.uptime['7d'] ?? mint?.uptime7d) != null
            ? 'cashu.info'
            : radar.data?.uptime7dPct != null
              ? 'MintRadar'
              : null,
        ].filter(Boolean),
      ),
    ].join(' · ') || 'Unavailable';
  const recheck = () => {
    onRecheck();
    void radar.refetch();
    void list.refetch();
    if (mint) void detail.refetch();
  };

  return (
    <YStack gap="$3">
      <Text color="$gray10" fontSize="$4" fontWeight="600">
        Connection & reliability
      </Text>
      <ListTable {...tableProps}>
        <ListTableRow label="Checked from this device" value={time(connectionCheckedAt)} />
        <ListTableRow label="Server country" value={countryName(audit?.network?.country)} />
        <ListTableRow
          label="Uptime · 24 hours"
          value={uptime24 == null ? unavailable(monitoringLoading, notCovered) : percent(uptime24)}
        />
        <ListTableRow
          label="Uptime · 7 days"
          value={uptime7 == null ? unavailable(monitoringLoading, notCovered) : percent(uptime7)}
        />
        <UptimeHistory daily={audit?.daily} />
        <ListTableRow
          label="Payment success · 7 days"
          value={stats ? paymentTestRate(stats) : unavailable(monitoringLoading, notCovered)}
        />
        {audit?.swaps7d.asDest && (
          <ListTableRow
            label="Receive tests · 7 days"
            value={paymentTestRate(audit.swaps7d.asDest)}
          />
        )}
        {audit?.swaps7d.asSource && (
          <ListTableRow
            label="Send tests · 7 days"
            value={paymentTestRate(audit.swaps7d.asSource)}
          />
        )}
        {audit?.swaps7d.errorsBlamed != null && (
          <ListTableRow
            label="Failures attributed to mint"
            value={String(audit.swaps7d.errorsBlamed)}
          />
        )}
        {stats?.total && stats.avgMs != null ? (
          <ListTableRow
            label="Average payment test"
            value={`${Number((stats.avgMs / 1000).toFixed(2))}s`}
          />
        ) : null}
        <ListTableRow label="Mint balance / reserves" value="Not published" />
        {testMint && (
          <ListTableRow
            label="Network"
            value="Test mint · Not real bitcoin"
            valueColor="$orange10"
          />
        )}
      </ListTable>
      <Text color="$gray10" fontSize={12}>
        Payment tests: cashu.info · Report fetched{' '}
        {time(detail.dataUpdatedAt || list.dataUpdatedAt)}
        {(detail.isError || list.isError || notCovered) && audit ? ' · Saved report' : ''}
        {monitoringTime ? `\nLatest monitoring check: ${time(monitoringTime)}` : ''}
        {`\nUptime source: ${uptimeSource}`}
      </Text>
      <Text color="$gray10" fontSize={12}>
        Reliability measures observed operation, not reserves or fund safety. Route failures can
        involve either mint; attribution is shown separately.
      </Text>
      <AppButton
        variant="default"
        emphasis="secondary"
        size="small"
        disabled={radar.isFetching || monitoringLoading || connection === 'checking'}
        onPress={recheck}
      >
        Check again
      </AppButton>
      <ListTable {...tableProps}>
        <ListTableRow
          label="MintRadar methodology"
          value="Open"
          rightContent={<ExternalLink size={18} color="$gray10" />}
          onPress={() => {
            void Linking.openURL('https://mintradar.org/methodology').catch(() => {});
          }}
        />
        <ListTableRow
          label="cashu.info audit report"
          value="Open"
          rightContent={<ExternalLink size={18} color="$gray10" />}
          onPress={() => {
            void Linking.openURL(
              mint
                ? `https://cashu.info/mint/${encodeURIComponent(mint.id)}`
                : 'https://cashu.info',
            ).catch(() => {});
          }}
        />
      </ListTable>
    </YStack>
  );
}
