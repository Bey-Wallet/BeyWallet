import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { RefreshControl, ScrollView, AppState } from 'react-native';
import { LegendList } from '@legendapp/list/react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useNavigation, useRouter } from 'expo-router';
import { Check, ChevronLeft, ChevronRight, Clock, SlidersHorizontal } from '@tamagui/lucide-icons';
import { Text, XStack, YStack } from 'tamagui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { initService, historyService, eventService } from '~/services/wallet';
import { useWalletStore } from '~/state/walletStore';
import { useNostrRequestStore } from '~/state/nostrRequestStore';
import AppBottomSheet, { AppBottomSheetRef } from '~/shared/ui/AppBottomSheet';
import { AppPressable } from '~/shared/ui/AppPressable';
import { AppButton } from '~/shared/ui/AppButton';
import { HistoryItem } from './components/HistoryItem';
import { HistorySection } from './components/HistorySection';
import { HistoryPageSkeleton } from './components/HistorySkeletonItem';
import { useHistoryColors } from './historyTheme';
import {
  defaultHistoryFilters,
  filterHistory,
  flattenHistory,
  historyDirections,
  historyTimes,
  historyTypes,
  mergeHistoryTransfers,
  type HistoryFlatItem,
  type HistoryListEntry,
} from './historyListModel';

function FilterOptions({
  title,
  options,
  selected,
  onSelect,
}: {
  title: string;
  options: ReadonlyArray<readonly [string, string]>;
  selected: string;
  onSelect: (value: string) => void;
}) {
  const colors = useHistoryColors();
  return (
    <YStack gap="$2">
      <Text color={colors.secondary} fontFamily="$body" fontSize={14} lineHeight={20}>
        {title}
      </Text>
      <YStack rounded="$6" overflow="hidden" bg={colors.card}>
        {options.map(([value, label], index) => (
          <React.Fragment key={value}>
            {index > 0 && <YStack height={2} bg={colors.background} />}
            <AppPressable
              accessibilityRole="radio"
              accessibilityLabel={label}
              accessibilityState={{ checked: selected === value }}
              minHeight={48}
              px="$4"
              py="$3"
              flexDirection="row"
              items="center"
              gap="$3"
              hoverStyle={{ bg: colors.hover }}
              pressStyle={{ bg: colors.press }}
              onPress={() => onSelect(value)}
            >
              <Text
                flex={1}
                color={colors.primary}
                fontFamily="$body"
                fontSize={16}
                lineHeight={22}
              >
                {label}
              </Text>
              {selected === value && <Check size={20} color={colors.primary} />}
            </AppPressable>
          </React.Fragment>
        ))}
      </YStack>
    </YStack>
  );
}

