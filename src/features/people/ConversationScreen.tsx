import { BUIHeader } from '~/shared/ui/BUI/BUIHeader';
import { HeaderIconButton } from '~/shared/ui/HeaderIconButton';
import { useFeedbackOwner } from '~/shared/hooks/useFeedbackOwner';
import { appSpacing, appTypography } from '~/shared/theme/appearance';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, DeviceEventEmitter, Keyboard } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowDown, ArrowLeft, UserPlus } from '@tamagui/lucide-icons';
import { LegendList, type LegendListRef } from '@legendapp/list/react-native';
import { Text, XStack, YStack } from 'tamagui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { AppButton } from '~/shared/ui/AppButton';
import { AppIconButton } from '~/shared/ui/AppIconButton';
import { AppPressable } from '~/shared/ui/AppPressable';
import Nip05VerifiedBadge from '~/shared/icons/Nip05VerifiedBadge';
import { hasVerifiedNip05 } from './nip05';
import type { AppBottomSheetRef } from '~/shared/ui/AppBottomSheet';
import { usePeopleStore } from '~/state/peopleStore';
import { useNostrInboxStore } from '~/state/nostrInboxStore';
import { useMessageStore } from '~/state/messageStore';
import { useSettingsStore } from '~/state/settingsStore';
import { normalizeNpub } from '~/shared/utils/nostr';
import { acceptContact } from '~/services/wallet/contactPolicy';
import { nostrService } from '~/services/wallet/nostrService';
import { initService } from '~/services/wallet/initService';
import { historyService } from '~/services/wallet/historyService';
import { bitcoinService } from '~/services/api/bitcoinService';
import { currencyService, type CurrencyCode } from '~/services/wallet/currencyService';
import { filterPersonHistory, type PersonHistoryEntry } from './personHistory';
import type { ChatMessage } from '~/storage/sqlite/repositories/MessageRepository';
import { buildConversationActivity, type ConversationActivity } from './conversationActivity';
import { useNostrRequestStore } from '~/state/nostrRequestStore';
import { ConversationAvatar } from './components/ConversationAvatar';
import { ConversationContactSheet } from './components/ConversationContactSheet';
import { ConversationMessageSheet } from './components/ConversationMessageSheet';
import { ConversationMessageActions } from './components/ConversationMessageActions';
import { ConversationItemCard } from './components/ConversationItemCard';
import { conversationDateLabel } from './conversationDates';
import { conversationItemLayout } from './conversationGrouping';
import { useWalletStore } from '~/state/walletStore';
import { hydrateSavedPerson, needsNostrProfileRefresh } from './peopleProfileCache';
import { ConversationPaymentActions } from './components/ConversationPaymentActions';

