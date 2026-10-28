import { AppInput as Input } from '~/shared/ui/AppInput';
import { Spinner } from '~/shared/ui/Spinner';
import { LegendList, type LegendListRef } from '@legendapp/list/react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  DeviceEventEmitter,
  Keyboard,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, X } from '@tamagui/lucide-icons';
import { Text, XStack, YStack } from 'tamagui';
import { AppIconButton } from '~/shared/ui/AppIconButton';
import { AppButton } from '~/shared/ui/AppButton';
import { AppPressable } from '~/shared/ui/AppPressable';
import { normalizeNpub } from '~/shared/utils/nostr';
import { usePeopleStore } from '~/state/peopleStore';
import { useNostrInboxStore } from '~/state/nostrInboxStore';
import { usePeopleList } from './hooks/usePeopleList';
import { usePeopleUnreadCounts } from './hooks/usePeopleUnreadCounts';
import { useReducedMotion } from '~/shared/hooks/useReducedMotion';
import { UnreadBadge } from '~/shared/ui/UnreadBadge';
import { PeopleListRow } from './components/PeopleListRow';
import { peopleListEntries, type PeopleListEntry, type PeopleListItem } from './peopleListModel';

type PeopleView = 'recents' | 'requests';
type ListMode = PeopleView | 'search';

const SEARCH_HINTS = ['Search by name', 'Search by address', 'Search by public key'];

