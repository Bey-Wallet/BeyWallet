import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';

import { useToastController } from '@tamagui/toast';
import { useQuery } from '@tanstack/react-query';

import {
  Check,
  Clock3,
  Copy,
  QrCode,
  UserRound,
  WalletCards,
  XCircle,
} from '@tamagui/lucide-icons';

import { Button, Image, ScrollView, Spinner, Text, XStack, YStack } from 'tamagui';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Nip05VerifiedBadge from '~/shared/icons/Nip05VerifiedBadge';
import { hasVerifiedNip05 } from '~/features/people/nip05';

import Blockies from '~/shared/ui/Blockies';
import { CustomQRCode } from '~/shared/ui/CustomQRCode';

import { usePeopleStore } from '~/state/peopleStore';
import { useSettingsStore } from '~/state/settingsStore';

import {
  decodeNostrPublicKey,
  nostrProfileService,
  type NostrProfile,
} from '~/services/api/nostrProfileService';

import { historyService } from '~/services/wallet/historyService';
import { bitcoinService } from '~/services/api/bitcoinService';
import { currencyService, type CurrencyCode } from '~/services/wallet/currencyService';

import { personUpdateFromProfile } from '~/features/people/peopleProfileCache';

import {
  filterPersonHistory,
  getPersonPaymentStatus,
  type PersonHistoryEntry,
} from '~/features/people/personHistory';

function shortenedNpub(npub: string): string {
  return npub.length > 24 ? `${npub.slice(0, 12)}…${npub.slice(-8)}` : npub;
}

function timestampMs(value: number): number {
  return value < 10_000_000_000 ? value * 1000 : value;
}

function formatPaymentTime(createdAt: number): string {
  const date = new Date(timestampMs(Number(createdAt)));
  const today = new Date();

  const sameDay = date.toDateString() === today.toDateString();

  return sameDay
    ? date.toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
      })
    : date.toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
      });
}

function statusIcon(status: string, outgoing: boolean) {
  const color = outgoing ? '#f5f5f5' : '#737373';

  if (status === 'Failed' || status === 'Expired' || status === 'Refunded') {
    return <XCircle size={11} color={outgoing ? '#fecaca' : '#dc2626'} />;
  }

  if (status === 'Awaiting claim' || status === 'Pending') {
    return <Clock3 size={11} color={color} />;
  }

  return <Check size={11} color={color} strokeWidth={3} />;
}

