import { LegendList } from '@legendapp/list/react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshControl } from 'react-native';
import { Text, XStack, YStack, useTheme } from 'tamagui';
import { ArrowDownLeft, ArrowUpRight, Clock, Inbox, RotateCcw, Check } from '@tamagui/lucide-icons';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { initService, historyService, eventService } from '~/services/wallet';
import { useWalletStore } from '~/state/walletStore';
import { useNostrRequestStore } from '~/state/nostrRequestStore';
import { AppPressable } from '~/shared/ui/AppPressable';
import { AppButton } from '~/shared/ui/AppButton';
import AppBottomSheet, { type AppBottomSheetRef } from '~/shared/ui/AppBottomSheet';
import { ListTable, ListTableRow } from '~/shared/ui/ListTable';
import { appTypography } from '~/shared/theme/appearance';
import { HistoryItem } from './components/HistoryItem';
import { HistorySection } from './components/HistorySection';
import { HistoryPageSkeleton } from './components/HistorySkeletonItem';
import { historyDisplayAmount } from './transactionPresentation';
import {
  defaultHistoryFilters,
  filterHistory,
  groupHistory,
  type HistoryFilters,
  type HistoryListEntry,
  type HistoryListRow,
  type QuickFilter,
} from './historyList';

const quickFilters = [
  { key: 'pending', label: 'Pending', icon: Clock },
  { key: 'sent', label: 'Sent', icon: ArrowUpRight },
  { key: 'received', label: 'Received', icon: ArrowDownLeft },
] as const;
const rails = [
  { key: 'all', label: 'All types' },
  { key: 'ecash', label: 'Ecash' },
  { key: 'lightning', label: 'Lightning' },
  { key: 'onchain', label: 'Bitcoin' },
  { key: 'transfer', label: 'Transfers' },
  { key: 'requests', label: 'Requests' },
];
const times = [
  { key: 'all', label: 'All time' },
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'Last 7 days' },
  { key: 'month', label: 'Last 30 days' },
];

function FilterPill({
  label,
  selected,
  onPress,
  icon: Icon,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: typeof Clock;
}) {
  return (
    <AppPressable
      minHeight={48}
      justify="center"
      bg="transparent"
      hoverStyle={{ bg: 'transparent', opacity: 0.85 }}
      pressStyle={{ bg: 'transparent', opacity: 0.6 }}
      onPress={onPress}
      accessibilityLabel={label}
      accessibilityState={{ selected }}
    >
      <XStack
        height={36}
        rounded={100}
        px={12}
        gap={6}
        items="center"
        justify="center"
        bg={selected ? '$accentColor' : '$gray2'}
      >
        {Icon && <Icon size={15} color={selected ? '$onAccent' : '$gray10'} />}
        <Text {...appTypography.label2} color={selected ? '$onAccent' : '$color'}>
          {label}
        </Text>
      </XStack>
    </AppPressable>
  );
}