function PeopleSearchPlaceholder({ reducedMotion }: { reducedMotion: boolean }) {
  const [hint, setHint] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;
  useFocusEffect(
    useCallback(() => {
      if (reducedMotion) {
        progress.setValue(0);
        return;
      }
      let active = true;
      const timer = setInterval(() => {
        Animated.timing(progress, {
          toValue: -1,
          duration: 180,
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (!finished || !active) return;
          setHint((previous) => (previous + 1) % SEARCH_HINTS.length);
          progress.setValue(1);
          Animated.timing(progress, {
            toValue: 0,
            duration: 220,
            useNativeDriver: true,
          }).start();
        });
      }, 3200);
      return () => {
        active = false;
        clearInterval(timer);
        progress.stopAnimation();
        progress.setValue(0);
      };
    }, [progress, reducedMotion]),
  );
  return (
    <Animated.View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        justifyContent: 'center',
        opacity: progress.interpolate({ inputRange: [-1, 0, 1], outputRange: [0, 1, 0] }),
        transform: [
          { translateY: progress.interpolate({ inputRange: [-1, 0, 1], outputRange: [-8, 0, 8] }) },
        ],
      }}
    >
      <Text fontSize={16} fontWeight="400" color="$gray10" numberOfLines={1}>
        {SEARCH_HINTS[hint]}
      </Text>
    </Animated.View>
  );
}

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
  const { width } = useWindowDimensions();
  const pager = useRef<ScrollView>(null);
  const reducedMotion = useReducedMotion();
  const unread = usePeopleUnreadCounts();
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [activeView, setActiveView] = useState<PeopleView>('recents');
  const [limits, setLimits] = useState({ recents: 50, requests: 50, search: 50 });
  const [now, setNow] = useState(() => new Date());
  const input = useRef<React.ElementRef<typeof Input>>(null);
  const offsets = useRef({ recents: 0, requests: 0, search: 0 });
  const model = usePeopleList(search);
  const searching = !!search.trim();
  useEffect(() => {
    if (!searching)
      pager.current?.scrollTo({ x: activeView === 'requests' ? width : 0, animated: false });
  }, [width, searching]);
  const selectView = (view: PeopleView) => {
    setActiveView(view);
    pager.current?.scrollTo({
      x: view === 'requests' ? width : 0,
      animated: !reducedMotion,
    });
  };
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
  const renderList = (mode: ListMode) => {
    const isSearch = mode === 'search';
    const groups = isSearch
      ? [
          { title: 'On this wallet', items: model.localSearch },
          { title: 'Other people', items: model.remoteSearch },
        ]
      : mode === 'recents'
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
    const empty =
      isSearch && model.isSearching ? null : (
        <YStack px="$4" py="$8" items="center" gap="$2">
          <Text fontSize={17} fontWeight="600" textAlign="center">
            {isSearch
              ? 'No people found'
              : mode === 'recents'
                ? 'No conversations yet'
                : 'No requests'}
          </Text>
          <Text fontSize={14} color="$gray10" textAlign="center">
            {isSearch
              ? 'Try a name, address, or public key.'
              : mode === 'recents'
                ? 'Find someone to start a conversation.'
                : 'Contact requests and payments needing attention appear here.'}
          </Text>
          {!isSearch && mode === 'recents' && (
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
      <PeopleVirtualList
        key={isSearch ? `search-${search.trim()}` : mode}
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
            {isSearch && model.isSearching && (
              <XStack items="center" justify="center" gap="$2">
                <Spinner size="small" />
                <Text color="$gray10" fontSize={13}>
                  Searching…
                </Text>
              </XStack>
            )}
            {isSearch && !!model.searchError && (
              <YStack gap="$2">
                <Text color="$gray10" accessibilityRole="alert" fontSize={13}>
                  Search is unavailable. Your saved people are still available.
                </Text>
                <AppButton
                  size="small"
                  variant="default"
                  emphasis="ghost"
                  onPress={model.retrySearch}
                >
                  Retry search
                </AppButton>
              </YStack>
            )}
            {total > limits[mode] && (
              <AppButton size="small" variant="default" emphasis="ghost" onPress={loadMore}>
                Load more
              </AppButton>
            )}
          </YStack>
        }
      />
    );
  };
  return (
    <YStack flex={1} bg="$background" pt={insets.top}>
      <YStack px="$4" pt="$2" gap="$2">
        <XStack
          minHeight={52}
          bg="$buttonDefaultSecondary"
          rounded={16}
          px="$3"
          items="center"
          gap="$2"
        >
          <Search size={18} color="$gray10" />
          <YStack flex={1} minWidth={0} height={52} justify="center">
            <Input
              ref={input}
              height={52}
              borderWidth={0}
              bg="transparent"
              px={0}
              fontSize={16}
              fontWeight="400"
              placeholder={searchFocused ? 'Search people' : ''}
              placeholderTextColor="$gray10"
              accessibilityLabel="Search people"
              accessibilityHint="Search by name, address, or public key"
              value={search}
              onChangeText={changeSearch}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              onSubmitEditing={Keyboard.dismiss}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {!search.length && !searchFocused && (
              <PeopleSearchPlaceholder reducedMotion={reducedMotion} />
            )}
          </YStack>
          {searching && (
            <AppIconButton
              variant="default"
              emphasis="ghost"
              size="xxsmall"
              accessibilityLabel="Clear search"
              icon={X}
              onPress={() => changeSearch('')}
            />
          )}
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
                accessibilityLabel={`${view === 'recents' ? 'Recent' : 'Requests'}, ${unread[view]} unread conversations`}
                accessibilityState={{ selected: activeView === view }}
                borderBottomWidth={2}
                borderColor={activeView === view ? '$color' : 'transparent'}
                onPress={() => selectView(view)}
              >
                <Text
                  fontSize={14}
                  fontWeight={activeView === view ? '600' : '400'}
                  color={activeView === view ? '$color' : '$gray10'}
                >
                  {view === 'recents' ? 'Recent' : 'Requests'}
                </Text>
                <UnreadBadge count={unread[view]} />
              </AppPressable>
            ))}
          </XStack>
        )}
        {!!model.activityError && (
          <Text accessibilityRole="alert" fontSize={13} color="$gray10">
            {model.activityError}
          </Text>
        )}
      </YStack>
      {searching ? (
        renderList('search')
      ) : (
        <ScrollView
          ref={pager}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          onMomentumScrollEnd={(event) => {
            setActiveView(event.nativeEvent.contentOffset.x >= width / 2 ? 'requests' : 'recents');
          }}
          style={{ flex: 1 }}
        >
          {(['recents', 'requests'] as const).map((view) => (
            <YStack
              key={view}
              width={width}
              flexShrink={0}
              pt="$3"
              height="100%"
              accessibilityElementsHidden={activeView !== view}
              importantForAccessibility={activeView === view ? 'auto' : 'no-hide-descendants'}
            >
              {renderList(view)}
            </YStack>
          ))}
        </ScrollView>
      )}
    </YStack>
  );
}
