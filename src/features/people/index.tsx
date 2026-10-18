import { Spinner } from '~/shared/ui/Spinner';
import { LegendList, type LegendListRef } from '@legendapp/list/react-native';
import React, { useCallback, useRef, useState } from 'react';
import { DeviceEventEmitter, Keyboard } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ClipboardPaste, Search, X } from '@tamagui/lucide-icons';
import { Input, Text, XStack, YStack } from 'tamagui';
import * as Clipboard from 'expo-clipboard';
import { AppIconButton } from '~/shared/ui/AppIconButton';
import { AppButton } from '~/shared/ui/AppButton';
import { AppPressable } from '~/shared/ui/AppPressable';
import { normalizeNpub } from '~/shared/utils/nostr';
import { usePeopleStore } from '~/state/peopleStore';
import { useNostrInboxStore } from '~/state/nostrInboxStore';
import { usePeopleList } from './hooks/usePeopleList';
import { PeopleListRow } from './components/PeopleListRow';
import { peopleListEntries, type PeopleListEntry, type PeopleListItem } from './peopleListModel';

type PeopleView = 'recents' | 'requests';
type ListMode = PeopleView | 'search';

function PeopleVirtualList({
  data,
  initialOffset,
  onOffset,
  onPress,
  now,
  bottomInset,
  ...props
}: {
  data: PeopleListEntry[];
  initialOffset: number;
  onOffset: (offset: number) => void;
  onPress: (item: PeopleListItem) => void;
  now: Date;
  bottomInset: number;
  refreshing: boolean;
  onRefresh: () => void;
  onEndReached: () => void;
  ListEmptyComponent: React.ReactElement | null;
  ListFooterComponent: React.ReactElement;
}) {
  const list = useRef<LegendListRef>(null);
  const initial = useRef(initialOffset);
  const restored = useRef(false);
  return (
    <LegendList
      recycleItems={false}
      {...props}
      ref={list}
      data={data}
      initialScrollOffset={initial.current}
      keyExtractor={(item) => item.id}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
      onEndReachedThreshold={0.4}
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingBottom: bottomInset + 72,
        flexGrow: 1,
      }}
      onContentSizeChange={(_width, height) => {
        if (restored.current || !height) return;
        restored.current = true;
        list.current?.scrollToOffset({ offset: initial.current, animated: false });
      }}
      onScroll={(event) => {
        if (restored.current) onOffset(event.nativeEvent.contentOffset.y);
      }}
      scrollEventThrottle={100}
      renderItem={({ item }) =>
        item.kind === 'heading' ? (
          <Text
            accessibilityRole="header"
            fontSize={12}
            fontWeight="600"
            color="$gray10"
            pt="$4"
            pb="$1"
          >
            {item.title}
          </Text>
        ) : (
          <YStack>
            <PeopleListRow item={item} now={now} onPress={() => onPress(item)} />
            <YStack ml={60} height={0.5} bg="$borderColor" opacity={0.5} />
          </YStack>
        )
      }
    />
  );
}

