/**
 * NostrActivity
 *
 * Home screen section showing only unclaimed incoming Nostr ecash.
 * Simple row: left blockie + name/npub, right rounded amount button.
 * Claimed items disappear from home — full history lives in the
 * nostr-activity modal.
 *
 * On mount, runs refreshPendingStates() to auto-mark any already-spent
 * tokens as claimed so they don't linger after restarts.
 */

import React, { useMemo, useEffect, useState } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { YStack, XStack, H6, Text, View, styled, Button, Image } from 'tamagui';
import { X, ArrowUpRight } from '@tamagui/lucide-icons';
import Blockies from '~/shared/ui/Blockies';
import { useNostrInboxStore, type NostrInboxItem } from '~/state/nostrInboxStore';
import { nip19 } from 'nostr-tools';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import AppBottomSheet, { AppBottomSheetRef } from '~/shared/ui/AppBottomSheet';
import { useSettingsStore } from '~/state/settingsStore';
import { useQuery } from '@tanstack/react-query';
import { bitcoinService } from '~/services/api/bitcoinService';
import { currencyService } from '~/services/wallet/currencyService';
import { usePeopleStore } from '~/state/peopleStore';
import type { Person } from '~/state/peopleStore';
import Nip05VerifiedBadge from '~/shared/icons/Nip05VerifiedBadge';

function safeNpubEncode(pubkey: string): string {
  if (!pubkey) return '';
  if (pubkey.startsWith('npub1')) return pubkey;
  if (pubkey.startsWith('nprofile1')) {
    try {
      const decoded = nip19.decode(pubkey);
      if (decoded.type === 'nprofile') {
        return nip19.npubEncode(decoded.data.pubkey);
      }
    } catch {}
    return pubkey;
  }
  // Assume hex
  try {
    return nip19.npubEncode(pubkey);
  } catch {
    return pubkey;
  }
}

function formatNpub(hex: string): string {
  try {
    const npub = safeNpubEncode(hex);
    return `${npub.slice(0, 8)}…${npub.slice(-4)}`;
  } catch {
    return `${hex.slice(0, 6)}…`;
  }
}

