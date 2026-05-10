import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { YStack, XStack, Text, ScrollView, Button, View, Separator, Circle, ListItem, Avatar, Square } from 'tamagui';
import { ChevronLeft, ChevronDown, RefreshCw, ArrowUpRight, ArrowDownLeft, Check, History as HistoryIcon, Building2, BanknoteArrowUp, BanknoteArrowDown, Landmark, Clock, Trash2, ChevronRight, Database, Zap } from '@tamagui/lucide-icons';
import { useRouter, Stack, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DeviceEventEmitter } from 'react-native';
import { historyService } from '~/services/core';
import { useWalletStore } from '~/store/walletStore';
import { useNostrRequestStore, type NostrReceiveRequest } from '~/store/nostrRequestStore';
import { formatLocalTime } from '~/utils/time';
import { RollingNumber } from '~/components/UI/RollingNumber';
import AppBottomSheet, { AppBottomSheetRef } from '~/components/UI/AppBottomSheet';
import { PendingTokenLayout } from '~/components/UI/PendingTokenLayout';
import { useSettingsStore } from '~/store/settingsStore';
import { currencyService, CurrencyCode } from '~/services/currencyService';
import { bitcoinService } from '~/services/bitcoinService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

type EntryKind = 'history' | 'nostr_request';

interface UnifiedEntry {
  id: string;
  kind: EntryKind;
  mintUrl: string;
  type: string;
  amount: number;
  unit: string;
  state: string;
  createdAt: number;
  // optional extras
  nostrRequest?: NostrReceiveRequest;
  historyEntry?: any;
}

function historyToUnified(e: any): UnifiedEntry {
  return {
    id: String(e.id),
    kind: 'history',
    mintUrl: e.mintUrl,
    type: e.type,
    amount: e.amount,
    unit: e.unit ?? 'sat',
    state: e.state ?? 'pending',
    createdAt: e.createdAt ?? 0,
    historyEntry: e,
  };
}

