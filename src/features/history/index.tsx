import { LegendList } from '@legendapp/list/react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, RefreshControl, useWindowDimensions } from 'react-native';
import { Text, XStack, YStack, useTheme } from 'tamagui';
import { Store, Clock, Inbox, RotateCcw, Check, Search, X, ChevronDown } from '~/shared/icons';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import { hapticService } from '~/services/platform/hapticService';
import { initService, historyService, eventService } from '~/services/wallet';
import { useWalletStore } from '~/state/walletStore';
import { usePeopleStore } from '~/state/peopleStore';
import { useNostrRequestStore } from '~/state/nostrRequestStore';
import { AppPressable } from '~/shared/ui/AppPressable';
import { AppButton } from '~/shared/ui/AppButton';
import { AppInput } from '~/shared/ui/AppInput';
import ActionSelectorSheet, { type ActionSelectorSheetRef } from '~/shared/ui/ActionSelectorSheet';
import AppBottomSheet, { type AppBottomSheetRef } from '~/shared/ui/AppBottomSheet';
import { ListTable, ListTableRow } from '~/shared/ui/ListTable';
import { appTypography } from '~/shared/theme/appearance';
import { HistoryItem } from './components/HistoryItem';
import { HistorySection } from './components/HistorySection';
import { HistoryPageSkeleton } from './components/HistorySkeletonItem';
import { historyDisplayAmount } from './transactionPresentation';
import { subscribeWalletActivity } from '~/services/wallet/walletActivityService';
import { buildHistorySearchIndex, searchHistory } from './historySearch';
import {
  defaultHistoryFilters,
  filterHistory,
  groupHistory,
  historyMintUrls,
  scopeHistory,
  type HistoryScope,
  type HistoryFilters,
  type HistoryListEntry,
  type HistoryListRow,
  type QuickFilter,
} from './historyList';

const rails = [
  { key: 'all', label: 'All activity' },
  { key: 'payments', label: 'Payments' },
  { key: 'maintenance', label: 'Wallet maintenance' },
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
  count,
  dropdown = false,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: typeof Clock;
  count?: number;
  dropdown?: boolean;
}) {
  const foreground = selected ? '$onAccent' : '$color';
  return (
    <AppPressable
      minHeight={48}
      justify="center"
      bg="transparent"
      hoverStyle={{ bg: 'transparent', opacity: 0.85 }}
      pressStyle={{ bg: 'transparent', opacity: 0.6 }}
      onPress={onPress}
      accessibilityLabel={label}
      accessibilityHint={count ? `${count} matching ${count === 1 ? 'item' : 'items'}` : undefined}
      accessibilityState={{ selected }}
      maxWidth="100%"
      flexShrink={dropdown ? 1 : 0}
    >
      <XStack
        height={36}
        rounded={100}
        px={12}
        gap={6}
        items="center"
        justify="center"
        bg={selected ? '$accentColor' : '$buttonDefaultSecondary'}
      >
        {Icon && <Icon size={15} color={selected ? foreground : '$gray10'} />}
        <Text {...appTypography.label2} color={foreground} numberOfLines={1} flexShrink={1}>
          {label}
        </Text>
        {!!count && (
          <Text {...appTypography.label2} color={foreground}>
            {count}
          </Text>
        )}
        {dropdown && <ChevronDown size={14} color={foreground} aria-hidden />}
      </XStack>
    </AppPressable>
  );
}