export default function PersonDetailsScreen() {
  const { npub, username, displayName, nip05 } = useLocalSearchParams<{
    npub: string;
    username?: string;
    displayName?: string;
    nip05?: string;
  }>();

  const router = useRouter();
  const toast = useToastController();
  const insets = useSafeAreaInsets();

  const people = usePeopleStore((state) => state.people);
  const updatePerson = usePeopleStore((state) => state.updatePerson);
  const { primaryCurrency, secondaryCurrency } = useSettingsStore();

  const [profile, setProfile] = useState<NostrProfile | null>(null);

  const [profileLoading, setProfileLoading] = useState(true);

  const [pictureFailed, setPictureFailed] = useState(false);
  const [showNpubQr, setShowNpubQr] = useState(false);
  const historyScrollRef = useRef<React.ElementRef<typeof ScrollView>>(null);
  const didScrollToLatestRef = useRef(false);

  const savedPerson = npub ? people[npub] : undefined;

  /*
   * ------------------------------------------------------
   * Load Nostr profile
   * ------------------------------------------------------
   */

  useEffect(() => {
    if (!npub) return;

    let cancelled = false;

    setProfileLoading(true);
    setPictureFailed(false);

    const loadProfile = async () => {
      const direct = await nostrProfileService
        .getProfile(npub, {
          forceRefresh: true,
        })
        .catch(() => null);

      if (direct) return direct;

      const fallbackNip05 = nip05 || usePeopleStore.getState().people[npub]?.nip05;

      if (!fallbackNip05) {
        return null;
      }

      const expectedPubkey = decodeNostrPublicKey(npub);

      const matches = await nostrProfileService.search(fallbackNip05).catch(() => []);

      return matches.find((candidate) => candidate.pubkeyHex === expectedPubkey) || null;
    };

    void loadProfile().then((value) => {
      if (value) {
        updatePerson(personUpdateFromProfile(value));
      }

      if (!cancelled) {
        setProfile(value);
        setProfileLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [nip05, npub, updatePerson]);

  /*
   * ------------------------------------------------------
   * Payment history
   * ------------------------------------------------------
   */

  const { data: history = [], isLoading: historyLoading } = useQuery({
    queryKey: ['history', 'person', npub],

    queryFn: () => historyService.getHistory(500, 0),

    enabled: !!npub,
  });

  const isFiatEnabled = secondaryCurrency !== 'NONE';
  const { data: btcData } = useQuery({
    queryKey: ['bitcoinPrice', secondaryCurrency],
    queryFn: () => bitcoinService.fetchPrice(secondaryCurrency),
    staleTime: 30_000,
    enabled: isFiatEnabled,
  });

  const payments = useMemo(
    () => filterPersonHistory(history as PersonHistoryEntry[], npub || ''),
    [history, npub],
  );

  useEffect(() => {
    didScrollToLatestRef.current = false;
  }, [npub]);

  const scrollToLatestPayment = useCallback(() => {
    if (historyLoading || !payments.length || didScrollToLatestRef.current) return;

    didScrollToLatestRef.current = true;
    requestAnimationFrame(() => {
      historyScrollRef.current?.scrollToEnd({ animated: false });
    });
  }, [historyLoading, payments.length]);

  if (!npub) {
    return <Text p="$4">Invalid person</Text>;
  }

  /*
   * ------------------------------------------------------
   * Resolved profile
   * ------------------------------------------------------
   */

  const resolvedDisplayName =
    profile?.displayName ||
    profile?.name ||
    savedPerson?.displayName ||
    displayName ||
    savedPerson?.username ||
    username ||
    'Nostr user';

  const resolvedNip05 = profile?.nip05 || savedPerson?.nip05 || nip05;
  const nip05Verified = hasVerifiedNip05({
    nip05: resolvedNip05,
    nip05Verified: profile?.nip05
      ? profile.nip05Verified === true
      : savedPerson?.nip05
        ? savedPerson.nip05Verified === true
        : false,
  });

  const picture = pictureFailed ? undefined : profile?.picture || savedPerson?.picture || undefined;

  /*
   * ------------------------------------------------------
   * Actions
   * ------------------------------------------------------
   */

  const copyNpub = async () => {
    await Clipboard.setStringAsync(npub);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    toast.show('Copied npub to clipboard');
  };

  const toggleNpubQr = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowNpubQr((visible) => !visible);
  };

  const pay = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    router.push({
      pathname: '/(modals)/send',

      params: {
        to: npub,

        username: resolvedNip05 || resolvedDisplayName,

        mode: 'nostr',
      },
    });
  };

  const request = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    router.push({
      pathname: '/(modals)/receive',

      params: {
        from: npub,

        username: resolvedNip05 || resolvedDisplayName,
      },
    });
  };

  const openPayment = (entry: PersonHistoryEntry) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    router.push({
      pathname: '/(modals)/txn-details',

      params: {
        id: entry.id,
      },
    });
  };

  /*
   * ------------------------------------------------------
   * UI
   * ------------------------------------------------------
   */

  return (
    <YStack flex={1} bg="$background">
      <YStack flex={1} px="$4" gap="$4">
        {/* ------------------------------------------------
            PROFILE
        ------------------------------------------------ */}

        <YStack height={200} rounded="$6" p="$3" bg="$gray2" overflow="hidden">
          <Button
            circular
            chromeless
            size="$3"
            icon={showNpubQr ? <UserRound size={18} /> : <QrCode size={18} />}
            onPress={toggleNpubQr}
            accessibilityLabel={showNpubQr ? 'Show profile' : 'Show Nostr public key QR code'}
            style={{ position: 'absolute', top: 10, right: 10, zIndex: 2 }}
          />

          {showNpubQr ? (
            <YStack flex={1} items="center" justify="center" gap="$2">
              <YStack bg="white" rounded="$4" overflow="hidden">
                <CustomQRCode
                  value={npub}
                  size={150}
                  color="#000000"
                  backgroundColor="#ffffff"
                  dotShape="square"
                  finderStyle="rounded"
                />
              </YStack>

              <Button
                size="$2.5"
                fontSize="$2"
                rounded="$6"
                iconAfter={<Copy size={12} />}
                onPress={copyNpub}
                accessibilityLabel="Copy Nostr public key"
              >
                {shortenedNpub(npub)}
              </Button>
            </YStack>
          ) : (
            <YStack flex={1} items="flex-start" gap="$3" justify="center">
              <YStack width={72} height={72} rounded={10} overflow="hidden" bg="$gray3">
                {picture ? (
                  <Image
                    source={{ uri: picture }}
                    width={72}
                    height={72}
                    rounded={10}
                    onError={() => setPictureFailed(true)}
                  />
                ) : (
                  <Blockies seed={npub} size={12} scale={6} style={{ borderRadius: 10 }} />
                )}
              </YStack>

              <YStack gap="$2" pr="$5" width="100%" style={{ minWidth: 0 }}>
                <XStack items="center" gap="$1.5">
                  <Text fontSize="$7" fontWeight="900" numberOfLines={1} style={{ flexShrink: 1 }}>
                    {resolvedDisplayName}
                  </Text>

                  {nip05Verified && <Nip05VerifiedBadge />}
                  {profileLoading && <Spinner size="small" />}
                </XStack>

                {resolvedNip05 ? (
                  <Text color="$gray10" fontSize="$3" numberOfLines={1}>
                    {resolvedNip05}
                  </Text>
                ) : null}

                <Button
                  style={{ alignSelf: 'flex-start' }}
                  theme="gray"
                  size="$2.5"
                  fontSize="$2"
                  rounded="$4"
                  fontWeight={800}
                  iconAfter={<Copy strokeWidth={2.5} size={12} />}
                  onPress={copyNpub}
                  accessibilityLabel="Copy Nostr public key"
                >
                  {shortenedNpub(npub)}
                </Button>
              </YStack>
            </YStack>
          )}
        </YStack>

        {/* ------------------------------------------------
            PAYMENT CONVERSATION
        ------------------------------------------------ */}

        <YStack flex={1} gap="$3">
          <Text fontSize="$3" fontWeight="800" color="$gray10">
            PAYMENT HISTORY
          </Text>

          <ScrollView
            ref={historyScrollRef}
            flex={1}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={scrollToLatestPayment}
          >
            <YStack pb="$4">
              {historyLoading ? (
                <YStack items="center" py="$8">
                  <Spinner size="large" />
                </YStack>
              ) : payments.length ? (
                <YStack gap="$2.5">
                  {payments.map((entry) => {
                    const outgoing = entry.type === 'send';

                    const status = getPersonPaymentStatus(entry);

                    const satsAmount = currencyService.formatSats(entry.amount);
                    const fiatAmount =
                      isFiatEnabled && btcData?.price
                        ? currencyService.formatValue(
                            currencyService.convertSatsToCurrency(entry.amount, btcData.price),
                            secondaryCurrency as CurrencyCode,
                          )
                        : null;
                    const showFiatFirst = primaryCurrency === 'FIAT' && !!fiatAmount;
                    const primaryAmount = showFiatFirst ? fiatAmount : satsAmount;
                    const secondaryAmount = showFiatFirst ? satsAmount : fiatAmount;

                    return (
                      <XStack key={entry.id} justify={outgoing ? 'flex-end' : 'flex-start'}>
                        <Button
                          unstyled

                          style={{
                            maxWidth: '82%',
                          }}

                          onPress={() => openPayment(entry)}

                          pressStyle={{
                            opacity: 0.8,
                            scale: 0.99,
                          }}

                          accessibilityLabel={`${
                            outgoing ? 'Sent' : 'Received'
                          } ${entry.amount} sats, ${status}`}
                        >
                          {/* RADAR-STYLE PAYMENT CARD */}

                          <YStack
                            bg={outgoing ? '$color' : '$gray3'}

                            style={{ minWidth: 160, maxWidth: 240 }}

                            rounded="$6"

                            overflow="hidden"
                          >
                            {/* Main payment information */}

                            <YStack px="$3" pt="$2.5" minH={100} justify="space-between" pb="$2.5">
                              {/* Direction */}

                              <Text
                                fontSize={11}
                                fontWeight="600"

                                color={outgoing ? '$background' : '$gray10'}

                                opacity={0.75}
                              >
                                {outgoing ? 'Sent ↗' : '↙ Received'}
                              </Text>

                              {/* Amount */}

                              <XStack items="baseline" mt="$1">
                                <Text
                                  fontSize={24}
                                  lineHeight={27}
                                  fontWeight="800"

                                  color={outgoing ? '$background' : '$color'}

                                  letterSpacing={-0.5}
                                >
                                  {primaryAmount}
                                </Text>
                              </XStack>

                              {/* Secondary currency + time + status */}

                              <XStack justify="space-between" items="center" gap="$2" mt="$1">
                                {secondaryAmount ? (
                                  <Text
                                    fontSize={11}
                                    fontWeight="600"
                                    color={outgoing ? '$background' : '$gray10'}
                                    opacity={outgoing ? 0.72 : 1}
                                  >
                                    {secondaryAmount}
                                  </Text>
                                ) : (
                                  <XStack />
                                )}

                                <XStack items="center" gap="$1">
                                  <Text
                                    fontSize={10}
                                    color={outgoing ? '$background' : '$gray9'}
                                    opacity={outgoing ? 0.65 : 1}
                                  >
                                    {formatPaymentTime(entry.createdAt)}
                                  </Text>

                                  {statusIcon(status, outgoing)}
                                </XStack>
                              </XStack>
                            </YStack>
                          </YStack>
                        </Button>
                      </XStack>
                    );
                  })}
                </YStack>
              ) : (
                /*
                 * ----------------------------------------------
                 * EMPTY STATE
                 * ----------------------------------------------
                 */

                <YStack items="center" gap="$2" py="$8" px="$5">
                  <YStack
                    width={52}
                    height={52}
                    rounded={26}
                    bg="$gray3"
                    items="center"
                    justify="center"
                  >
                    <WalletCards size={23} color="#737373" />
                  </YStack>

                  <Text fontSize="$5" fontWeight="800">
                    No payments yet
                  </Text>

                  <Text
                    color="$gray9"
                    fontSize="$3"

                    style={{
                      textAlign: 'center',
                    }}
                  >
                    Payments with {resolvedDisplayName} will appear here like a conversation.
                  </Text>
                </YStack>
              )}
            </YStack>
          </ScrollView>
        </YStack>
      </YStack>

      {/* ----------------------------------------------------
          BOTTOM ACTIONS
      ---------------------------------------------------- */}

      <XStack
        justify="flex-end"
        gap="$2"

        px="$4"
        pt="$3"

        pb={Math.max(insets.bottom, 12)}

        bg="transparent"
      >
        <Button size="$5" rounded="$6" bg="$gray3" onPress={request}>
          Request
        </Button>

        <Button
          size="$5"
          rounded="$6"

          bg="$color"
          color="$background"

          fontWeight="900"

          onPress={pay}
        >
          Send
        </Button>
      </XStack>
    </YStack>
  );
}