function nostrRequestToUnified(r: NostrReceiveRequest): UnifiedEntry {
  return {
    id: r.id,
    kind: 'nostr_request',
    mintUrl: r.mintUrl,
    type: 'receive_request',
    amount: r.amount,
    unit: r.unit,
    state: r.state === 'received' ? 'received' : 'pending',
    createdAt: r.createdAt,
    nostrRequest: r,
  };
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function EcashModal() {
  const router = useRouter();
  const { mints } = useWalletStore();
  const insets = useSafeAreaInsets();
  const { secondaryCurrency } = useSettingsStore();
  const [selectedMint, setSelectedMint] = useState('all');
  const sheetRef = useRef<AppBottomSheetRef>(null);
  const queryClient = useQueryClient();

  // Load pending Nostr requests on mount
  const { loadPendingRequests, clearExpiredRequests, pendingRequests } = useNostrRequestStore();

  useEffect(() => {
    loadPendingRequests();
    clearExpiredRequests();
  }, []);

  // Listen for incoming ecash from Nostr — refresh everything
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('nostr:received', (payload) => {
      console.log('[EcashScreen] nostr:received event — refreshing queries', payload);
      queryClient.invalidateQueries({ queryKey: ['history', 'pending'] });
      queryClient.invalidateQueries({ queryKey: ['balance'] });
      // Also reload Nostr requests so state updates to 'received'
      loadPendingRequests();
    });
    return () => sub.remove();
  }, [queryClient, loadPendingRequests]);

  // Refresh when navigating back from Proof Manager
  useFocusEffect(useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['history', 'pending'] });
    loadPendingRequests();
  }, [queryClient, loadPendingRequests]));

  const { data: btcData } = useQuery({
    queryKey: ['bitcoinPrice', secondaryCurrency],
    queryFn: () => bitcoinService.fetchPrice(secondaryCurrency),
    staleTime: 30000,
  });

  // ── History entries (pending/unclaimed) ─────────────────────────────────────
  const { data: history = [], isFetching, refetch } = useQuery({
    queryKey: ['history', 'pending'],
    queryFn: async () => {
      const entries = await historyService.getHistory(500, 0);
      return entries.filter((e: any) => e.state === 'pending' || e.state === 'unclaimed');
    }
  });

  // ── Merged unified view ─────────────────────────────────────────────────────
  const allEntries = useMemo<UnifiedEntry[]>(() => {
    const histUnified = (history as any[]).map(historyToUnified);

    // Only include Nostr requests that aren't already matched to a history entry
    // (avoid showing duplicate "received" items)
    const nostrUnified = pendingRequests.map(nostrRequestToUnified);

    const combined = [...nostrUnified, ...histUnified];

    // Deduplicate by id (Nostr requests win on conflict)
    const seen = new Set<string>();
    return combined.filter(e => {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });
  }, [history, pendingRequests]);

  const filteredEntries = useMemo(() => {
    if (selectedMint === 'all') return allEntries;
    return allEntries.filter(
      e => e.mintUrl.replace(/\/$/, '') === selectedMint.replace(/\/$/, '')
    );
  }, [allEntries, selectedMint]);

  const totalPending = useMemo(() => {
    return filteredEntries
      .filter(e => e.state === 'pending' || e.state === 'unclaimed')
      .reduce((sum, e) => sum + (e.amount || 0), 0);
  }, [filteredEntries]);

  const fiatPending = useMemo(() => {
    if (!btcData?.price) return 0;
    return currencyService.convertSatsToCurrency(totalPending, btcData.price);
  }, [totalPending, btcData?.price]);

  const handleItemPress = (entry: UnifiedEntry) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (entry.kind === 'history') {
      router.push({
        pathname: '/(modals)/txn-details',
        params: { id: entry.id }
      });
    }
    // Nostr requests don't have a details page yet — could add one later
  };

  const handleSelectMint = (url: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedMint(url);
    sheetRef.current?.dismiss();
  };

  const getMintLabel = (url: string) => {
    if (url === 'all') return 'All Mints';
    const mint = mints.find(m => m.mintUrl === url);
    return mint?.nickname || mint?.name || url.replace(/^https?:\/\//, '').substring(0, 15);
  };

  const getTransactionStyle = (entry: UnifiedEntry) => {
    if (entry.kind === 'nostr_request') {
      return {
        icon: Zap,
        iconColor: '$orange10',
        bgColor: '$orange2',
        sign: '+',
      };
    }
    const isOutgoing = entry.type === 'send' || entry.type === 'melt';
    return {
      icon: entry.type === 'mint' ? Landmark : (isOutgoing ? BanknoteArrowUp : BanknoteArrowDown),
      iconColor: isOutgoing ? '$red10' : '$green11',
      bgColor: isOutgoing ? '$red2' : '$green2',
      sign: isOutgoing ? '-' : '+',
    };
  };

  const getEntryLabel = (entry: UnifiedEntry) => {
    if (entry.kind === 'nostr_request') {
      return entry.state === 'received' ? 'Request Received' : 'Request Pending';
    }
    return entry.type;
  };

  const activeMint = mints.find(m => m.mintUrl === selectedMint);

  return (
    <YStack flex={1} bg="$background">
      <Stack.Screen
        options={{

          headerLeft: () => (
            <Button
              circular
              chromeless
              icon={<ChevronLeft size={24} />}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.back();
              }}
            />
          ),
          headerRight: () => (
            <Button
              circular
              chromeless
              icon={<RefreshCw size={20} className={isFetching ? 'spin' : ''} />}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                refetch();
                loadPendingRequests();
              }}
            />
          )
        }}
      />

      <ScrollView
        flex={1}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
      >
        <YStack px="$4" pt="$4" gap="$2" >
          <XStack>
            <Button
              size="$2.5"
              theme="gray"
              px="$1.5"
              bg="$color5"
              rounded="$3"
              borderWidth={1}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
                sheetRef.current?.present();
              }}
              pressStyle={{ scale: 0.97, opacity: 0.9 }}
              icon={
                <Avatar rounded="$3" size="$1.5">
                  <Avatar.Image src={activeMint?.icon} />
                  <Avatar.Fallback backgroundColor="$color5" alignItems="center" justifyContent="center">
                    <Building2 size={12} color="$color10" />
                  </Avatar.Fallback>
                </Avatar>
              }
              iconAfter={
                <Square size="$1.5" bg="$color2" rounded="$3">
                  <ChevronDown size={12} strokeWidth={2.5} color="$color" />
                </Square>
              }
              textProps={{ numberOfLines: 1, ellipsizeMode: 'tail', maxW: 100 }}
            >
              {getMintLabel(selectedMint)}
            </Button>
          </XStack>
          <XStack justify="space-between" py="$2" items="flex-end">
            <YStack>
              <RollingNumber
                value={totalPending}
                prefix="₿"
                letterSpacing={-1}
                fontSize={30}
                fontWeight="900"
                color="$accent3"
                decimalOpacity={0.4}
                showDecimals={false}
              />
            </YStack>
            <Text color="$accent9" fontWeight="700">SATS</Text>
          </XStack>
          <RollingNumber
            value={fiatPending}
            letterSpacing={-1}
            fontSize={16}
            fontWeight="900"
            color="$accent8"
            decimalOpacity={0.4}
            showDecimals={false}
          >
            {currencyService.formatValue(fiatPending, secondaryCurrency as CurrencyCode)}
          </RollingNumber>

          <YStack pt="$4">
            <XStack justify="space-between" themeInverse pb="$4" items="center">
              <Text fontSize="$5" color="$color4" fontWeight="800">Pending & Requests</Text>
              <View bg="$gray2" px="$2" py="$1" rounded="$3">
                <Text fontSize="$3" color="$color" fontWeight="800">{filteredEntries.length}</Text>
              </View>
            </XStack>

            <YStack rounded="$5" bg="$gray2" overflow="hidden">
              {filteredEntries.length === 0 ? (
                <YStack py="$10" items="center" justify="center" gap="$3" opacity={0.5} p="$3">
                  <View p="$4" bg="$gray2" rounded="$4">
                    <HistoryIcon size={32} color="$gray9" />
                  </View>
                  <YStack items="center">
                    <Text fontWeight="700">No pending tokens</Text>
                    <Text fontSize="$3" color="$gray9" textAlign="center" mt="$1">
                      Tokens waiting to be claimed and incoming Nostr payment requests will appear here.
                    </Text>
                  </YStack>
                </YStack>
              ) : (
                filteredEntries.map((entry, index) => {
                  const style = getTransactionStyle(entry);
                  const statusLabel = entry.kind === 'nostr_request'
                    ? (entry.state === 'received' ? 'received' : 'awaiting')
                    : (entry.state || 'pending');

                  return (
                    <React.Fragment key={entry.id}>
                      <YStack
                        onPress={() => handleItemPress(entry)}
                        pressStyle={{ opacity: 0.7, scale: 0.98 }}
                        py="$2"
                        px="$2"
                      >
                        <XStack justify="space-between" items="center">
                          <XStack gap="$3" items="center">
                            <View
                              p="$2.5"
                              rounded="$4"
                              bg="$color6"
                              theme="gray"
                            >
                              <style.icon size={22} strokeWidth={2.5} color={style.iconColor as any} />
                            </View>
                            <YStack>
                              <XStack gap="$2" items="center">
                                <Text fontWeight="700" fontSize="$4" textTransform="capitalize">
                                  {getEntryLabel(entry)}
                                </Text>
                                <XStack px="$1.5" py="$0.5" bg="$gray5" rounded="$2">
                                  <Text fontSize="$1" fontWeight="800" textTransform="uppercase" color="$gray10">
                                    {statusLabel}
                                  </Text>
                                </XStack>
                              </XStack>
                              {entry.kind === 'nostr_request' && entry.nostrRequest?.description ? (
                                <Text fontSize="$2" color="$gray9" numberOfLines={1}>
                                  {entry.nostrRequest.description}
                                </Text>
                              ) : null}
                            </YStack>
                          </XStack>

                          <YStack items="flex-end">
                            <Text
                              fontWeight="900"
                              fontSize="$5"
                              color={style.iconColor as any}
                            >
                              {style.sign}{entry.amount.toLocaleString()}
                            </Text>
                            <Text fontSize="$1" color="$gray10" fontWeight="600">{entry.unit?.toUpperCase() || 'SATS'}</Text>
                          </YStack>
                        </XStack>
                      </YStack>
                      {index < filteredEntries.length - 1 && <Separator borderColor="$borderColor" opacity={0.5} />}
                    </React.Fragment>
                  );
                })
              )}
            </YStack>
          </YStack>
        </YStack>
      </ScrollView>

      {/* Proof Manager link */}
      <YStack
        px="$4"
        pb={insets.bottom + 16}
        pt="$2"
        borderTopWidth={1}
        borderColor="$borderColor"
        bg="$background"
      >
        <Button
          size="$4"
          theme="gray"
          chromeless
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/(modals)/proofs');
          }}
          icon={<Database size={16} color="$color10" />}
          iconAfter={<ChevronRight size={16} color="$color10" />}
          pressStyle={{ scale: 0.98, opacity: 0.85 }}
          animation="quick"
          bg="$gray2"
          rounded="$4"
        >
          <Text fontWeight="700" fontSize="$3" flex={1}>Proof Manager</Text>
        </Button>
      </YStack>

      <AppBottomSheet ref={sheetRef} snapPoints={["50%", "85%"]}>
        <YStack p="$4" gap="$4" pb={insets.bottom + 40}>
          <Text fontSize="$6" fontWeight="700">Filter by Mint</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            <YStack gap="$2" pb="$4">
              <ListItem
                title="All Mints"
                icon={<Building2 size={20} color="$gray10" />}
                iconAfter={selectedMint === 'all' ? <Check size={18} color="$green10" /> : null}
                onPress={() => handleSelectMint('all')}
                bg={selectedMint === 'all' ? "$gray3" : "transparent"}
                rounded="$4"
              />
              {mints.map((mint) => (
                <ListItem
                  key={mint.mintUrl}
                  title={mint.nickname || mint.name || mint.mintUrl.replace(/^https?:\/\//, '')}
                  subTitle={mint.mintUrl}
                  icon={
                    <Avatar rounded="$3" size="$2">
                      <Avatar.Image src={mint.icon} />
                      <Avatar.Fallback backgroundColor="$gray5" alignItems="center" justifyContent="center">
                        <Building2 size={16} color="$gray10" />
                      </Avatar.Fallback>
                    </Avatar>
                  }
                  iconAfter={selectedMint === mint.mintUrl ? <Check size={18} color="$green10" /> : null}
                  onPress={() => handleSelectMint(mint.mintUrl)}
                  bg={selectedMint === mint.mintUrl ? "$gray3" : "transparent"}
                  rounded="$4"
                />
              ))}
            </YStack>
          </ScrollView>
        </YStack>
      </AppBottomSheet>
    </YStack>
  );
}