export function HistoryScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const colors = useHistoryColors();
  const filterSheet = useRef<AppBottomSheetRef>(null);
  const [filters, setFilters] = useState(defaultHistoryFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const mints = useWalletStore((state) => state.mints);
  const { pendingRequests, loadPendingRequests } = useNostrRequestStore();
  const activeCount = [filters.mint, filters.time, filters.type].filter(
    (value) => value !== 'all',
  ).length;
  const isFiltered = activeCount > 0 || filters.direction !== 'all';
  const resetFilters = () => setFilters(defaultHistoryFilters);
  const openFilters = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    filterSheet.current?.present();
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitleAlign: 'center',
      headerTitle: () => (
        <Text
          fontFamily="$body"
          fontSize={24}
          lineHeight={32}
          fontWeight="600"
          color={colors.primary}
        >
          History
        </Text>
      ),
      headerStyle: { backgroundColor: colors.background },
      headerLeft: () => (
        <AppPressable
          ml={16}
          width={48}
          minHeight={48}
          rounded={24}
          bg={colors.card}
          items="center"
          justify="center"
          accessibilityLabel="Back to Home"
          hoverStyle={{ bg: colors.hover }}
          pressStyle={{ bg: colors.press }}
          onPress={() => router.navigate('/(tabs)')}
        >
          <ChevronLeft size={24} color={colors.primary} />
        </AppPressable>
      ),
      headerRight: () => (
        <XStack pr="$4" items="center">
          <AppPressable
            width={48}
            minHeight={48}
            rounded={24}
            bg={colors.card}
            items="center"
            justify="center"
            hoverStyle={{ bg: colors.hover }}
            pressStyle={{ bg: colors.press }}
            accessibilityLabel={
              activeCount ? `Filter history, ${activeCount} active` : 'Filter history'
            }
            accessibilityState={{ expanded: filtersOpen }}
            onPress={openFilters}
          >
            <SlidersHorizontal size={24} color={colors.primary} />
          </AppPressable>
          {activeCount > 0 && (
            <YStack
              pointerEvents="none"
              position="absolute"
              t={0}
              r={12}
              minWidth={18}
              height={18}
              rounded={9}
              bg={colors.primary}
              items="center"
              justify="center"
              aria-hidden
            >
              <Text fontSize={11} fontWeight="700" color={colors.background}>
                {activeCount}
              </Text>
            </YStack>
          )}
        </XStack>
      ),
    });
  }, [navigation, router, colors, activeCount, filtersOpen, openFilters]);

  const {
    data: history = [],
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['history'],
    queryFn: async () => {
      if (!initService.isInitialized()) return [];
      return historyService.getHistory(200, 0) as Promise<HistoryListEntry[]>;
    },
    enabled: initService.isInitialized(),
  });
  useEffect(() => {
    void loadPendingRequests();
  }, [loadPendingRequests]);
  useEffect(() => {
    // Date headings also roll over at local midnight, without polling wallet status.
    let timer: ReturnType<typeof setTimeout>;
    const updateClock = () => {
      const current = new Date();
      setNow(current);
      clearTimeout(timer);
      const midnight = new Date(current.getFullYear(), current.getMonth(), current.getDate() + 1);
      timer = setTimeout(updateClock, midnight.getTime() - current.getTime());
    };
    updateClock();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') updateClock();
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, []);
  useEffect(() => {
    if (!initService.isInitialized()) return;
    const update = () => {
      void queryClient.invalidateQueries({ queryKey: ['history'] });
      void loadPendingRequests();
    };
    const unsubscribes = [
      eventService.on('history:updated', update),
      eventService.on('receive:created', update),
      eventService.on('send:created', update),
      eventService.on('mint-quote:redeemed', update),
    ];
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [queryClient, loadPendingRequests]);

  const flatItems = useMemo(() => {
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
    return flattenHistory(
      filterHistory(mergeHistoryTransfers([...requests, ...history]), filters, now),
      now,
    );
  }, [history, pendingRequests, filters, now]);
  const handleTransactionPress = useCallback(
    (id: string, type: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (type === 'receive-request')
        router.push({ pathname: '/(modals)/receive', params: { requestId: id } });
      else router.push({ pathname: '/(modals)/txn-details', params: { id } });
    },
    [router],
  );
  const renderItem = useCallback(
    ({ item }: { item: HistoryFlatItem }) =>
      item.kind === 'header' ? (
        <HistorySection title={item.title} />
      ) : (
        <HistoryItem entry={item.entry} now={now} onPress={handleTransactionPress} />
      ),
    [handleTransactionPress, now],
  );
  const mintOptions: [string, string][] = [
    ['all', 'All mints'],
    ...mints.map((mint): [string, string] => [
      mint.mintUrl,
      mint.nickname || mint.name || mint.mintUrl.replace(/^https?:\/\//, ''),
    ]),
  ];
  const summary = [
    filters.type !== 'all' && historyTypes.find(([value]) => value === filters.type)?.[1],
    filters.mint !== 'all' &&
      (mintOptions.find(([value]) => value === filters.mint)?.[1] || filters.mint),
    filters.time !== 'all' && historyTimes.find(([value]) => value === filters.time)?.[1],
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <YStack flex={1} bg={colors.background}>
      <YStack pt="$3" pb="$1">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 4, gap: 8 }}
        >
          {historyDirections.map(([value, label]) => (
            <AppPressable
              key={value}
              minHeight={40}
              px={14}
              rounded={100}
              bg={filters.direction === value ? colors.selectedPill : colors.card}
              justify="center"
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected: filters.direction === value }}
              hoverStyle={{ bg: colors.hover }}
              pressStyle={{ bg: colors.press }}
              onPress={() => setFilters((current) => ({ ...current, direction: value }))}
            >
              <Text
                fontFamily="$body"
                fontSize={16}
                lineHeight={22}
                fontWeight="500"
                color={colors.pillText}
              >
                {label}
              </Text>
            </AppPressable>
          ))}
        </ScrollView>
      </YStack>
      {activeCount > 0 && (
        <AppPressable
          onPress={openFilters}
          accessibilityRole="button"
          accessibilityLabel={`Edit filters: ${summary}`}
          minHeight={48}
          mx="$4"
          flexDirection="row"
          items="center"
          gap="$2"
        >
          <Text color={colors.secondary} fontSize={14} lineHeight={20} flex={1} numberOfLines={1}>
            {summary}
          </Text>
          <ChevronRight size={16} color={colors.secondary} />
        </AppPressable>
      )}
      {isLoading ? (
        <HistoryPageSkeleton />
      ) : (
        <LegendList
          recycleItems={false}
          data={flatItems}
          renderItem={renderItem}
          keyExtractor={(item) =>
            item.kind === 'header'
              ? `header-${item.title}`
              : `item-${item.entry.type}-${item.entry.id}`
          }
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              tintColor={colors.primary}
              onRefresh={() => {
                setNow(new Date());
                void refetch();
                void loadPendingRequests();
              }}
            />
          }
          ListHeaderComponent={
            isError && flatItems.length > 0 ? (
              <YStack py="$3" gap="$2">
                <Text color="$gray10">Couldn’t refresh activity.</Text>
                <AppButton size="small" emphasis="secondary" onPress={() => void refetch()}>
                  Retry
                </AppButton>
              </YStack>
            ) : null
          }
          ListEmptyComponent={
            <YStack pt="$8" gap="$3" items="center">
              <Clock size={24} color="$gray10" />
              <Text fontSize="$5" fontWeight="600" color="$color">
                {isError
                  ? 'Couldn’t load activity'
                  : isFiltered
                    ? 'No matching activity'
                    : 'No activity yet'}
              </Text>
              <Text color="$gray10" fontSize="$3" text="center">
                {isError
                  ? 'Try again to load your transactions.'
                  : isFiltered
                    ? 'Try another filter or reset to see all activity.'
                    : 'Your payments and transfers will appear here.'}
              </Text>
              {(isError || isFiltered) && (
                <AppButton
                  size="small"
                  emphasis="secondary"
                  onPress={isError ? () => void refetch() : resetFilters}
                >
                  {isError ? 'Retry' : 'Reset filters'}
                </AppButton>
              )}
            </YStack>
          }
        />
      )}
      <AppBottomSheet
        ref={filterSheet}
        snapPoints={['85%']}
        onOpenChange={setFiltersOpen}
        backgroundColor={colors.background}
      >
        <XStack px="$4" pt="$3" pb="$2" items="center" justify="space-between">
          <Text
            fontFamily="$body"
            fontSize={22}
            lineHeight={28}
            fontWeight="600"
            color={colors.primary}
          >
            Filters
          </Text>
          <AppPressable
            minHeight={48}
            px={12}
            justify="center"
            disabled={!isFiltered}
            accessibilityLabel="Reset filters"
            opacity={isFiltered ? 1 : 0.5}
            onPress={resetFilters}
          >
            <Text fontFamily="$body" fontSize={16} lineHeight={22} color={colors.secondary}>
              Reset
            </Text>
          </AppPressable>
        </XStack>
        <BottomSheetScrollView contentContainerStyle={{ padding: 16, gap: 24 }}>
          <FilterOptions
            title="Payment type"
            options={historyTypes}
            selected={filters.type}
            onSelect={(type) => setFilters((current) => ({ ...current, type }))}
          />
          <FilterOptions
            title="Mint"
            options={mintOptions}
            selected={filters.mint}
            onSelect={(mint) => setFilters((current) => ({ ...current, mint }))}
          />
          <FilterOptions
            title="Time"
            options={historyTimes}
            selected={filters.time}
            onSelect={(time) => setFilters((current) => ({ ...current, time }))}
          />
        </BottomSheetScrollView>
        <YStack px="$4" pt="$2" pb="$5">
          <AppPressable
            minHeight={48}
            rounded={100}
            bg={colors.selectedPill}
            items="center"
            justify="center"
            accessibilityLabel="Done"
            hoverStyle={{ bg: colors.hover }}
            pressStyle={{ bg: colors.press }}
            onPress={() => filterSheet.current?.dismiss()}
          >
            <Text
              fontFamily="$body"
              fontSize={16}
              lineHeight={22}
              fontWeight="500"
              color={colors.pillText}
            >
              Done
            </Text>
          </AppPressable>
        </YStack>
      </AppBottomSheet>
    </YStack>
  );
}
