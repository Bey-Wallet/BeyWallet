import { BUIHeader } from '~/shared/ui/BUI/BUIHeader';
import { HeaderIconButton } from '~/shared/ui/HeaderIconButton';
import { AppInput } from '~/shared/ui/AppInput';
import { useFeedbackOwner } from '~/shared/hooks/useFeedbackOwner';
import { appSpacing, appTypography } from '~/shared/theme/appearance';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, DeviceEventEmitter, Keyboard, useWindowDimensions } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowDown, ArrowLeft, ArrowUp, UserPlus } from '@tamagui/lucide-icons';
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
import {
  conversationPaymentSettled,
  filterPersonHistory,
  type PersonHistoryEntry,
} from './personHistory';
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
import { getHistoryToken } from '~/features/history/historyToken';
import { conversationPaymentInput } from './conversationPaymentInput';
import { useConversationMessages } from './hooks/useConversationMessages';
import { useConversationPaymentStatus } from './hooks/useConversationPaymentStatus';

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
  const draft = useMessageStore((state) => state.drafts[npub] || '');
  const session = useMessageStore((state) => state.session);
  const { fontScale } = useWindowDimensions();
  const [contentHeight, setContentHeight] = useState(48);
  const maxInputHeight = Math.ceil(20 * fontScale * 4 + 20);
  const [queueing, setQueueing] = useState(false);
  const queueLock = useRef(false);
  const conversationGeneration = useRef(0);
  const [queued, setQueued] = useState<ChatMessage[]>([]);
  const { primaryCurrency, secondaryCurrency } = useSettingsStore();
  const messageQuery = useConversationMessages(npub, session, revision);
  const messages = messageQuery.messages;
  const loadingMessages = messageQuery.isFetching;
  const [limit, setLimit] = useState(50);
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
    conversationGeneration.current++;
    setQueued([]);
    setQueueing(false);
    queueLock.current = false;
    setContentHeight(48);
    setError('');
    setSelectedId(null);
    setLimit(50);
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
    return () => {
      conversationGeneration.current++;
    };
  }, [npub, params.npub, session]);

  const { data: history = [], isFetching: fetchingHistory } = useQuery({
    queryKey: [
      'history',
      'conversation',
      npub,
      session,
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
    void (async () => {
      try {
        const repo = initService.getRepo().messageRepository;
        if (!active) return;
        await repo.markRead(npub);
        if (useMessageStore.getState().unread[npub]) await useMessageStore.getState().refresh();
      } catch {
        if (active) setError('Conversation storage is unavailable. Reopen your wallet.');
      }
    })();
    for (const item of inbox)
      if (normalizeNpub(item.senderPubkey) === npub && !item.seen)
        useNostrInboxStore.getState().markSeen(item.id);
    return () => {
      active = false;
    };
  }, [npub, revision, inbox, session]);

  useEffect(() => {
    setQueued((previous) =>
      previous.filter((message) => !messages.some((saved) => saved.id === message.id)),
    );
  }, [messages]);

  const requests = useNostrRequestStore((state) => state.requests);
  const requestPayments = useNostrRequestStore((state) => state.payments);
  const baseActivity = useMemo(() => {
    const byId = new Map([...queued, ...messages].map((message) => [message.id, message]));
    for (const message of recent) if (byId.has(message.id)) byId.set(message.id, message);
    return buildConversationActivity(
      npub,
      [...byId.values()],
      inbox,
      history as PersonHistoryEntry[],
      accepted,
      { requests, payments: requestPayments },
    ).map((item) => {
      if (!item.history || item.note?.trim() || (!accepted && item.direction !== 'outgoing'))
        return item;
      const entry = item.history;
      const payload = entry.paymentRequest
        ? conversationPaymentInput(entry.paymentRequest)?.value
        : entry.mintUrl && (entry.type === 'send' || entry.type === 'receive')
          ? getHistoryToken({ ...entry, mintUrl: entry.mintUrl })
          : undefined;
      return payload ? { ...item, payloadPreview: payload } : item;
    });
  }, [npub, queued, messages, recent, inbox, history, accepted, requests, requestPayments]);
  const paymentStatuses = useConversationPaymentStatus(
    npub,
    session,
    baseActivity.slice(-limit),
    history,
  );
  const activity = useMemo(
    () =>
      baseActivity.map((item) =>
        paymentStatuses[item.id] && !conversationPaymentSettled(item.status)
          ? { ...item, status: paymentStatuses[item.id], requiresAction: false }
          : item,
      ),
    [baseActivity, paymentStatuses],
  );
  const visibleActivity = activity.slice(-limit);
  const moreActivity = messageQuery.hasNextPage || activity.length > limit;
  const incomingInvitation =
    !!person?.hasIncomingActivity || activity.some((item) => item.direction === 'incoming');
  const loadOlder = () => {
    if (!moreActivity || loadingMessages || fetchingHistory || paginationLock.current) return;
    paginationLock.current = true;
    nearBottom.current = false;
    if (messageQuery.hasNextPage) void messageQuery.fetchNextPage({ cancelRefetch: false });
    setLimit((count) => count + 50);
  };
  useEffect(() => {
    if (loadingMessages || fetchingHistory) return;
    paginationLock.current = false;
  }, [loadingMessages, fetchingHistory, limit]);
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
  const send = () => {
    const text = draft.trim();
    if (!text || text.length > 16000 || queueLock.current || !accepted || blocked) return;
    if (
      session !== useMessageStore.getState().session ||
      draft !== (useMessageStore.getState().drafts[npub] || '')
    )
      return;
    // Recheck contact state at the action boundary, including stale press handlers.
    if (usePeopleStore.getState().people[npub]?.contactStatus !== 'accepted') return;
    const generation = conversationGeneration.current;
    const current = () =>
      generation === conversationGeneration.current &&
      session === useMessageStore.getState().session;
    queueLock.current = true;
    setQueueing(true);
    setError('');
    let saved = false;
    void nostrService
      .sendChat(npub, text, (message) => {
        saved = true;
        if (
          session === useMessageStore.getState().session &&
          useMessageStore.getState().drafts[npub] === draft
        )
          useMessageStore.getState().setDraft(npub, '');
        if (!current()) return;
        // Clear only after persistence succeeds. Unsent text survives preparation failures.
        setQueued((previous) => [...previous.filter((item) => item.id !== message.id), message]);
        setContentHeight(48);
        nearBottom.current = true;
        queueLock.current = false;
        setQueueing(false);
      })
      .catch(() => {
        if (current())
          setError(
            'Message could not be sent. If it appears as Failed, retry it from message actions. Otherwise your draft is still here.',
          );
      })
      .finally(() => {
        if (!saved && current()) {
          queueLock.current = false;
          setQueueing(false);
        }
      });
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
    selected?.message?.publication === 'failed' &&
    !blocked &&
    (selected.kind === 'payment' || accepted) &&
    !['Received', 'Expired', 'Cancelled'].includes(selected.status)
  ) {
    actionLabel = selected.kind === 'text' ? 'Retry message' : 'Retry delivery';
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
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
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
                    {messageQuery.isPending
                      ? 'Loading messages…'
                      : 'Send a message, pay, or request ecash. Your shared activity appears here.'}
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
                  params: { to: npub, username: label, mode: 'nostr', returnToConversation: '1' },
                });
              }}
              onRequest={() => {
                if (!accepted || blocked) return;
                router.push({
                  pathname: '/(modals)/mint',
                  params: { requestTo: npub, requestName: label },
                });
              }}
            />
            {accepted && !blocked && (
              <>
                {person?.chatTransport === 'nip04' && (
                  <Text color="$gray10" fontSize={11}>
                    Legacy messaging (NIP-04) · Sender, recipient and time are public
                  </Text>
                )}
                <XStack gap={appSpacing.gap} items="flex-end">
                  <AppInput
                    key={npub}
                    flex={1}
                    multiline
                    maxLength={16000}
                    accessibilityLabel="Message"
                    placeholder="Message"
                    value={draft}
                    editable={!queueing}
                    onChangeText={(value) => {
                      if (session !== useMessageStore.getState().session) return;
                      useMessageStore.getState().setDraft(npub, value);
                      if (!value) setContentHeight(48);
                    }}
                    height={Math.max(48, Math.min(contentHeight, maxInputHeight))}
                    maxHeight={maxInputHeight}
                    bg="$gray2"
                    borderWidth={0}
                    rounded="$6"
                    px="$3"
                    py={10}
                    fontSize={14}
                    lineHeight={20}
                    textAlignVertical="top"
                    scrollEnabled={contentHeight > maxInputHeight}
                    onContentSizeChange={(event) =>
                      setContentHeight(Math.ceil(event.nativeEvent.contentSize.height))
                    }
                    blurOnSubmit={false}
                  />
                  <AppIconButton
                    variant="default"
                    emphasis="primary"
                    size="medium"
                    shape="circular"
                    accessibilityLabel="Send message"
                    icon={({ color }) => <ArrowUp size={22} color={color} />}
                    loading={queueing}
                    loadingText="Saving message"
                    disabled={!draft.trim() || queueing}
                    onPress={send}
                  />
                </XStack>
              </>
            )}
            {!!error && (
              <Text accessibilityRole="alert" color="$buttonWarningSecondaryText" fontSize="$3">
                {error}
              </Text>
            )}
            {messageQuery.isError && (
              <YStack gap="$2">
                <Text accessibilityRole="alert" color="$gray10" fontSize={13}>
                  Messages could not be loaded. Your current activity is still available.
                </Text>
                <AppButton
                  size="small"
                  emphasis="secondary"
                  disabled={messageQuery.isFetching}
                  onPress={() => {
                    if (messageQuery.isFetchNextPageError)
                      void messageQuery.fetchNextPage({ cancelRefetch: false });
                    else void messageQuery.refetch();
                  }}
                >
                  Retry loading messages
                </AppButton>
              </YStack>
            )}
            {blocked ? (
              <Text color="$gray10">
                Blocked. Manage blocked people in Settings → Privacy & security to accept this
                person again.
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
                  Accept this person to chat and receive eligible payments. Mint approval is
                  separate.
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
      </KeyboardAvoidingView>

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
