import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { ArrowDownLeft, Landmark, ShieldCheck, User, XCircle } from '@tamagui/lucide-icons';
import { Button, Separator, Text, Theme, XStack, YStack } from 'tamagui';
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
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mintTrusted, setMintTrusted] = useState<boolean | null>(null);
  const [claimStatus, setClaimStatus] = useState<'idle' | 'claiming' | 'success' | 'error'>('idle');
  const items = useNostrInboxStore((state) => state.items);
  const dismiss = useNostrInboxStore((state) => state.dismiss);
  const biometricEnabled = useSettingsStore((state) => state.biometricEnabled);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const canPresent = !biometricEnabled || isAuthenticated;
  const activeItem = useMemo(
    () => items.find((item) => item.id === activeId) || null,
    [activeId, items],
  );

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
    void mintManager
      .isMintTrusted(activeItem.mintUrl)
      .then(setMintTrusted)
      .catch(() => setMintTrusted(false));
    const frame = requestAnimationFrame(() => sheetRef.current?.present());
    return () => cancelAnimationFrame(frame);
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
  const sender = activeItem.senderUsername || `${npub.slice(0, 10)}…${npub.slice(-6)}`;
  const mintDomain = activeItem.mintUrl.replace(/^https?:\/\//, '').split('/')[0];

  return (
    <>
      <Theme inverse>
        <AppBottomSheet
          ref={sheetRef}
          onClose={() => {
            setActiveId(null);
            setClaimStatus('idle');
          }}
          enablePanDownToClose={claimStatus !== 'claiming'}
        >
          <YStack p="$4" gap="$4" items="center">
            {claimStatus === 'success' ? (
              <>
                <Text fontSize={48} fontWeight="900" color="$color1">
                  {activeItem.amount.toLocaleString()} sats
                </Text>
                <Text color="$green10" fontSize="$5" fontWeight="800">
                  Received successfully
                </Text>
              </>
            ) : (
              <>
                <Blockies seed={npub} size={10} scale={6} style={{ borderRadius: 30 }} />
                <YStack items="center" gap="$1">
                  <Text fontSize="$3" color="$gray10">
                    Incoming Nostr payment
                  </Text>
                  <Text fontSize="$5" fontWeight="800" color="$color1">
                    {sender}
                  </Text>
                  <Text fontSize={36} fontWeight="900" color="$color1">
                    +{activeItem.amount.toLocaleString()} sats
                  </Text>
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
                    value="Nostr DM"
                  />
                </YStack>
                {mintTrusted === false && (
                  <YStack width="100%" bg="$yellow3" rounded="$4" p="$3">
                    <Text color="$yellow11" fontWeight="800">
                      Unknown mint
                    </Text>
                    <Text color="$yellow11">Only continue if you trust {mintDomain}.</Text>
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
              <Button flex={1} onPress={handleClose} disabled={claimStatus === 'claiming'}>
                {claimStatus === 'success' ? 'Done' : 'Delete'}
              </Button>
              {claimStatus !== 'success' && (
                <Button
                  flex={2}
                  bg="$green9"
                  color="white"
                  icon={<ArrowDownLeft size={18} color="white" />}
                  onPress={handleClaim}
                  disabled={claimStatus === 'claiming'}
                >
                  {mintTrusted === false ? 'Trust Mint & Claim' : 'Try Again'}
                </Button>
              )}
            </XStack>
          </YStack>
        </AppBottomSheet>
      </Theme>
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
      <Text fontWeight="700" numberOfLines={1} style={{ maxWidth: 180 }}>
        {value}
      </Text>
    </XStack>
  );
}
