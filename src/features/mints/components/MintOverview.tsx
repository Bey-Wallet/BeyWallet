import React, { useState } from 'react';
import { Text, YStack } from 'tamagui';
import { Activity, Info, Wallet, RefreshCw, ChevronDown, ChevronUp } from '@tamagui/lucide-icons';
import { AppIconButton } from '~/shared/ui/AppIconButton';
import { ListTable, ListTableRow } from '~/shared/ui/ListTable';
import { MintPreviewHealth, useCashuHealthList, useRadarHealth } from './MintPreviewHealth';
import { mintHealthUrl } from '~/services/api/mintHealthService';
import { MintPreviewMethods } from './MintPreviewMethods';
import { MintAboutRows } from './MintAboutRows';

export function MintOverview({
  url,
  info,
  connection,
  onRecheck,
  preview = false,
  connectionCheckedAt,
}: {
  url: string;
  info: Record<string, any>;
  connection: 'online' | 'offline' | 'checking';
  onRecheck: () => void;
  preview?: boolean;
  connectionCheckedAt?: number;
}) {
  const [expanded, setExpanded] = useState<'payments' | 'reliability' | 'about' | null>(null);
  const toggle = (section: 'payments' | 'reliability' | 'about') =>
    setExpanded((value) => (value === section ? null : section));
  const radar = useRadarHealth(url);
  const list = useCashuHealthList();
  const monitoredMint = list.data?.find((mint) => mint.url === mintHealthUrl(url));
  const uptime = monitoredMint?.uptime7d ?? radar.data?.uptime7dPct;
  const source = monitoredMint?.uptime7d != null ? 'cashu.info' : 'MintRadar';
  const saved = source === 'cashu.info' ? list.isError : radar.isError;
  const reliability =
    uptime != null
      ? `${Number(uptime.toFixed(1))}% uptime · 7d${saved ? ' · Saved' : ''}`
      : radar.isFetching || list.isFetching
        ? 'Checking…'
        : radar.data === null && list.data && !monitoredMint
          ? 'Not monitored'
          : 'Unavailable';

  return (
    <YStack gap="$4">
      {(radar.data?.isTest || monitoredMint?.isTest) && (
        <Text color="$orange10" fontSize={14} accessibilityRole="alert">
          Test mint · Not real bitcoin
        </Text>
      )}
      {typeof info.motd === 'string' && info.motd.trim() && (
        <YStack gap="$2">
          <Text color="$gray10" fontSize={12}>
            Message from the mint
          </Text>
          <Text color="$color" fontSize={14}>
            {info.motd}
          </Text>
        </YStack>
      )}
      <ListTable compact>
        <ListTableRow
          label="Connection"
          value={
            connection === 'checking'
              ? 'Checking…'
              : connection === 'offline'
                ? 'Unreachable'
                : 'Reachable'
          }
          valueColor={connection === 'online' ? '$green11' : '$gray10'}
          rightContent={
            <AppIconButton
              emphasis="ghost"
              size="xxsmall"
              icon={RefreshCw}
              accessibilityLabel="Recheck mint connection"
              loadingText="Checking mint connection…"
              loading={connection === 'checking'}
              disabled={connection === 'checking'}
              onPress={onRecheck}
            />
          }
        />
      </ListTable>
      {preview && (
        <YStack gap="$3">
          <Text color="$gray10" fontSize="$4" fontWeight="600">
            Payment methods
          </Text>
          <ListTable compact>
            <MintPreviewMethods info={info} summaryOnly />
          </ListTable>
        </YStack>
      )}
      <YStack gap="$2">
        <ListTable compact>
          <ListTableRow
            label="Payments & limits"
            icon={Wallet}
            onPress={() => toggle('payments')}
            expanded={expanded === 'payments'}
            rightContent={
              expanded === 'payments' ? (
                <ChevronUp size={20} color="$gray10" />
              ) : (
                <ChevronDown size={20} color="$gray10" />
              )
            }
          />
          {expanded === 'payments' && <MintPreviewMethods info={info} hideSummary={preview} />}
          <ListTableRow
            label="Reliability"
            icon={Activity}
            value={reliability}
            onPress={() => toggle('reliability')}
            expanded={expanded === 'reliability'}
            rightContent={
              expanded === 'reliability' ? (
                <ChevronUp size={20} color="$gray10" />
              ) : (
                <ChevronDown size={20} color="$gray10" />
              )
            }
          />
          {expanded === 'reliability' && (
            <MintPreviewHealth
              url={url}
              connection={connection}
              connectionCheckedAt={connectionCheckedAt}
              onRecheck={onRecheck}
              showConnection={false}
            />
          )}
          <ListTableRow
            label="About this mint"
            icon={Info}
            onPress={() => toggle('about')}
            expanded={expanded === 'about'}
            rightContent={
              expanded === 'about' ? (
                <ChevronUp size={20} color="$gray10" />
              ) : (
                <ChevronDown size={20} color="$gray10" />
              )
            }
          />
          {expanded === 'about' && <MintAboutRows url={url} info={info} />}
        </ListTable>
        <Text color="$gray10" fontSize={12}>
          Uptime: {source} · Does not verify fund safety.
        </Text>
      </YStack>
    </YStack>
  );
}