export function HistoryScreen({
  showFilters = false,
  onFiltersClose,
  onFiltersActiveChange,
}: {
  showFilters?: boolean;
  onFiltersClose?: () => void;
  onFiltersActiveChange?: (active: boolean) => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const theme = useTheme();
  const [filters, setFilters] = useState<HistoryFilters>(defaultHistoryFilters);
  const filterSheet = useRef<AppBottomSheetRef>(null);
  const mints = useWalletStore((state) => state.mints);
  const pendingRequests = useNostrRequestStore((state) => state.pendingRequests);
  const loadPendingRequests = useNostrRequestStore((state) => state.loadPendingRequests);
  const {
    data: history = [],
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['history'],
    queryFn: async (): Promise<HistoryListEntry[]> => {
      if (!initService.isInitialized()) return [];
      return historyService.getHistory(200, 0);
    },
    enabled: initService.isInitialized(),
  });
  useEffect(() => {
    void loadPendingRequests().catch(() => {});
  }, [loadPendingRequests]);
  useEffect(() => {
    if (showFilters) filterSheet.current?.present();
    else filterSheet.current?.dismiss();
  }, [showFilters]);
  const isFiltered = Object.values(filters).some((value) => value !== 'all');
  useEffect(() => {
    onFiltersActiveChange?.(isFiltered);
  }, [isFiltered, onFiltersActiveChange]);
  useEffect(() => {
    if (!initService.isInitialized()) return;
    const handleUpdate = () => {
      void queryClient.invalidateQueries({ queryKey: ['history'] });
      void loadPendingRequests().catch(() => {});
    };
    const unsubs = [
      eventService.on('history:updated', handleUpdate),
      eventService.on('receive:created', handleUpdate),
      eventService.on('send:created', handleUpdate),
      eventService.on('mint-quote:redeemed', handleUpdate),
    ];
    return () => unsubs.forEach((unsubscribe) => unsubscribe());
  }, [queryClient, loadPendingRequests]);
  const entries = useMemo(() => {
    const requests: HistoryListEntry[] = pendingRequests.map((request) => ({
      id: request.id,
      type: 'receive-request',
      amount: request.amount,
      unit: request.unit,
      mintUrl: request.mintUrl,
      state: request.state,
      createdAt: request.createdAt,
      metadata: { creqString: request.creqString, nostrPubkey: request.nostrPubkey },
    }));
    return filterHistory([...requests, ...history], filters);
  }, [history, pendingRequests, filters]);
  const rows = useMemo(() => groupHistory(entries), [entries]);
  const resetFilters = () => setFilters(defaultHistoryFilters);
  const setQuickFilter = (quick: QuickFilter) => {
    Haptics.selectionAsync();
    setFilters((current) => ({ ...current, quick: current.quick === quick ? 'all' : quick }));
  };
  const handlePress = useCallback(
    (id: string, type: string) => {
      if (type === 'receive-request')
        router.push({ pathname: '/(modals)/receive', params: { requestId: id } });
      else router.push({ pathname: '/(modals)/txn-details', params: { id } });
    },
    [router],
  );
  const renderItem = useCallback(
    ({ item }: { item: HistoryListRow }) =>
      item.kind === 'header' ? (
        <HistorySection title={item.title} />
      ) : (
        <HistoryItem
          entry={item.entry}
          displayAmount={historyDisplayAmount(item.entry)}
          position={item.position}
          onPress={handlePress}
        />
      ),
    [handlePress],
  );
  const selectedMint = mints.find((mint) => mint.mintUrl === filters.mint);
  const filterSummary = [
    filters.rail !== 'all' && rails.find((item) => item.key === filters.rail)?.label,
    filters.time !== 'all' && times.find((item) => item.key === filters.time)?.label,
    filters.mint !== 'all' &&
      (selectedMint?.nickname || selectedMint?.name || filters.mint.replace(/^https?:\/\//, '')),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <YStack flex={1} bg="$background">
      <LegendList
        data={rows}
        recycleItems={false}
        keyExtractor={(item) =>
          item.kind === 'header' ? `section-${item.title}` : `${item.entry.type}-${item.entry.id}`
        }
        renderItem={renderItem}
        ListHeaderComponent={
          <YStack>
            <XStack gap={8} flexWrap="wrap">
              {quickFilters.map((filter) => (
                <FilterPill
                  key={filter.key}
                  label={filter.label}
                  icon={filter.icon}
                  selected={filters.quick === filter.key}
                  onPress={() => setQuickFilter(filter.key)}
                />
              ))}
            </XStack>
            {isFiltered && (
              <XStack items="center" justify="space-between" gap={8}>
                <Text {...appTypography.body3} color="$gray10" flex={1} numberOfLines={1}>
                  {entries.length} {entries.length === 1 ? 'transaction' : 'transactions'}
                  {filterSummary ? ` · ${filterSummary}` : ''}
                </Text>
                <AppButton
                  variant="default"
                  emphasis="tertiary"
                  size="xxsmall"
                  onPress={resetFilters}
                >
                  Reset
                </AppButton>
              </XStack>
            )}
          </YStack>
        }
        ListEmptyComponent={
          isLoading ? (
            <HistoryPageSkeleton />
          ) : (
            <YStack items="center" pt={48} gap={12} px={20}>
              <XStack
                width={48}
                height={48}
                rounded={100}
                bg="$gray3"
                items="center"
                justify="center"
              >
                <Inbox size={22} color="$gray10" />
              </XStack>
              <Text {...appTypography.label1} color="$color">
                {isError
                  ? 'Could not load history'
                  : isFiltered
                    ? 'No matching activity'
                    : 'No activity yet'}
              </Text>
              <Text {...appTypography.body2} color="$gray10" text="center">
                {isError
                  ? 'Pull down or try again to refresh your history.'
                  : isFiltered
                    ? 'Try another filter or reset to see all activity.'
                    : 'Your payments and requests will appear here.'}
              </Text>
              {(isFiltered || isError) && (
                <AppButton
                  variant="default"
                  emphasis="secondary"
                  size="small"
                  onPress={
                    isError
                      ? () => {
                          void refetch();
                        }
                      : resetFilters
                  }
                >
                  {isError ? 'Try again' : 'Reset filters'}
                </AppButton>
              )}
            </YStack>
          )
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            tintColor={theme.color.val}
            colors={[theme.color.val]}
            onRefresh={() => {
              void refetch();
              void loadPendingRequests().catch(() => {});
            }}
          />
        }
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      />
      <AppBottomSheet ref={filterSheet} snapPoints={['75%']} onClose={onFiltersClose}>
        <YStack px={16} pt={8} pb={4}>
          <XStack items="center" justify="space-between">
            <Text {...appTypography.title3} color="$color" accessibilityRole="header">
              Filter history
            </Text>
            <AppButton
              variant="default"
              emphasis="tertiary"
              size="xsmall"
              icon={<RotateCcw size={16} />}
              onPress={resetFilters}
              disabled={!isFiltered}
            >
              Reset
            </AppButton>
          </XStack>
        </YStack>
        <BottomSheetScrollView contentContainerStyle={{ padding: 16, gap: 20 }}>
          <YStack gap={4}>
            <Text {...appTypography.label3} color="$gray10">
              Payment type
            </Text>
            <XStack flexWrap="wrap" columnGap={8}>
              {rails.map((item) => (
                <FilterPill
                  key={item.key}
                  label={item.label}
                  selected={filters.rail === item.key}
                  onPress={() => setFilters((current) => ({ ...current, rail: item.key }))}
                />
              ))}
            </XStack>
          </YStack>
          <YStack gap={4}>
            <Text {...appTypography.label3} color="$gray10">
              Date
            </Text>
            <XStack flexWrap="wrap" columnGap={8}>
              {times.map((item) => (
                <FilterPill
                  key={item.key}
                  label={item.label}
                  selected={filters.time === item.key}
                  onPress={() => setFilters((current) => ({ ...current, time: item.key }))}
                />
              ))}
            </XStack>
          </YStack>
          <YStack gap={8}>
            <Text {...appTypography.label3} color="$gray10">
              Mint
            </Text>
            <ListTable>
              {[{ mintUrl: 'all', name: 'All mints', nickname: '' }, ...mints].map((mint) => (
                <ListTableRow
                  key={mint.mintUrl}
                  label={mint.nickname || mint.name || mint.mintUrl.replace(/^https?:\/\//, '')}
                  labelColor="$color"
                  onPress={() => setFilters((current) => ({ ...current, mint: mint.mintUrl }))}
                  iconAfter={
                    filters.mint === mint.mintUrl ? (
                      <Check size={20} color="$iconPrimary" />
                    ) : (
                      <YStack width={20} />
                    )
                  }
                />
              ))}
            </ListTable>
          </YStack>
          <AppButton
            variant="default"
            emphasis="primary"
            size="large"
            onPress={() => filterSheet.current?.dismiss()}
          >
            Show activity
          </AppButton>
        </BottomSheetScrollView>
      </AppBottomSheet>
    </YStack>
  );
}