function useResolveUsername(pubkey: string): string | undefined {
  const people = usePeopleStore((s) => s.people);

  return useMemo(() => {
    const npub = safeNpubEncode(pubkey);
    const candidates = [pubkey, npub];

    for (const key of candidates) {
      if (people[key]?.username) return people[key].username!;
    }
    return undefined;
  }, [pubkey, people]);
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const RowContainer = styled(XStack, {
  items: 'center',
  justify: 'space-between',
  gap: '$2',
  pressStyle: { opacity: 0.7 },
});

function SenderAvatar({
  person,
  pubkey,
  unseen,
}: {
  person?: Person;
  pubkey: string;
  unseen: boolean;
}) {
  const [pictureFailed, setPictureFailed] = useState(false);

  useEffect(() => setPictureFailed(false), [person?.picture]);

  return (
    <View position="relative">
      <View width={45} height={45} rounded="$3" overflow="hidden" bg="$gray4">
        {person?.picture && !pictureFailed ? (
          <Image
            source={{ uri: person.picture }}
            width={45}
            height={45}
            onError={() => setPictureFailed(true)}
          />
        ) : (
          <Blockies seed={pubkey} size={10} scale={4.5} style={{ borderRadius: 5 }} />
        )}
      </View>
      {unseen && (
        <View
          position="absolute"
          top={-2}
          right={-2}
          bg="$red10"
          width={8}
          height={8}
          rounded="$10"
          borderWidth={1.5}
          borderColor="$color2"
        />
      )}
    </View>
  );
}

export default function NostrActivity() {
  const items = useNostrInboxStore((s) => s.items);
  const refreshPendingStates = useNostrInboxStore((s) => s.refreshPendingStates);
  const router = useRouter();

  const people = usePeopleStore((s) => s.people);

  const { primaryCurrency, secondaryCurrency } = useSettingsStore();

  const { data: btcData } = useQuery({
    queryKey: ['bitcoinPrice', secondaryCurrency],
    queryFn: () => bitcoinService.fetchPrice(secondaryCurrency),
    enabled: secondaryCurrency !== 'NONE',
    staleTime: 30000,
  });

  // On mount, check if any "pending" items are actually already spent
  useEffect(() => {
    const timer = setTimeout(() => {
      refreshPendingStates().catch(() => {});
    }, 2000); // Delay so it doesn't compete with init
    return () => clearTimeout(timer);
  }, []);

  // Only unclaimed (pending / failed) items
  const unclaimed = useMemo(
    () =>
      items.filter(
        (i) => i.status === 'pending' || i.status === 'failed' || i.status === 'approval_required',
      ),
    [items],
  );

  const [selectedRequest, setSelectedRequest] = React.useState<NostrInboxItem | null>(null);
  const sheetRef = React.useRef<AppBottomSheetRef>(null);

  const resolvedRequestUsername = useResolveUsername(selectedRequest?.senderPubkey || '');
  const requestDisplayName =
    selectedRequest?.senderUsername ||
    resolvedRequestUsername ||
    (selectedRequest?.senderPubkey ? formatNpub(selectedRequest.senderPubkey) : 'Someone');

  const handleOpenClaim = (item: NostrInboxItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (item.type === 'request') {
      setSelectedRequest(item);
      sheetRef.current?.present();
    } else {
      DeviceEventEmitter.emit('nostr:openClaim', item);
    }
  };

  const handlePayRequest = () => {
    if (!selectedRequest) return;
    sheetRef.current?.dismiss();
    router.push({
      pathname: '/(modals)/send',
      params: { paymentRequest: selectedRequest.tokenString, inboxItemId: selectedRequest.id },
    });
  };

  const handleDeclineRequest = () => {
    if (!selectedRequest) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    useNostrInboxStore.getState().dismiss(selectedRequest.id);
    sheetRef.current?.dismiss();
  };

  // Nothing to show — hide entirely
  if (unclaimed.length === 0) return null;

  return (
    <YStack width="100%" gap="$4" p="$2.5" pr="$4" rounded="$6" bg={'$color2'}>
      {/* Section header */}
      <XStack items="center" justify="space-between">
        <XStack items="center" gap="$2">
          <H6 color="$gray10">Incoming</H6>
          <View bg="$red10" px="$1.5" py="$0.5" rounded="$10" minWidth={20} items="center">
            <Text color="white" fontSize={10} fontWeight="900">
              {unclaimed.length}
            </Text>
          </View>
        </XStack>
        <Text
          fontSize="$2"
          color="$gray10"
          fontWeight="600"
          onPress={() => router.push('/(modals)/nostr-activity')}
          pressStyle={{ opacity: 0.6 }}
        >
          View All
        </Text>
      </XStack>

      <YStack gap="$3">
        {unclaimed.map((item) => {
          const npub = safeNpubEncode(item.senderPubkey);
          const person = people[npub] || people[item.senderPubkey];
          const resolvedUsername = item.senderUsername || person?.username || undefined;
          const fullUsername =
            person?.nip05 ||
            (resolvedUsername
              ? resolvedUsername.includes('@')
                ? resolvedUsername
                : `${resolvedUsername}@bey.cash`
              : undefined);
          const displayName =
            person?.displayName || resolvedUsername || formatNpub(item.senderPubkey);
          const sign = item.type === 'request' ? '' : '+';
          const satsAmount = `${sign}${currencyService.formatSats(item.amount)}`;
          const formattedFiat =
            secondaryCurrency !== 'NONE' && btcData?.price
              ? `${sign}${currencyService.formatValue(
                  currencyService.convertSatsToCurrency(item.amount, btcData.price),
                  secondaryCurrency as any,
                )}`
              : null;
          const primaryAmount =
            primaryCurrency === 'FIAT' && formattedFiat ? formattedFiat : satsAmount;
          const secondaryAmount =
            primaryCurrency === 'FIAT' && formattedFiat ? satsAmount : formattedFiat;

          return (
            <RowContainer key={item.id} onPress={() => handleOpenClaim(item)}>
              <XStack items="center" gap="$2" flex={1} style={{ minWidth: 0 }}>
                <SenderAvatar person={person} pubkey={item.senderPubkey} unseen={!item.seen} />
                <YStack gap="$0.5" mr="$2" flex={1} style={{ minWidth: 0 }}>
                  <XStack items="center" gap="$1" style={{ minWidth: 0 }}>
                    <H6 color="$color" numberOfLines={1} style={{ flexShrink: 1 }}>
                      {displayName}
                    </H6>
                    {person?.nip05Verified === true && <Nip05VerifiedBadge size={14} />}
                  </XStack>
                  {fullUsername ? (
                    <Text fontSize="$2" color="$gray10" numberOfLines={1}>
                      {fullUsername}
                    </Text>
                  ) : null}
                  <Text fontSize="$2" color="$gray9">
                    {item.type === 'request' ? 'Payment request · ' : ''}
                    {timeAgo(item.receivedAt)}
                  </Text>
                </YStack>
              </XStack>

              <YStack items="flex-end" justify="center" flexShrink={0}>
                <Text fontWeight="900" fontSize={20} color="$color">
                  {primaryAmount}
                </Text>
                {secondaryAmount ? (
                  <Text fontSize="$2" color="$gray10" fontWeight="600">
                    {secondaryAmount}
                  </Text>
                ) : null}
              </YStack>
            </RowContainer>
          );
        })}
      </YStack>

      <AppBottomSheet ref={sheetRef} snapPoints={['35%']}>
        <YStack p="$4" gap="$4" flex={1}>
          <YStack items="center" gap="$2" mb="$2">
            <Text fontSize="$5" fontWeight="800" color="$color">
              Payment Request
            </Text>
            <Text fontSize="$3" color="$gray10" textAlign="center">
              {requestDisplayName} is requesting{' '}
              {currencyService.formatSats(selectedRequest?.amount ?? 0)} from you.
            </Text>
          </YStack>
          <YStack gap="$3">
            <Button
              size="$5"
              theme="accent"
              fontWeight="800"
              icon={<ArrowUpRight size={20} />}
              onPress={handlePayRequest}
            >
              Pay Request
            </Button>
            <Button
              size="$5"
              bg="$red4"
              color="$red10"
              fontWeight="800"
              icon={<X size={20} />}
              onPress={handleDeclineRequest}
            >
              Decline
            </Button>
          </YStack>
        </YStack>
      </AppBottomSheet>
    </YStack>
  );
}
