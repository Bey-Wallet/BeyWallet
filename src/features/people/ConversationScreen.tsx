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
import { ArrowDownLeft, ArrowLeft, ArrowUp, ArrowUpRight } from '@tamagui/lucide-icons';
import { Input, ScrollView, Text, XStack, YStack } from 'tamagui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { AppButton } from '~/shared/ui/AppButton';
import { AppIconButton } from '~/shared/ui/AppIconButton';
import { AppPressable } from '~/shared/ui/AppPressable';
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
import type { PersonHistoryEntry } from './personHistory';
import type { ChatMessage } from '~/storage/sqlite/repositories/MessageRepository';
import { buildConversationActivity, type ConversationActivity } from './conversationActivity';
import { ConversationAvatar } from './components/ConversationAvatar';
import { ConversationContactSheet } from './components/ConversationContactSheet';
import { ConversationMessageSheet } from './components/ConversationMessageSheet';
import { ConversationItemCard } from './components/ConversationItemCard';
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
  const [text, setText] = useState('');
  const [queueing, setQueueing] = useState(false);
  const [contentHeight, setContentHeight] = useState(44);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const contactSheet = useRef<AppBottomSheetRef>(null);
  const messageSheet = useRef<AppBottomSheetRef>(null);
  const scrollRef = useRef<React.ElementRef<typeof ScrollView>>(null);
  const nearBottom = useRef(true);
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

  const { data: history = [] } = useQuery({
    queryKey: [
      'history',
      'conversation',
      npub,
      inbox.filter((item) => item.status === 'claimed').length,
    ],
    queryFn: () => historyService.getHistory(500, 0),
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
      }
    })();
    for (const item of inbox)
      if (normalizeNpub(item.senderPubkey) === npub && !item.seen)
        useNostrInboxStore.getState().markSeen(item.id);
    return () => {
      active = false;
    };
  }, [npub, revision, limit, inbox]);

  const activity = useMemo(() => {
    const byId = new Map([...queued, ...messages].map((message) => [message.id, message]));
    for (const message of recent) if (byId.has(message.id)) byId.set(message.id, message);
    return buildConversationActivity(
      npub,
      [...byId.values()],
      inbox,
      history as PersonHistoryEntry[],
      accepted,
    );
  }, [npub, queued, messages, recent, inbox, history, accepted]);
  const selected = activity.find((item) => item.id === selectedId) || null;
  const amounts = (amount?: number) => {
    if (amount === undefined) return {};
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
    if (!draft || queueLock.current) return;
    queueLock.current = true;
    setQueueing(true);
    setError('');
    setText('');
    setContentHeight(44);
    nearBottom.current = true;
    let saved = false;
    void nostrService
      .sendChat(npub, draft, (message) => {
        saved = true;
        if (currentConversation.current !== npub) return;
        setQueued((previous) => [...previous, message]);
        queueLock.current = false;
        setQueueing(false);
      })
      .catch((cause) => {
        if (currentConversation.current !== npub) return;
        setError(cause instanceof Error ? cause.message : 'Message could not be sent.');
        if (!saved) setText((current) => current || draft);
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
  let actionLabel: string | undefined;
  let onAction: (() => void) | undefined;
  if (selected?.message?.publication === 'failed' && !blocked) {
    actionLabel = 'Retry message';
    onAction = () => void run(() => nostrService.retryChat(selected.message!));
  } else if (
    selected?.payment &&
    !blocked &&
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
      if (payment.type === 'request')
        router.push({
          pathname: '/(modals)/send',
          params: { paymentRequest: payment.tokenString, inboxItemId: payment.id },
        });
      else DeviceEventEmitter.emit('nostr:openClaim', payment);
    };
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
          <XStack
            px="$3"
            py="$2"
            items="center"
            gap="$2"
            borderBottomWidth={1}
            borderColor="$gray4"
          >
            <AppIconButton
              variant="default"
              emphasis="secondary"
              accessibilityLabel="Back"
              icon={ArrowLeft}
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
              accessibilityLabel={`Contact details for ${label}`}
              onPress={() => {
                Keyboard.dismiss();
                contactSheet.current?.present();
              }}
            >
              <ConversationAvatar npub={npub} picture={person?.picture} />
              <Text flex={1} fontSize="$5" fontWeight="800" numberOfLines={1}>
                {label}
              </Text>
            </AppPressable>
            <YStack
              bg={accepted ? '$buttonDefaultSecondary' : '$buttonWarningSecondary'}
              px="$2.5"
              py="$1.5"
              rounded="$12"
              flexShrink={0}
            >
              <Text
                fontSize="$2"
                color={accepted ? '$buttonDefaultSecondaryText' : '$buttonWarningSecondaryText'}
              >
                {blocked ? 'Blocked' : accepted ? 'Added' : 'Not added'}
              </Text>
            </YStack>
          </XStack>
          <ScrollView
            ref={scrollRef}
            flex={1}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={{ padding: 12, paddingBottom: 20 }}
            onScroll={(event) => {
              const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
              nearBottom.current =
                contentSize.height - contentOffset.y - layoutMeasurement.height < 80;
            }}
            scrollEventThrottle={100}
            onContentSizeChange={() => {
              if (nearBottom.current) scrollRef.current?.scrollToEnd({ animated: false });
            }}
          >
            <YStack gap="$1">
              {hasMore && (
                <AppButton
                  variant="default"
                  emphasis="tertiary"
                  onPress={() => {
                    nearBottom.current = false;
                    setLimit((count) => count + 50);
                  }}
                >
                  Older messages
                </AppButton>
              )}
              {activity.map((item) => (
                <ConversationItemCard
                  key={item.id}
                  item={item}
                  {...amounts(item.amount)}
                  onPress={() => openDetails(item)}
                />
              ))}
              {!activity.length && (
                <Text p="$4" color="$gray10" textAlign="center">
                  Start a conversation or send a payment.
                </Text>
              )}
            </YStack>
          </ScrollView>
          <YStack
            px="$3"
            pt="$2"
            pb={Math.max(insets.bottom, 12)}
            gap="$2"
            borderTopWidth={1}
            borderColor="$gray4"
          >
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
                  rounded="$5"
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
                  variant="default"
                  emphasis="secondary"
                  accessibilityLabel="Send message"
                  icon={ArrowUp}
                  disabled={!text.trim() || queueing}
                  onPress={send}
                />
              </XStack>
            ) : blocked ? (
              <Text color="$gray10">
                Blocked. Unblock in Nostr Settings to accept this person again.
              </Text>
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
            <XStack gap="$2">
              <AppButton
                flex={1}
                variant="default"
                emphasis="secondary"
                icon={ArrowDownLeft}
                disabled={blocked}
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
                flex={1}
                variant="branded"
                emphasis="secondary"
                icon={ArrowUpRight}
                accessibilityLabel="Send money"
                disabled={blocked}
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
