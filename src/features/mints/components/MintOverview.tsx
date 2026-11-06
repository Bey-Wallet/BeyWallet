import React, { useState } from 'react';
import { YStack } from 'tamagui';
import { MintCard, MintRows, MintSection, MintDetailRow, MintText as Text } from './MintUI';
import { Activity, RefreshCw, ChevronDown, ChevronUp } from '@tamagui/lucide-icons';
import { AppIconButton } from '~/shared/ui/AppIconButton';
import { MintPreviewHealth, useCashuHealthList, useRadarHealth } from './MintPreviewHealth';
import { mintHealthUrl } from '~/services/api/mintHealthService';
import { MintAboutRows } from './MintAboutRows';

export function MintOverview({
  url,
  info,
  connection,
  onRecheck,
  connectionCheckedAt,
}: {
  url: string;
  info: Record<string, any>;
  connection: 'online' | 'offline' | 'checking';
  onRecheck: () => void;
  connectionCheckedAt?: number;
}) {
  const [expanded, setExpanded] = useState(false);
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
    <YStack gap={16}>
      {(radar.data?.isTest || monitoredMint?.isTest) && (
        <Text kind="body2" color="$orange10" accessibilityRole="alert">
          Test mint · Not real bitcoin
        </Text>
      )}
      {typeof info.motd === 'string' && info.motd.trim() && (
        <MintSection title="Message from the mint">
          <MintCard>
            <Text kind="body2">{info.motd}</Text>
          </MintCard>
        </MintSection>
      )}
      <MintSection title="Mint information">
        <MintRows>
          <MintAboutRows url={url} info={info} />
        </MintRows>
      </MintSection>
      <MintSection title="Connection and reliability">
        <MintRows>
          <MintDetailRow
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

          <MintDetailRow
            label="Reliability"
            icon={Activity}
            value={reliability}
            onPress={() => setExpanded((value) => !value)}
            expanded={expanded}
            rightContent={
              expanded ? (
                <ChevronUp size={20} color="$gray10" />
              ) : (
                <ChevronDown size={20} color="$gray10" />
              )
            }
          />
          {expanded && (
            <MintPreviewHealth
              url={url}
              connection={connection}
              connectionCheckedAt={connectionCheckedAt}
              onRecheck={onRecheck}
              showConnection={false}
            />
          )}
        </MintRows>
        <Text kind="body3" color="$gray10" px={16} pt={8}>
          Uptime: {source} · Does not verify fund safety.
        </Text>
      </MintSection>
    </YStack>
  );
}
