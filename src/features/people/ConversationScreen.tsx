import { HeaderIconButton } from '~/shared/ui/HeaderIconButton';
import { appTypography } from '~/shared/theme/appearance';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  DeviceEventEmitter,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowDownLeft,
  X,
  ArrowUp,
  ArrowUpRight,
  Info,
  UserCheck,
  UserPlus,
  UserX,
} from '@tamagui/lucide-icons';
import { Input, ScrollView, Text, XStack, YStack } from 'tamagui';
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
import { ConversationItemCard } from './components/ConversationItemCard';
import { conversationDateLabel, conversationDayKey } from './conversationDates';
import { useWalletStore } from '~/state/walletStore';
import { hydrateSavedPerson, needsNostrProfileRefresh } from './peopleProfileCache';

export default function ConversationScreen() {
  const params = useLocalSearchParams<{ npub: string; displayName?: string; username?: string }>();
  const npub = normalizeNpub(params.npub || '');
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const person = usePeopleStore((state) => state.people[npub]);
  const inbox = useNostrInboxStore((state) => state.items);
  const revision = useMessageStore((state) => state.revision);
  const recent = useMessageStore((state) => state.recent);
  const { primaryCurrency, secondaryCurrency } = useSettingsStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [queued, setQueued] = useState<ChatMessage[]>([]);
  const [limit, setLimit] = useState(50);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [text, setText] = useState('');
  const [queueing, setQueueing] = useState(false);
  const [contentHeight, setContentHeight] = useState(44);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const contactSheet = useRef<AppBottomSheetRef>(null);
  const messageSheet = useRef<AppBottomSheetRef>(null);
  const localSequence = useRef(0);
  const scrollRef = useRef<React.ElementRef<typeof ScrollView>>(null);
  const nearBottom = useRef(true);
  const paginationLock = useRef(false);
  const userScrolling = useRef(false);
  const scrollMetrics = useRef({ height: 0, offset: 0 });
  const prependAnchor = useRef<{ height: number; offset: number } | null>(null);
  const queueLock = useRef(false);
  const currentConversation = useRef<string | null>(npub);
  const maxInputHeight = Math.ceil(22 * fontScale * 4 + 20);
  const accepted = person?.contactStatus === 'accepted';
  const blocked = person?.contactStatus === 'blocked';
  const label =
    person?.username ||
    person?.displayName ||
    params.username ||
    params.displayName ||
    `${npub.slice(0, 12)}…${npub.slice(-6)}`;

  useEffect(() => {
    currentConversation.current = npub;
    setMessages([]);
    setQueued([]);
    setText('');
    setContentHeight(44);
    setSelectedId(null);
    setLimit(50);
    setHasMore(false);
    prependAnchor.current = null;
    paginationLock.current = false;
    userScrolling.current = false;
    queueLock.current = false;
    setQueueing(false);
    nearBottom.current = true;
    if (params.npub?.startsWith('nprofile1') && npub.startsWith('npub1'))
      usePeopleStore.getState().savePerson({ npub: params.npub });
    const saved = usePeopleStore.getState().people[npub];
    if (npub.startsWith('npub1') && (!saved || needsNostrProfileRefresh(saved))) {
      if (!saved) usePeopleStore.getState().savePerson({ npub });
      void hydrateSavedPerson(npub).catch(() => undefined);
    }
    return () => {
      currentConversation.current = null;
    };
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
        setQueued((previous) =>
          previous.filter((message) => !loaded.some((saved) => saved.id === message.id)),
        );
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
    const byId = new Map([...queued, ...messages].map((message) => [message.id, message]));
    for (const message of recent) if (byId.has(message.id)) byId.set(message.id, message);
    return buildConversationActivity(
      npub,
      [...byId.values()],
      inbox,
      history as PersonHistoryEntry[],
      accepted,
      { requests, payments: requestPayments },
    );
  }, [npub, queued, messages, recent, inbox, history, accepted, requests, requestPayments]);
  const visibleActivity = activity.slice(-limit);
  const moreActivity = hasMore || activity.length > limit;
  const incomingInvitation =
    !!person?.hasIncomingActivity || activity.some((item) => item.direction === 'incoming');
  const loadOlder = () => {
    if (!moreActivity || loadingMessages || fetchingHistory || paginationLock.current) return;
    paginationLock.current = true;
    nearBottom.current = false;
    prependAnchor.current = { ...scrollMetrics.current };
    setLimit((count) => count + 50);
  };
  useEffect(() => {
    if (loadingMessages || fetchingHistory) return;
    paginationLock.current = false;
    if (!prependAnchor.current) return;
    const frame = requestAnimationFrame(() => {
      const anchor = prependAnchor.current;
      if (!anchor) return;
      scrollRef.current?.scrollTo({
        y: Math.max(0, anchor.offset + scrollMetrics.current.height - anchor.height),
        animated: false,
      });
      prependAnchor.current = null;
    });
    return () => cancelAnimationFrame(frame);
  }, [loadingMessages, fetchingHistory, activity.length]);
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
  const send = () => {
    const draft = text.trim();
    if (!draft || queueLock.current || !accepted || blocked) return;
    queueLock.current = true;
    setQueueing(true);
    setError('');
    setText('');
    setContentHeight(44);
    nearBottom.current = true;
    const optimisticId = `local-${Date.now()}-${++localSequence.current}`;
    const optimistic: ChatMessage = {
      id: optimisticId,
      conversation: npub,
      direction: 'outgoing',
      createdAt: Date.now(),
      receivedAt: Date.now(),
      text: draft,
      read: true,
      publication: 'sending',
      transport: 'nip17',
    };
    setQueued((previous) => [...previous, optimistic]);
    let saved = false;
    void nostrService
      .sendChat(npub, draft, (message) => {
        saved = true;
        if (currentConversation.current !== npub) return;
        setQueued((previous) => [...previous.filter((item) => item.id !== optimisticId), message]);
        setSelectedId((previous) =>
          previous === `m-${optimisticId}` ? `m-${message.id}` : previous,
        );
        queueLock.current = false;
        setQueueing(false);
      })
      .catch((cause) => {
        if (currentConversation.current !== npub) return;
        setError(cause instanceof Error ? cause.message : 'Message could not be sent.');
        if (!saved) {
          setQueued((previous) => previous.filter((item) => item.id !== optimisticId));
          setSelectedId((previous) => (previous === `m-${optimisticId}` ? null : previous));
          setText((current) => (current ? `${draft}\n${current}` : draft));
        }
      })
      .finally(() => {
        if (!saved && currentConversation.current === npub) {
          queueLock.current = false;
          setQueueing(false);
        }
      });
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
    selected?.message?.publication === 'failed' &&
    !blocked &&
    !['Received', 'Expired', 'Cancelled'].includes(selected.status)
  ) {
    actionLabel = 'Retry message';
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
  } else if (selected?.paymentInput && !blocked) {
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
      router.push({ pathname: '/(modals)/txn-details', params: { id: selected.history!.id } });
    };
  }

  return (
    <>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <YStack flex={1} bg="$background" pt={insets.top}>
          <XStack px="$3" py="$2" items="center" gap="$2">
            <HeaderIconButton
              accessibilityLabel="Close"
              icon={<X size={24} color="$color" />}
              onPress={() =>
                router.canGoBack() ? router.back() : router.replace('/(tabs)/people')
              }
            />
            <AppPressable
              minHeight={48}
              flex={1}
              flexDirection="row"
              items="center"
              gap="$2.5"
              accessibilityLabel={`Open profile for ${label}`}
              onPress={openContact}
            >
              <ConversationAvatar npub={npub} picture={person?.picture} />
              <Text flexShrink={1} fontFamily="$body" {...appTypography.title3} numberOfLines={1}>
                {label}
              </Text>
              {person && hasVerifiedNip05(person) && <Nip05VerifiedBadge />}
            </AppPressable>
            {accepted || blocked ? (
              <YStack
                accessibilityLabel={blocked ? 'Blocked contact' : 'Added contact'}
                accessibilityRole="image"
                p="$2"
              >
                {blocked ? (
                  <UserX size={20} color="$gray10" />
                ) : (
                  <UserCheck size={20} color="$gray10" />
                )}
              </YStack>
            ) : (
              <HeaderIconButton
                icon={UserPlus}
                accessibilityLabel="Add contact"
                onPress={() => void run(() => acceptContact(npub))}
              />
            )}
            <HeaderIconButton
              icon={Info}
              accessibilityLabel={`Contact details for ${label}`}
              onPress={openContact}
            />
          </XStack>
          <ScrollView
            ref={scrollRef}
            flex={1}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={{ padding: 16, paddingBottom: 24, flexGrow: 1 }}
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
              scrollMetrics.current = { height: contentSize.height, offset: contentOffset.y };
              nearBottom.current =
                contentSize.height - contentOffset.y - layoutMeasurement.height < 80;
              if (
                userScrolling.current &&
                contentOffset.y < 80 &&
                contentSize.height > layoutMeasurement.height + 80
              )
                loadOlder();
            }}
            scrollEventThrottle={100}
            onContentSizeChange={(_width, height) => {
              scrollMetrics.current.height = height;
              if (nearBottom.current && !prependAnchor.current)
                scrollRef.current?.scrollToEnd({ animated: false });
            }}
          >
            <YStack flexGrow={1} justify="flex-end">
              {moreActivity && (
                <AppButton
                  variant="default"
                  emphasis="tertiary"
                  disabled={loadingMessages || !!fetchingHistory}
                  loading={loadingMessages || !!fetchingHistory}
                  onPress={loadOlder}
                >
                  Older messages
                </AppButton>
              )}
              {visibleActivity.map((item, index) => (
                <YStack
                  key={item.id}
                  mt={
                    index === 0
                      ? 0
                      : visibleActivity[index - 1].direction === item.direction
                        ? 6
                        : 14
                  }
                >
                  {(index === 0 ||
                    conversationDayKey(visibleActivity[index - 1].time) !==
                      conversationDayKey(item.time)) && (
                    <YStack
                      self="center"
                      bg="$buttonDefaultSecondary"
                      rounded={20}
                      px="$3"
                      py="$1"
                      my="$3"
                    >
                      <Text fontSize="$2" color="$gray10">
                        {conversationDateLabel(item.time)}
                      </Text>
                    </YStack>
                  )}
                  <ConversationItemCard
                    item={item}
                    {...amounts(item.amount)}
                    onPress={() => openDetails(item)}
                    onPay={isPayableRequest(item) ? () => reviewRequest(item) : undefined}
                    payDisabled={!accepted || blocked}
                  />
                </YStack>
              ))}
              {!activity.length && (
                <YStack flex={1} items="center" justify="center" gap="$3" p="$5">
                  <ConversationAvatar npub={npub} picture={person?.picture} size={72} />
                  <Text fontSize="$6" fontWeight="700" textAlign="center">
                    {label}
                  </Text>
                  <Text color="$gray10" textAlign="center">
                    Start a conversation or send a payment.
                  </Text>
                </YStack>
              )}
            </YStack>
          </ScrollView>
          <YStack
            px="$4"
            pt="$2"
            pb={Math.max(insets.bottom, 12)}
            gap="$2"
            borderTopWidth={1}
            borderColor="$gray4"
          >
            <XStack gap="$2" self="flex-end" mt={-24} mb="$1">
              <AppButton
                size="small"
                variant="default"
                emphasis="secondary"
                icon={ArrowDownLeft}
                disabled={blocked || !accepted}
                onPress={() =>
                  router.push({
                    pathname: '/(modals)/receive',
                    params: { from: npub, username: label },
                  })
                }
              >
                Request
              </AppButton>
              <AppButton
                size="small"
                variant="branded"
                emphasis="secondary"
                icon={ArrowUpRight}
                accessibilityLabel="Send money"
                disabled={blocked || !accepted}
                onPress={() =>
                  router.push({
                    pathname: '/(modals)/send',
                    params: { to: npub, username: label, mode: 'nostr' },
                  })
                }
              >
                Pay
              </AppButton>
            </XStack>
            {!!error && (
              <Text accessibilityRole="alert" color="$buttonWarningSecondaryText" fontSize="$3">
                {error}
              </Text>
            )}
            {accepted ? (
              <XStack gap="$2" items="flex-end">
                <Input
                  flex={1}
                  multiline
                  maxLength={16000}
                  accessibilityLabel="Message"
                  placeholder="Message"
                  value={text}
                  onChangeText={(value) => {
                    setText(value);
                    if (!value) setContentHeight(44);
                  }}
                  height={Math.max(44, Math.min(contentHeight, maxInputHeight))}
                  maxHeight={maxInputHeight}
                  bg="$buttonDefaultSecondary"
                  borderWidth={0}
                  rounded={16}
                  px="$3"
                  py={10}
                  fontSize={16}
                  lineHeight={22}
                  textAlignVertical="top"
                  scrollEnabled={contentHeight > maxInputHeight}
                  onContentSizeChange={(event) =>
                    setContentHeight(Math.ceil(event.nativeEvent.contentSize.height))
                  }
                  blurOnSubmit={false}
                />
                <AppIconButton
                  variant="branded"
                  emphasis="primary"
                  size="small"
                  shape="circular"
                  mb={2}
                  accessibilityLabel="Send message"
                  icon={({ color }) => <ArrowUp size={20} color={color} />}
                  loading={queueing}
                  loadingText="Sending message"
                  disabled={!text.trim() || queueing || blocked}
                  onPress={send}
                />
              </XStack>
            ) : blocked ? (
              <Text color="$gray10">
                Blocked. Manage blocked people in Settings → Security & privacy to accept this
                person again.
              </Text>
            ) : !incomingInvitation ? (
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
                  Accept this person to receive messages and eligible payments. Mint approval is
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
    </>
  );
}
