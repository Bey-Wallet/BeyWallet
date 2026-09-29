import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { ArrowDownLeft, Landmark, ShieldCheck, User, XCircle } from '@tamagui/lucide-icons';
import { Button, Image, Separator, Text, View, XStack, YStack } from 'tamagui';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { nip19 } from 'nostr-tools';
import AppBottomSheet, { type AppBottomSheetRef } from '~/shared/ui/AppBottomSheet';
import Blockies from '~/shared/ui/Blockies';
import { ProcessingSheet } from '~/shared/ui/ProcessingSheet';
import { mintManager } from '~/services/wallet/mintManager';
import { nostrClaimService, type NostrClaimResult } from '~/services/wallet/nostrClaimService';
import { useAuthStore } from '~/state/authStore';
import { type NostrInboxItem, useNostrInboxStore } from '~/state/nostrInboxStore';
import { useSettingsStore } from '~/state/settingsStore';
import { nostrProfileService, type NostrProfile } from '~/services/api/nostrProfileService';
import { personUpdateFromProfile } from '~/features/people/peopleProfileCache';
import { usePeopleStore } from '~/state/peopleStore';
import { bitcoinService } from '~/services/api/bitcoinService';
import { currencyService, type CurrencyCode } from '~/services/wallet/currencyService';
import Nip05VerifiedBadge from '~/shared/icons/Nip05VerifiedBadge';

function safeNpub(pubkey: string): string {
  if (!pubkey) return '';
  try {
    if (pubkey.startsWith('npub1')) return pubkey;
    if (pubkey.startsWith('nprofile1')) {
      const decoded = nip19.decode(pubkey);
      return decoded.type === 'nprofile' ? nip19.npubEncode(decoded.data.pubkey) : pubkey;
    }
    return nip19.npubEncode(pubkey);
  } catch {
    return pubkey;
  }
}