export default function PeopleScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [activeView, setActiveView] = useState<PeopleView>('recents');
  const [limits, setLimits] = useState({ recents: 50, requests: 50, search: 50 });
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => new Date());
  const input = useRef<React.ElementRef<typeof Input>>(null);
  const offsets = useRef({ recents: 0, requests: 0, search: 0 });
  const model = usePeopleList(search);
  const searching = !!search.trim();
  const mode: ListMode = searching ? 'search' : activeView;
  useFocusEffect(
    useCallback(() => {
      setNow(new Date());
      const timer = setInterval(() => setNow(new Date()), 60_000);
      return () => clearInterval(timer);
    }, []),
  );
  const changeSearch = (value: string) => {
    offsets.current.search = 0;
    setLimits((previous) => ({ ...previous, search: 50 }));
    setSearch(value);
    setError('');
  };
  const groups = searching
    ? [
        { title: 'On this wallet', items: model.localSearch },
        { title: 'Other people', items: model.remoteSearch },
      ]
    : activeView === 'recents'
      ? [{ items: model.conversations }]
      : [
          { title: 'People requests', items: model.invitations },
          { title: 'Payment issues', items: model.issues },
        ];
  const total = groups.reduce((count, group) => count + group.items.length, 0);
  const loadMore = () => {
    if (total > limits[mode])
      setLimits((previous) => ({ ...previous, [mode]: previous[mode] + 50 }));
  };
  const open = (item: PeopleListItem) => {
    Keyboard.dismiss();
    if (item.kind === 'issue') {
      const payment = useNostrInboxStore
        .getState()
        .items.find((entry) => entry.id === item.issueId);
      if (
        payment &&
        usePeopleStore.getState().people[normalizeNpub(payment.senderPubkey)]?.contactStatus ===
          'accepted'
      )
        DeviceEventEmitter.emit('nostr:openClaim', payment);
      return;
    }
    if (/^nprofile1/i.test(search.trim()) && normalizeNpub(search.trim()) === item.npub)
      usePeopleStore.getState().savePerson({ npub: search.trim() });
    router.push({
      pathname: '/(modals)/conversation',
      params: {
        npub: item.npub,
        username: item.profile.name || '',
        displayName: item.profile.displayName || '',
      },
    });
  };
  const paste = async () => {
    try {
      const value = (await Clipboard.getStringAsync()).trim();
      if (value) changeSearch(value);
    } catch {
      setError('Could not read the clipboard. Try again.');
    }
  };
  const empty =
    searching && model.isSearching ? null : (
      <YStack px="$4" py="$8" items="center" gap="$2">
        <Text fontSize={17} fontWeight="600" textAlign="center">
          {searching
            ? 'No people found'
            : activeView === 'recents'
              ? 'No conversations yet'
              : 'No requests'}
        </Text>
        <Text fontSize={14} color="$gray10" textAlign="center">
          {searching
            ? 'Try a name, address, or public key.'
            : activeView === 'recents'
              ? 'Find someone to start a conversation.'
              : 'Contact requests and payments needing attention appear here.'}
        </Text>
        {!searching && activeView === 'recents' && (
          <AppButton
            size="small"
            variant="default"
            emphasis="secondary"
            onPress={() => input.current?.focus()}
          >
            Find someone
          </AppButton>
        )}
      </YStack>
    );
  return (
    <YStack flex={1} bg="$background">
      <YStack px="$4" pt="$2" gap="$2">
        <XStack
          minHeight={44}
          bg="$buttonDefaultSecondary"
          rounded={16}
          px="$3"
          items="center"
          gap="$2"
        >
          <Search size={18} color="$gray10" />
          <Input
            ref={input}
            flex={1}
            minWidth={0}
            height={44}
            borderWidth={0}
            bg="transparent"
            px={0}
            fontSize={16}
            fontWeight="400"
            placeholder="Search people"
            accessibilityLabel="Search people"
            value={search}
            onChangeText={changeSearch}
            onSubmitEditing={Keyboard.dismiss}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          <AppIconButton
            variant="default"
            emphasis="tertiary"
            size="xxsmall"
            accessibilityLabel={searching ? 'Clear search' : 'Paste identifier'}
            icon={searching ? X : ClipboardPaste}
            onPress={searching ? () => changeSearch('') : () => void paste()}
          />
        </XStack>
        {!searching && (
          <XStack>
            {(['recents', 'requests'] as const).map((view) => (
              <AppPressable
                key={view}
                flex={1}
                minHeight={48}
                flexDirection="row"
                items="center"
                justify="center"
                gap="$2"
                accessibilityRole="tab"
                accessibilityLabel={
                  view === 'recents' ? 'Recent' : `Requests, ${model.requestCount} pending`
                }
                accessibilityState={{ selected: activeView === view }}
                borderBottomWidth={2}
                borderColor={activeView === view ? '$color' : 'transparent'}
                onPress={() => setActiveView(view)}
              >
                <Text
                  fontSize={14}
                  fontWeight={activeView === view ? '600' : '400'}
                  color={activeView === view ? '$color' : '$gray10'}
                >
                  {view === 'recents' ? 'Recent' : 'Requests'}
                </Text>
                {view === 'requests' && model.requestCount > 0 && (
                  <YStack bg="$buttonWarningSecondary" rounded={10} px={6} py={2}>
                    <Text fontSize={11} color="$buttonWarningSecondaryText">
                      {model.requestCount > 99 ? '99+' : String(model.requestCount)}
                    </Text>
                  </YStack>
                )}
              </AppPressable>
            ))}
          </XStack>
        )}
        {!!(error || model.activityError) && (
          <Text accessibilityRole="alert" fontSize={13} color="$gray10">
            {error || model.activityError}
          </Text>
        )}
      </YStack>
      <PeopleVirtualList
        key={searching ? `search-${search.trim()}` : mode}
        data={peopleListEntries(groups, limits[mode])}
        initialOffset={offsets.current[mode]}
        onOffset={(offset) => {
          offsets.current[mode] = offset;
        }}
        onPress={open}
        now={now}
        bottomInset={insets.bottom}
        refreshing={model.refreshing}
        onRefresh={() => void model.refresh()}
        onEndReached={loadMore}
        ListEmptyComponent={empty}
        ListFooterComponent={
          <YStack gap="$2" py="$3">
            {searching && model.isSearching && (
              <XStack items="center" justify="center" gap="$2">
                <Spinner size="small" />
                <Text color="$gray10" fontSize={13}>
                  Searching…
                </Text>
              </XStack>
            )}
            {searching && !!model.searchError && (
              <YStack gap="$2">
                <Text color="$gray10" accessibilityRole="alert" fontSize={13}>
                  Search is unavailable. Your saved people are still available.
                </Text>
                <AppButton
                  size="small"
                  variant="default"
                  emphasis="tertiary"
                  onPress={model.retrySearch}
                >
                  Retry search
                </AppButton>
              </YStack>
            )}
            {total > limits[mode] && (
              <AppButton size="small" variant="default" emphasis="tertiary" onPress={loadMore}>
                Load more
              </AppButton>
            )}
          </YStack>
        }
      />
    </YStack>
  );
}