export default function ConversationScreen() {
  const params = useLocalSearchParams<{ npub: string; displayName?: string; username?: string }>();
  const npub = normalizeNpub(params.npub || '');
  useFeedbackOwner(npub);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const person = usePeopleStore((state) => state.people[npub]);
  const inbox = useNostrInboxStore((state) => state.items);
  const revision = useMessageStore((state) => state.revision);
  const recent = useMessageStore((state) => state.recent);
  const { primaryCurrency, secondaryCurrency } = useSettingsStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [limit, setLimit] = useState(50);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const contactSheet = useRef<AppBottomSheetRef>(null);
  const messageSheet = useRef<AppBottomSheetRef>(null);
  const messageActions = useRef<AppBottomSheetRef>(null);
  const scrollRef = useRef<LegendListRef>(null);
  const nearBottom = useRef(true);
  const paginationLock = useRef(false);
  const userScrolling = useRef(false);
  const [awayFromBottom, setAwayFromBottom] = useState(false);
  const [newActivity, setNewActivity] = useState(false);
  const latestId = useRef<string | undefined>(undefined);
  const accepted = person?.contactStatus === 'accepted';
  const blocked = person?.contactStatus === 'blocked';
  const label =
    person?.username ||
    person?.displayName ||
    params.username ||
    params.displayName ||
    `${npub.slice(0, 12)}…${npub.slice(-6)}`;

  useEffect(() => {
    setMessages([]);
    setSelectedId(null);
    setLimit(50);
    setHasMore(false);
    setAwayFromBottom(false);
    setNewActivity(false);
    latestId.current = undefined;
    paginationLock.current = false;
    userScrolling.current = false;
    nearBottom.current = true;
    if (params.npub?.startsWith('nprofile1') && npub.startsWith('npub1'))
      usePeopleStore.getState().savePerson({ npub: params.npub });
    const saved = usePeopleStore.getState().people[npub];
    if (npub.startsWith('npub1') && (!saved || needsNostrProfileRefresh(saved))) {
      if (!saved) usePeopleStore.getState().savePerson({ npub });
      void hydrateSavedPerson(npub).catch(() => undefined);
    }
  }, [npub, params.npub]);

  const { data: history = [], isFetching: fetchingHistory } = useQuery({
    queryKey: [
      'history',
      'conversation',
      npub,
      limit,
      inbox.filter((item) => item.status === 'claimed').length,
    ],
    queryFn: async () => {
      const matches: PersonHistoryEntry[] = [];
      for (let offset = 0; ; offset += 100) {
        const page = await historyService.getHistory(100, offset);
        matches.push(...filterPersonHistory(page as PersonHistoryEntry[], npub));
        if (matches.length > limit || page.length < 100) break;
      }
      return matches;
    },
    placeholderData: (previous) => previous,
  });
  const { data: price } = useQuery({
    queryKey: ['bitcoinPrice', secondaryCurrency],
    queryFn: () => bitcoinService.fetchPrice(secondaryCurrency),
    enabled: secondaryCurrency !== 'NONE',
    staleTime: 30_000,
  });

  useEffect(() => {
    let active = true;
    setLoadingMessages(true);
    void (async () => {
      try {
        const repo = initService.getRepo().messageRepository;
        const loaded: ChatMessage[] = [];
        let page: ChatMessage[] = [];
        for (let offset = 0; offset < limit; offset += 50) {
          page = await repo.page(npub, offset);
          loaded.push(...page);
          if (page.length < 50) break;
        }
        if (!active) return;
        setMessages(loaded);
        setHasMore(page.length === 50);
        await repo.markRead(npub);
        if (useMessageStore.getState().unread[npub]) await useMessageStore.getState().refresh();
      } catch {
        if (active) setError('Conversation storage is unavailable. Reopen your wallet.');
      } finally {
        if (active) setLoadingMessages(false);
      }
    })();
    for (const item of inbox)
      if (normalizeNpub(item.senderPubkey) === npub && !item.seen)
        useNostrInboxStore.getState().markSeen(item.id);
    return () => {
      active = false;
    };
  }, [npub, revision, limit, inbox]);

  const requests = useNostrRequestStore((state) => state.requests);
  const requestPayments = useNostrRequestStore((state) => state.payments);
  const activity = useMemo(() => {
    const byId = new Map(messages.map((message) => [message.id, message]));
    for (const message of recent) if (byId.has(message.id)) byId.set(message.id, message);
    return buildConversationActivity(
      npub,
      [...byId.values()],
      inbox,
      history as PersonHistoryEntry[],
      accepted,
      { requests, payments: requestPayments },
    );
  }, [npub, messages, recent, inbox, history, accepted, requests, requestPayments]);
  const visibleActivity = activity.slice(-limit);
  const moreActivity = hasMore || activity.length > limit;
  const incomingInvitation =
    !!person?.hasIncomingActivity || activity.some((item) => item.direction === 'incoming');
  const loadOlder = () => {
    if (!moreActivity || loadingMessages || fetchingHistory || paginationLock.current) return;
    paginationLock.current = true;
    nearBottom.current = false;
    setLimit((count) => count + 50);
  };
  useEffect(() => {
    if (loadingMessages || fetchingHistory) return;
    paginationLock.current = false;
  }, [loadingMessages, fetchingHistory]);
  useEffect(() => {
    const latest = activity.at(-1)?.id;
    if (latestId.current && latest && latest !== latestId.current && !nearBottom.current)
      setNewActivity(true);
    latestId.current = latest;
  }, [activity]);
  const selected = activity.find((item) => item.id === selectedId) || null;
  const amounts = (amount?: number) => {
    if (typeof amount !== 'number' || !Number.isFinite(amount)) return {};
    const sats = currencyService.formatSats(amount);
    const fiat =
      secondaryCurrency !== 'NONE' && price?.price
        ? currencyService.formatValue(
            currencyService.convertSatsToCurrency(amount, price.price),
            secondaryCurrency as CurrencyCode,
          )
        : null;
    return {
      primaryAmount: primaryCurrency === 'FIAT' && fiat ? fiat : sats,
      secondaryAmount:
        primaryCurrency === 'FIAT' && fiat
          ? sats
          : fiat || (secondaryCurrency !== 'NONE' ? `${secondaryCurrency} rate unavailable` : null),
    };
  };
  const run = async (action: () => Promise<void>) => {
    setError('');
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Please try again.');
    }
  };
  const openDetails = (item: ConversationActivity) => {
    Keyboard.dismiss();
    setSelectedId(item.id);
    requestAnimationFrame(() => messageSheet.current?.present());
  };
  const openContact = () => {
    Keyboard.dismiss();
    contactSheet.current?.present();
  };
  const reviewRequest = (item: ConversationActivity) => {
    if (!accepted || blocked) return;
    if (item.requestPayment) return;
    if (item.payment?.type === 'request') {
      router.push({
        pathname: '/(modals)/send',
        params: { paymentRequest: item.payment.tokenString, inboxItemId: item.payment.id },
      });
      return;
    }
    const input = item.paymentInput;
    if (!input?.route || input.error) return;
    if (input.route === 'lightning' || input.route === 'onchain') {
      useWalletStore.getState().setScannerResult(input.value);
      router.push(input.route === 'onchain' ? '/(modals)/melt?mode=onchain' : '/(modals)/melt');
    } else if (input.route === 'cashu_request') {
      router.push({ pathname: '/(modals)/send', params: { paymentRequest: input.value } });
    } else {
      router.push({ pathname: '/(modals)/receive', params: { scannedToken: input.value } });
    }
  };
  const isPayableRequest = (item: ConversationActivity) =>
    !item.requestPayment &&
    item.direction === 'incoming' &&
    ((item.payment?.type === 'request' &&
      !['claimed', 'dismissed', 'claiming'].includes(item.payment.status)) ||
      (!!item.paymentInput?.route &&
        item.paymentInput.route !== 'cashu_token' &&
        !item.paymentInput.error));
  let actionLabel: string | undefined;
  let onAction: (() => void) | undefined;
  if (
    selected?.requestPayment &&
    !blocked &&
    selected.requestPayment.state === 'pending' &&
    !selected.requestPayment.published &&
    selected.requestPayment.publication
  ) {
    actionLabel = 'Retry delivery';
    onAction = () =>
      void run(async () => {
        const { retryRequestPayment } = await import('~/services/wallet/requestLifecycleService');
        await retryRequestPayment(selected.requestPayment!.id);
      });
  } else if (
    selected?.kind === 'payment' &&
    selected.message?.publication === 'failed' &&
    !blocked &&
    !['Received', 'Expired', 'Cancelled'].includes(selected.status)
  ) {
    actionLabel = 'Retry delivery';
    onAction = () => void run(() => nostrService.retryChat(selected.message!));
  } else if (
    selected?.payment &&
    !blocked &&
    !selected.requestPayment &&
    selected.payment.status !== 'claimed' &&
    selected.payment.status !== 'dismissed'
  ) {
    const payment = selected.payment;
    actionLabel = !accepted
      ? 'Accept contact'
      : payment.type === 'request'
        ? 'Pay request'
        : payment.status === 'approval_required'
          ? 'Review mint approval'
          : 'Review payment';
    onAction = () => {
      if (!accepted) {
        void run(() => acceptContact(npub));
        return;
      }
      messageSheet.current?.dismiss();
      if (payment.type === 'request') reviewRequest(selected);
      else DeviceEventEmitter.emit('nostr:openClaim', payment);
    };
  } else if (selected?.paymentInput && selected.direction === 'incoming' && !blocked) {
    const input = selected.paymentInput;
    if (!accepted) {
      actionLabel = 'Add contact';
      onAction = () => void run(() => acceptContact(npub));
    } else if (input.route && !input.error) {
      actionLabel = 'Review payment';
      onAction = () => {
        messageSheet.current?.dismiss();
        reviewRequest(selected);
      };
    }
  } else if (selected?.history) {
    actionLabel = 'View transaction';
    onAction = () => {
      messageSheet.current?.dismiss();
      router.push({ pathname: '/txn-details', params: { id: selected.history!.id } });
    };
  }

  return (
    <>
      <YStack flex={1} bg="$background" pt={insets.top}>
        <BUIHeader
          title={label}
          navigation="none"
          leading={
            <HeaderIconButton
              accessibilityLabel="Back"
              icon={ArrowLeft}
              onPress={() =>
                router.canGoBack() ? router.back() : router.replace('/(tabs)/people')
              }
            />
          }
          titleContent={
            <AppPressable
              minHeight={48}
              width="100%"
              minWidth={0}
              items="center"
              justify="center"
              accessibilityRole="button"
              accessibilityLabel={`Open profile for ${label}`}
              onPress={openContact}
            >
              <YStack width="100%" minWidth={0} gap={2} items="center">
                <XStack items="center" justify="center" gap={5} minWidth={0} maxWidth="100%">
                  <Text
                    {...appTypography.label1}
                    fontWeight="600"
                    color="$color"
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    flexShrink={1}
                    textAlign="center"
                  >
                    {label}
                  </Text>
                  {person && hasVerifiedNip05(person) && <Nip05VerifiedBadge size={14} />}
                </XStack>
                <Text
                  {...appTypography.body3}
                  color="$gray10"
                  numberOfLines={1}
                  ellipsizeMode="middle"
                  textAlign="center"
                  width="100%"
                  accessibilityLabel={npub}
                >
                  {`${npub.slice(0, 10)}…${npub.slice(-4)}`}
                </Text>
              </YStack>
            </AppPressable>
          }
          actions={
            <AppPressable
              accessibilityLabel={`Contact details for ${label}`}
              accessibilityRole="button"
              width={48}
              height={48}
              minHeight={48}
              items="center"
              justify="center"
              rounded={24}
              onPress={openContact}
            >
              <ConversationAvatar npub={npub} picture={person?.picture} size={32} />
            </AppPressable>
          }
        />
        <YStack flex={1}>
          <LegendList
            key={npub}
            testID="conversation-timeline"
            data={visibleActivity}
            keyExtractor={(item) => item.id}
            estimatedItemSize={180}
            alignItemsAtEnd
            initialScrollAtEnd
            maintainVisibleContentPosition
            maintainScrollAtEnd
            maintainScrollAtEndThreshold={0.15}
            ref={scrollRef}
            style={{ flex: 1 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={{ padding: 16, paddingBottom: 24, flexGrow: 1 }}
            onLayout={() => {
              if (nearBottom.current && !paginationLock.current)
                scrollRef.current?.scrollToEnd({ animated: false });
            }}
            onScrollBeginDrag={() => {
              userScrolling.current = true;
            }}
            onScrollEndDrag={() => {
              userScrolling.current = false;
            }}
            onMomentumScrollBegin={() => {
              userScrolling.current = true;
            }}
            onMomentumScrollEnd={() => {
              userScrolling.current = false;
            }}
            onScroll={(event) => {
              const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
              nearBottom.current =
                contentSize.height - contentOffset.y - layoutMeasurement.height < 80;
              setAwayFromBottom(!nearBottom.current);
              if (nearBottom.current) setNewActivity(false);
              if (
                userScrolling.current &&
                contentOffset.y < 80 &&
                contentSize.height > layoutMeasurement.height + 80
              )
                loadOlder();
            }}
            scrollEventThrottle={100}
            onContentSizeChange={() => {
              if (nearBottom.current && !paginationLock.current)
                scrollRef.current?.scrollToEnd({ animated: false });
            }}
            ListHeaderComponent={
              moreActivity ? (
                <AppButton
                  variant="default"
                  emphasis="ghost"
                  disabled={loadingMessages || !!fetchingHistory}
                  loading={loadingMessages || !!fetchingHistory}
                  onPress={loadOlder}
                >
                  Older activity
                </AppButton>
              ) : null
            }
            renderItem={({ item, index }) => {
              const layout = conversationItemLayout(visibleActivity, index);
              return (
                <YStack key={item.id} mt={layout.spacing}>
                  {layout.showDate && (
                    <YStack self="center" py={appSpacing.compact} my={appSpacing.gap}>
                      <Text {...appTypography.body3} color="$gray10">
                        {conversationDateLabel(item.time)}
                      </Text>
                    </YStack>
                  )}
                  <ConversationItemCard
                    item={item}
                    {...amounts(item.amount)}
                    onPress={() => openDetails(item)}
                    onLongPress={() => {
                      Keyboard.dismiss();
                      setSelectedId(item.id);
                      requestAnimationFrame(() => messageActions.current?.present());
                    }}
                    onPay={isPayableRequest(item) ? () => reviewRequest(item) : undefined}
                    payDisabled={!accepted || blocked}
                  />
                  {layout.showTime && (
                    <Text
                      self={item.direction === 'outgoing' ? 'flex-end' : 'flex-start'}
                      fontSize={11}
                      lineHeight={14}
                      color="$gray10"
                      mt={4}
                      mx={4}
                    >
                      {new Date(item.time).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  )}
                </YStack>
              );
            }}
            ListEmptyComponent={
              <YStack flex={1} items="center" justify="center" gap="$3" p="$5">
                <ConversationAvatar npub={npub} picture={person?.picture} size={72} />
                <Text fontSize="$6" fontWeight="700" textAlign="center">
                  {label}
                </Text>
                <Text color="$gray10" textAlign="center">
                  Pay or request ecash. Your payments with this person appear here.
                </Text>
              </YStack>
            }
          />
          {awayFromBottom && (
            <YStack
              position="absolute"
              bottom={16}
              right={16}
              zIndex={10}
              bg="$buttonDefaultSecondary"
              rounded={999}
              overflow="hidden"
              elevation={4}
            >
              <AppIconButton
                variant="default"
                emphasis="secondary"
                shape="circular"
                size="medium"
                icon={({ color }) => <ArrowDown size={22} color={color} />}
                accessibilityLabel="Jump to latest activity"
                accessibilityHint={newActivity ? 'New activity available' : undefined}
                onPress={() => {
                  nearBottom.current = true;
                  setAwayFromBottom(false);
                  setNewActivity(false);
                  scrollRef.current?.scrollToEnd({ animated: true });
                }}
              />
            </YStack>
          )}
        </YStack>
        <YStack
          px={appSpacing.page}
          pt={appSpacing.gap}
          pb={Math.max(insets.bottom, appSpacing.gap)}
          gap={appSpacing.compact}
          bg="$background"
        >
          <ConversationPaymentActions
            key={npub}
            disabled={blocked || !accepted}
            onPay={() => {
              if (!accepted || blocked) return;
              router.push({
                pathname: '/(modals)/send',
                params: { to: npub, username: label, mode: 'nostr' },
              });
            }}
            onRequest={() => {
              if (!accepted || blocked) return;
              router.push({
                pathname: '/(modals)/receive',
                params: { from: npub, username: label },
              });
            }}
          />
          {!!error && (
            <Text accessibilityRole="alert" color="$buttonWarningSecondaryText" fontSize="$3">
              {error}
            </Text>
          )}
          {blocked ? (
            <Text color="$gray10">
              Blocked. Manage blocked people in Settings → Security & privacy to accept this person
              again.
            </Text>
          ) : accepted ? null : !incomingInvitation ? (
            <AppButton
              variant="default"
              emphasis="secondary"
              icon={UserPlus}
              onPress={() => void run(() => acceptContact(npub))}
            >
              Add contact
            </AppButton>
          ) : (
            <YStack gap="$2">
              <Text color="$gray10" fontSize="$3">
                Accept this person to receive eligible payments. Mint approval is separate.
              </Text>
              <XStack gap="$2">
                <AppButton
                  flex={1}
                  variant="warning"
                  emphasis="secondary"
                  onPress={() => void run(() => acceptContact(npub))}
                >
                  Accept
                </AppButton>
                <AppButton
                  flex={1}
                  variant="critical"
                  emphasis="secondary"
                  onPress={() =>
                    Alert.alert(
                      'Reject and block?',
                      'Payments stay unclaimed. You can unblock in Nostr Settings.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Reject and block',
                          style: 'destructive',
                          onPress: () =>
                            usePeopleStore.getState().setContactStatus(npub, 'blocked'),
                        },
                      ],
                    )
                  }
                >
                  Reject and block
                </AppButton>
              </XStack>
            </YStack>
          )}
        </YStack>
      </YStack>

      <ConversationContactSheet
        ref={contactSheet}
        npub={npub}
        label={label}
        bottomInset={insets.bottom}
      />
      <ConversationMessageSheet
        ref={messageSheet}
        item={selected}
        {...amounts(selected?.amount)}
        bottomInset={insets.bottom}
        actionLabel={actionLabel}
        onAction={onAction}
      />
      <ConversationMessageActions
        ref={messageActions}
        item={selected}
        primaryAmount={amounts(selected?.amount).primaryAmount}
        bottomInset={insets.bottom}
        onClose={() => messageActions.current?.dismiss()}
        onDetails={() => {
          messageActions.current?.dismiss();
          if (selected) openDetails(selected);
        }}
        retryLabel={actionLabel?.startsWith('Retry') ? actionLabel : undefined}
        onRetry={actionLabel?.startsWith('Retry') ? onAction : undefined}
      />
    </>
  );
}