export function NostrClaimSheet() {
  const sheetRef = useRef<AppBottomSheetRef>(null);
  const presented = useRef(new Set<string>());
  const insets = useSafeAreaInsets();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mintTrusted, setMintTrusted] = useState<boolean | null>(null);
  const [senderProfile, setSenderProfile] = useState<NostrProfile | null>(null);
  const [pictureFailed, setPictureFailed] = useState(false);
  const [claimStatus, setClaimStatus] = useState<'idle' | 'claiming' | 'success' | 'error'>('idle');
  const items = useNostrInboxStore((state) => state.items);
  const dismiss = useNostrInboxStore((state) => state.dismiss);
  const { biometricEnabled, primaryCurrency, secondaryCurrency } = useSettingsStore();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const canPresent = !biometricEnabled || isAuthenticated;
  const activeItem = useMemo(
    () => items.find((item) => item.id === activeId) || null,
    [activeId, items],
  );
  const { data: btcData } = useQuery({
    queryKey: ['bitcoinPrice', secondaryCurrency],
    queryFn: () => bitcoinService.fetchPrice(secondaryCurrency),
    enabled: secondaryCurrency !== 'NONE',
    staleTime: 30_000,
  });

  const present = useCallback((item: NostrInboxItem) => {
    presented.current.add(item.id);
    setActiveId(item.id);
    setClaimStatus(item.status === 'failed' ? 'error' : 'idle');
  }, []);

  useEffect(() => {
    const incoming = DeviceEventEmitter.addListener(
      'nostr:incoming',
      ({ eventId }: { eventId: string }) => {
        setTimeout(() => {
          const item = useNostrInboxStore
            .getState()
            .items.find((candidate) => candidate.id === eventId);
          if (!item || !canPresent || presented.current.has(eventId)) return;
          if (item.status === 'approval_required' || item.failure?.retryable === false)
            present(item);
        }, 100);
      },
    );
    const open = DeviceEventEmitter.addListener('nostr:openClaim', (item: NostrInboxItem) =>
      present(item),
    );
    const result = DeviceEventEmitter.addListener(
      'nostr:claim-result',
      (claimResult: NostrClaimResult) => {
        if (claimResult.eventId !== activeId) return;
        setClaimStatus(claimResult.status === 'claimed' ? 'success' : 'error');
      },
    );
    return () => {
      incoming.remove();
      open.remove();
      result.remove();
    };
  }, [activeId, canPresent, present]);

  useEffect(() => {
    if (!canPresent || activeItem) return;
    const next = items.find(
      (item) =>
        item.type !== 'request' &&
        !presented.current.has(item.id) &&
        (item.status === 'approval_required' ||
          (item.status === 'failed' && item.failure?.retryable === false)),
    );
    if (next) present(next);
  }, [activeItem, canPresent, items, present]);

  useEffect(() => {
    if (!activeItem) return;
    let cancelled = false;
    let frame: number | undefined;
    setMintTrusted(null);
    setSenderProfile(null);
    setPictureFailed(false);

    void Promise.all([
      mintManager.isMintTrusted(activeItem.mintUrl).catch(() => false),
      nostrProfileService
        .getProfile(safeNpub(activeItem.senderPubkey), { forceRefresh: true })
        .catch(() => null),
    ]).then(([trusted, profile]) => {
      if (cancelled) return;
      setMintTrusted(trusted);
      setSenderProfile(profile);
      if (profile) {
        usePeopleStore.getState().updatePerson(personUpdateFromProfile(profile));
      }
      frame = requestAnimationFrame(() => sheetRef.current?.present());
    });

    return () => {
      cancelled = true;
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  }, [activeItem]);

  const handleClaim = useCallback(async () => {
    if (!activeItem) return;
    setClaimStatus('claiming');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const result = await nostrClaimService.retry(activeItem.id, {
      trustMint: mintTrusted === false,
    });
    if (result.status === 'claimed') {
      setClaimStatus('success');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      setClaimStatus('error');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [activeItem, mintTrusted]);

  const handleClose = useCallback(() => {
    sheetRef.current?.dismiss();
    if (activeItem && claimStatus !== 'claiming' && claimStatus !== 'success')
      dismiss(activeItem.id);
    setActiveId(null);
    setClaimStatus('idle');
  }, [activeItem, claimStatus, dismiss]);

  if (!activeItem) return null;
  const npub = safeNpub(activeItem.senderPubkey);
  const storedUsername = activeItem.senderUsername
    ? activeItem.senderUsername.includes('@')
      ? activeItem.senderUsername
      : `${activeItem.senderUsername}@bey.cash`
    : undefined;
  const sender =
    (senderProfile?.nip05Verified ? senderProfile.nip05 : undefined) ||
    storedUsername ||
    `${npub.slice(0, 10)}…${npub.slice(-6)}`;
  const displayName = senderProfile?.displayName || senderProfile?.name;
  const mintDomain = activeItem.mintUrl.replace(/^https?:\/\//, '').split('/')[0];
  const satsAmount = currencyService.formatSats(activeItem.amount, { explicitSign: true });
  const fiatAmount =
    secondaryCurrency !== 'NONE' && btcData?.price
      ? `+${currencyService.formatValue(
          currencyService.convertSatsToCurrency(activeItem.amount, btcData.price),
          secondaryCurrency as CurrencyCode,
        )}`
      : null;
  const primaryAmount = primaryCurrency === 'FIAT' && fiatAmount ? fiatAmount : satsAmount;
  const secondaryAmount = primaryCurrency === 'FIAT' && fiatAmount ? satsAmount : fiatAmount;

  return (
    <>
      <AppBottomSheet
        ref={sheetRef}
        snapPoints={['85%']}
        bottomInset={insets.bottom}
        onClose={() => {
          setActiveId(null);
          setClaimStatus('idle');
        }}
        enablePanDownToClose={claimStatus !== 'claiming'}
      >
        <BottomSheetScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: Math.max(insets.bottom, 16) + 8 }}
        >
          <YStack gap="$4" items="center">
            {claimStatus === 'success' ? (
              <>
                <Text fontSize={42} fontWeight="900" color="$color">
                  {primaryAmount}
                </Text>
                {secondaryAmount && <Text color="$gray10">{secondaryAmount}</Text>}
                <Text color="$green10" fontSize="$5" fontWeight="800">
                  Received successfully
                </Text>
              </>
            ) : (
              <>
                <View
                  width={72}
                  height={72}
                  rounded="$10"
                  overflow="hidden"
                  bg="$gray4"
                  items="center"
                  justify="center"
                >
                  {senderProfile?.picture && !pictureFailed ? (
                    <Image
                      source={{ uri: senderProfile.picture }}
                      width={72}
                      height={72}
                      onError={() => setPictureFailed(true)}
                    />
                  ) : (
                    <Blockies seed={npub} size={10} scale={7.2} style={{ borderRadius: 12 }} />
                  )}
                </View>
                <YStack items="center" gap="$1">
                  <Text fontSize="$3" color="$gray10">
                    Incoming Nostr payment
                  </Text>
                  {displayName && (
                    <Text
                      fontSize="$5"
                      fontWeight="800"
                      color="$color"
                      textAlign="center"
                      numberOfLines={2}
                    >
                      {displayName}
                    </Text>
                  )}
                  <XStack items="center" justify="center" gap="$1.5" px="$2">
                    <Text
                      fontSize="$3"
                      fontWeight="700"
                      color="$gray12"
                      textAlign="center"
                      numberOfLines={2}
                    >
                      {sender}
                    </Text>
                    {senderProfile?.nip05Verified === true && <Nip05VerifiedBadge />}
                  </XStack>
                  <Text fontSize={36} fontWeight="900" color="$color">
                    {primaryAmount}
                  </Text>
                  {secondaryAmount && <Text color="$gray10">{secondaryAmount}</Text>}
                </YStack>
                <YStack width="100%" borderWidth={1} borderColor="$borderColor" rounded="$4">
                  <DetailRow icon={<User size={16} color="$gray9" />} label="From" value={sender} />
                  <Separator opacity={0.3} />
                  <DetailRow
                    icon={<Landmark size={16} color="$gray9" />}
                    label="Mint"
                    value={mintDomain}
                  />
                  <Separator opacity={0.3} />
                  <DetailRow
                    icon={<ShieldCheck size={16} color="$gray9" />}
                    label="Type"
                    value={senderProfile?.nip05Verified === true ? 'Nostr · NIP-05' : 'Nostr'}
                  />
                </YStack>
                {mintTrusted === false && (
                  <YStack width="100%" bg="$orange2" rounded="$4" p="$3">
                    <Text color="$orange10" fontWeight="800">
                      Unknown mint
                    </Text>
                    <Text color="$orange10">Only continue if you trust {mintDomain}.</Text>
                  </YStack>
                )}
                {claimStatus === 'error' && activeItem.error && (
                  <XStack width="100%" bg="$red3" rounded="$4" p="$3" gap="$2">
                    <XCircle size={18} color="$red10" />
                    <Text color="$red10" flex={1}>
                      {activeItem.error}
                    </Text>
                  </XStack>
                )}
              </>
            )}
            <XStack width="100%" gap="$3">
              <Button
                flex={1}
                size="$5"
                fontSize="$4"
                rounded="$6"
                theme="red"
                onPress={handleClose}
                disabled={claimStatus === 'claiming'}
              >
                {claimStatus === 'success' ? 'Done' : 'Delete'}
              </Button>
              {claimStatus !== 'success' && (
                <Button
                  flex={1}
                  size="$5"
                  fontSize="$4"
                  rounded="$6"
                  themeInverse
                  onPress={handleClaim}
                  disabled={claimStatus === 'claiming'}
                >
                  {mintTrusted === false ? 'Trust & Claim' : 'Try Again'}
                </Button>
              )}
            </XStack>
          </YStack>
        </BottomSheetScrollView>
      </AppBottomSheet>
      <ProcessingSheet
        visible={claimStatus === 'claiming'}
        status="processing"
        variant="nostr"
        title="Claiming..."
        amount={activeItem.amount}
        detail={`Receiving from ${sender}`}
      />
    </>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <XStack justify="space-between" items="center" px="$4" py="$3">
      <XStack gap="$2" items="center">
        {icon}
        <Text color="$gray10">{label}</Text>
      </XStack>
      <Text flex={1} ml="$3" fontWeight="700" textAlign="right" numberOfLines={2}>
        {value}
      </Text>
    </XStack>
  );
}