export function HistoryScreen({
  scope: requestedScope = 'all',
  showFilters = false,
  onFiltersClose,
  onFiltersActiveChange,
  showSearch = false,
  onSearchClose,
}: {
  scope?: HistoryScope;
  showFilters?: boolean;
  onFiltersClose?: () => void;
  onFiltersActiveChange?: (active: boolean) => void;
  showSearch?: boolean;
  onSearchClose?: () => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const theme = useTheme();
  const { height: windowHeight } = useWindowDimensions();
  const [scope, setScope] = useState<HistoryScope>(requestedScope);
  useEffect(() => setScope(requestedScope), [requestedScope]);
  const [filters, setFilters] = useState<HistoryFilters>(defaultHistoryFilters);
  const [searchQuery, setSearchQuery] = useState('');
  const hasSearch = showSearch && searchQuery.trim().length > 0;
  useEffect(() => {
    if (!showSearch) setSearchQuery('');
  }, [showSearch]);
  const filterSheet = useRef<AppBottomSheetRef>(null);
  const mintSheet = useRef<AppBottomSheetRef>(null);
  const receiveSheet = useRef<ActionSelectorSheetRef>(null);
  const [receiveMounted, setReceiveMounted] = useState(false);
  useEffect(() => {
    if (receiveMounted) receiveSheet.current?.present('receive');
  }, [receiveMounted]);
  const mints = useWalletStore((state) => state.mints);
  const people = usePeopleStore((state) => state.people);
  const pendingRequests = useNostrRequestStore((state) => state.pendingRequests);
  const loadPendingRequests = useNostrRequestStore((state) => state.loadPendingRequests);
  const {
    data: posOrigins = [],
    isLoading: originsLoading,
    isError: originsError,
    refetch: refetchOrigins,
  } = useQuery({
    queryKey: ['history', 'pos-origins'],
    queryFn: () => historyService.getPosOrigins(),
    enabled: initService.isInitialized(),
  });
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
      // Scope before limiting: recent POS sales must not crowd out wallet payments.
      return historyService.getActivityHistory(-1, 0);
    },
    enabled: initService.isInitialized(),
  });
  const {
    data: searchableHistory,
    isLoading: isSearchLoading,
    isError: isSearchError,
    isRefetching: isSearchRefetching,
    refetch: refetchSearch,
  } = useQuery({
    queryKey: ['history', 'search'],
    queryFn: async (): Promise<HistoryListEntry[]> => {
      if (!initService.isInitialized()) return [];
      // The SQLite repositories use LIMIT -1 to include all saved payments and activity.
      return historyService.getActivityHistory(-1, 0);
    },
    enabled: initService.isInitialized() && hasSearch,
    staleTime: 30_000,
    gcTime: 60_000,
  });
  useFocusEffect(
    useCallback(() => {
      void queryClient.invalidateQueries({ queryKey: ['history'] });
      void loadPendingRequests().catch(() => {});
    }, [queryClient, loadPendingRequests]),
  );
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
      eventService.on('melt-op:prepared', handleUpdate),
      eventService.on('melt-op:pending', handleUpdate),
      eventService.on('melt-op:finalized', handleUpdate),
      eventService.on('melt-op:rolled-back', handleUpdate),
      eventService.on('receive:created', handleUpdate),
      eventService.on('send:created', handleUpdate),
      eventService.on('mint-quote:redeemed', handleUpdate),
      eventService.on('proofs:saved', handleUpdate),
      subscribeWalletActivity(handleUpdate),
    ];
    return () => unsubs.forEach((unsubscribe) => unsubscribe());
  }, [queryClient, loadPendingRequests]);
  const allEntries = useMemo(() => {
    const requests: HistoryListEntry[] = pendingRequests.map((request) => ({
      id: request.id,
      type: 'receive-request',
      amount: request.amount,
      unit: request.unit,
      mintUrl: request.mintUrl,
      state: request.state,
      createdAt: request.createdAt,
      metadata: {
        creqString: request.creqString,
        nostrPubkey: request.nostrPubkey,
        recipient: request.recipient,
        description: request.description,
      },
    }));
    if (originsLoading || originsError) return [];
    return scopeHistory(
      [...requests, ...(hasSearch ? searchableHistory || [] : history)],
      scope,
      posOrigins,
    );
  }, [
    history,
    searchableHistory,
    pendingRequests,
    hasSearch,
    scope,
    posOrigins,
    originsLoading,
    originsError,
  ]);
  const searchIndex = useMemo(
    () => (hasSearch ? buildHistorySearchIndex(allEntries, { people, mints }) : []),
    [allEntries, people, mints, hasSearch],
  );
  const candidates = useMemo(
    () => (hasSearch ? searchHistory(searchIndex, searchQuery) : allEntries),
    [allEntries, searchIndex, searchQuery, hasSearch],
  );
  const entries = useMemo(() => filterHistory(candidates, filters), [candidates, filters]);
  const pendingCount = useMemo(
    () =>
      filters.quick === 'pending'
        ? entries.length
        : filterHistory(candidates, { ...filters, quick: 'pending' }).length,
    [candidates, entries.length, filters],
  );
  const rows = useMemo(() => groupHistory(entries), [entries]);
  const resetFilters = () => setFilters(defaultHistoryFilters);
  const resetSearchAndFilters = () => {
    resetFilters();
    setSearchQuery('');
    Keyboard.dismiss();
    onSearchClose?.();
  };
  const loading = originsLoading || (hasSearch ? isSearchLoading : isLoading);
  const failed = originsError || (hasSearch ? isSearchError : isError);
  const refreshHistory = () => {
    void (hasSearch ? refetchSearch() : refetch());
    void refetchOrigins();
    void loadPendingRequests().catch(() => {});
  };
  const setQuickFilter = (quick: QuickFilter) => {
    hapticService.selection();
    setFilters((current) => ({ ...current, quick: current.quick === quick ? 'all' : quick }));
  };
  const handlePress = useCallback(
    (id: string, type: string) => {
      if (type === 'receive-request')
        router.push({ pathname: '/(modals)/receive', params: { requestId: id } });
      else if (type === 'maintenance')
        router.push({ pathname: '/wallet-activity', params: { id } });
      else router.push({ pathname: '/txn-details', params: { id } });
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
  const mintOptions = useMemo(() => {
    const options = new Map([['all', 'All mints']]);
    for (const mint of mints) {
      const url = mint.mintUrl.replace(/\/+$/, '');
      options.set(url, mint.nickname || mint.name || url.replace(/^https?:\/\//, ''));
    }
    for (const entry of history) {
      for (const url of historyMintUrls(entry)) {
        if (!options.has(url)) options.set(url, url.replace(/^https?:\/\//, ''));
      }
    }
    return options;
  }, [mints, history]);
  const selectedMintLabel =
    mintOptions.get(filters.mint) ?? filters.mint.replace(/^https?:\/\//, '');
  const filterSummary = [
    filters.rail !== 'all' && rails.find((item) => item.key === filters.rail)?.label,
    filters.time !== 'all' && times.find((item) => item.key === filters.time)?.label,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <YStack flex={1} bg="$background">
      <LegendList
        data={rows}
        recycleItems
        estimatedItemSize={70}
        drawDistance={Math.min(1200, Math.max(600, windowHeight))}
        getItemType={(item) => item.kind}
        keyExtractor={(item) =>
          item.kind === 'header' ? `section-${item.title}` : `${item.entry.type}-${item.entry.id}`
        }
        renderItem={renderItem}
        ListHeaderComponent={
          <YStack>
            {showSearch && (
              <XStack
                minHeight={48}
                bg="$gray2"
                rounded="$6"
                px="$3"
                gap="$2"
                items="center"
                mb="$2"
              >
                <Search size={20} color="$gray10" flexShrink={0} aria-hidden />
                <AppInput
                  autoFocus
                  accessibilityLabel="Search history"
                  accessibilityHint="Search saved people, notes, sats, or a date such as 2026-10-24"
                  placeholder="Person, note, sats, or date"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCorrect={false}
                  autoCapitalize="none"
                  returnKeyType="search"
                  flex={1}
                  minWidth={0}
                  height={48}
                  px={0}
                  py={0}
                  borderWidth={0}
                  bg="transparent"
                  {...appTypography.body2}
                  color="$color"
                  placeholderTextColor="$gray10"
                />
                {searchQuery.length > 0 && (
                  <AppPressable
                    accessibilityLabel="Clear history search"
                    minHeight={48}
                    width={48}
                    items="center"
                    justify="center"
                    onPress={() => setSearchQuery('')}
                  >
                    <X size={20} color="$gray10" aria-hidden />
                  </AppPressable>
                )}
              </XStack>
            )}
            <XStack gap={8}>
              <FilterPill
                label="Pending"
                icon={Clock}
                count={pendingCount}
                selected={filters.quick === 'pending'}
                onPress={() => setQuickFilter('pending')}
              />
              <FilterPill
                label="POS"
                icon={Store}
                selected={scope === 'pos'}
                onPress={() => {
                  Keyboard.dismiss();
                  hapticService.selection();
                  setScope((current) => (current === 'pos' ? 'all' : 'pos'));
                }}
              />
              <FilterPill
                label={selectedMintLabel}
                selected={filters.mint !== 'all'}
                dropdown
                onPress={() => {
                  Keyboard.dismiss();
                  mintSheet.current?.present();
                }}
              />
            </XStack>
            {(isFiltered || hasSearch) && (
              <XStack items="center" justify="space-between" gap={8}>
                <Text {...appTypography.body3} color="$gray10" flex={1} numberOfLines={1}>
                  {hasSearch && isSearchLoading
                    ? 'Searching history…'
                    : `${entries.length} ${entries.length === 1 ? 'result' : 'results'}`}
                  {filterSummary ? ` · ${filterSummary}` : ''}
                </Text>
                <AppButton
                  variant="default"
                  emphasis="ghost"
                  size="xxsmall"
                  onPress={resetSearchAndFilters}
                >
                  Reset
                </AppButton>
              </XStack>
            )}
            {hasSearch && isSearchError && entries.length > 0 && (
              <YStack gap="$2" py="$2">
                <Text {...appTypography.body3} color="$red10" accessibilityRole="alert">
                  Could not refresh all history. Results may be outdated.
                </Text>
                <AppButton emphasis="secondary" size="small" onPress={refreshHistory}>
                  Try again
                </AppButton>
              </YStack>
            )}
          </YStack>
        }
        ListEmptyComponent={
          loading ? (
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
              <Text {...appTypography.label2} color="$color">
                {failed
                  ? hasSearch
                    ? 'Could not search history'
                    : 'Could not load history'
                  : isFiltered || hasSearch
                    ? 'No matching activity'
                    : scope === 'pos'
                      ? 'No POS activity yet'
                      : 'No activity yet'}
              </Text>
              <Text {...appTypography.body3} color="$gray10" text="center">
                {failed
                  ? 'Pull down or try again to refresh your history.'
                  : isFiltered || hasSearch
                    ? 'Try another search or filter, or reset to see recent activity.'
                    : scope === 'pos'
                      ? 'Requests and payments created in point of sale appear here.'
                      : 'Receive your first payment to start your history.'}
              </Text>
              {(isFiltered || hasSearch || failed) && (
                <AppButton
                  variant="default"
                  emphasis="secondary"
                  size="small"
                  onPress={failed ? refreshHistory : resetSearchAndFilters}
                >
                  {failed ? 'Try again' : hasSearch ? 'Reset search and filters' : 'Reset filters'}
                </AppButton>
              )}
              {!isFiltered && !hasSearch && !failed && (
                <AppButton
                  emphasis="secondary"
                  onPress={() => {
                    if (scope === 'pos') {
                      router.push('/(modals)/point-of-sale');
                      return;
                    }
                    if (receiveSheet.current) receiveSheet.current.present('receive');
                    else setReceiveMounted(true);
                  }}
                >
                  {scope === 'pos' ? 'New sale' : 'Receive'}
                </AppButton>
              )}
            </YStack>
          )
        }
        refreshControl={
          <RefreshControl
            refreshing={hasSearch ? isSearchRefetching : isRefetching}
            tintColor={theme.color.val}
            colors={[theme.color.val]}
            onRefresh={refreshHistory}
          />
        }
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      />
      {receiveMounted && <ActionSelectorSheet ref={receiveSheet} />}
      <AppBottomSheet title="Filter by mint" ref={mintSheet}>
        <ListTable>
          {Array.from(mintOptions, ([url, label]) => (
            <ListTableRow
              key={url}
              label={label}
              selected={filters.mint === url}
              onPress={() => {
                hapticService.selection();
                setFilters((current) => ({ ...current, mint: url }));
                mintSheet.current?.dismiss();
              }}
              iconAfter={
                filters.mint === url ? (
                  <Check size={20} color="$iconPrimary" />
                ) : (
                  <YStack width={20} />
                )
              }
            />
          ))}
        </ListTable>
      </AppBottomSheet>
      <AppBottomSheet
        title="Filter history"
        headerActions={
          <AppButton
            variant="default"
            emphasis="ghost"
            size="xsmall"
            icon={<RotateCcw size={16} />}
            onPress={resetFilters}
            disabled={!isFiltered}
          >
            Reset
          </AppButton>
        }
        ref={filterSheet}
        onClose={onFiltersClose}
      >
        <YStack gap={20}>
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
          <AppButton
            variant="default"
            emphasis="primary"
            size="large"
            onPress={() => filterSheet.current?.dismiss()}
          >
            Show activity
          </AppButton>
        </YStack>
      </AppBottomSheet>
    </YStack>
  );
}
