import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Button,
  Input,
  Text,
  YStack,
  XStack,
  Spinner,
  Paragraph,
  View,
  useTheme,
  ScrollView,
  Separator,
} from 'tamagui';
import {
  Scan,
  ChevronLeft,
  Search,
  X,
  Plus,
  Check,
  Sprout,
  Zap,
  Bitcoin,
  Globe,
  ArrowRight,
  RefreshCw,
  ChevronDown,
  Landmark,
} from '@tamagui/lucide-icons';
import * as Haptics from 'expo-haptics';
import { RefreshControl, TouchableOpacity, Keyboard } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useWalletStore } from '~/store/walletStore';
import { useSettingsStore } from '~/store/settingsStore';
import { currencyService, CurrencyCode } from '~/services/currencyService';
import { bitcoinService } from '~/services/bitcoinService';
import {
  mintRecommendationService,
  type MintRecommendation,
} from '~/services/mintRecommendationService';
import { fetchMintMeta, type MintMetadata } from '~/screens/ExpolreTabScreen/components/mintMeta';
import { MintIcon } from '~/screens/ExpolreTabScreen/components/MintIcon';
import { RollingNumber } from '~/components/UI/RollingNumber';
import AddMintModal, { AddMintModalRef } from '~/components/AddMintModal';

// ─── Skeleton Loading Components ─────────────────────────────────────────────
interface MintSkeletonRowProps {
  progress: Animated.SharedValue<number>;
  showTopSeparator?: boolean;
}

const MintSkeletonRow = React.memo(({ progress, showTopSeparator }: MintSkeletonRowProps) => {
  const theme = useTheme();
  const bg = theme.gray4?.val ?? '#2A2A2A';

  const animStyle = useAnimatedStyle(() => {
    const opacity = interpolate(progress.value, [0, 0.5, 1], [0.35, 0.85, 0.35]);
    return { opacity };
  });

  return (
    <YStack>
      {showTopSeparator && <Separator borderColor="$borderColor" opacity={0.3} />}
      <XStack py="$3" items="center">
        {/* Left 48px circle placeholder */}
        <Animated.View
          style={[
            {
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: bg,
              marginRight: 12,
            },
            animStyle,
          ]}
        />

        {/* Middle title & hostname bars placeholder */}
        <YStack flex={1} mr="$2" gap={8} justify="center">
          <Animated.View
            style={[
              {
                width: '55%',
                height: 16,
                borderRadius: 4,
                backgroundColor: bg,
              },
              animStyle,
            ]}
          />
          <Animated.View
            style={[
              {
                width: '75%',
                height: 12,
                borderRadius: 4,
                backgroundColor: bg,
              },
              animStyle,
            ]}
          />
        </YStack>

        {/* Right action button pill placeholder */}
        <Animated.View
          style={[
            {
              width: 56,
              height: 28,
              borderRadius: 14,
              backgroundColor: bg,
            },
            animStyle,
          ]}
        />
      </XStack>
      <Separator borderColor="$borderColor" opacity={0.3} />
    </YStack>
  );
});

MintSkeletonRow.displayName = 'MintSkeletonRow';

export const MintSkeletonList = React.memo(({ count = 5 }: { count?: number }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [progress]);

  return (
    <YStack>
      {Array.from({ length: count }).map((_, i) => (
        <MintSkeletonRow key={i} progress={progress} showTopSeparator={i === 0} />
      ))}
    </YStack>
  );
});

MintSkeletonList.displayName = 'MintSkeletonList';

// ─── Small Circular Badges ───────────────────────────────────────────────────
// Small lightning badge (Zap) + additional bitcoin badge (Bitcoin) for NUT-30 mints
interface BadgesProps {
  supportsNut30?: boolean;
}

const MintBadges = React.memo(({ supportsNut30 }: BadgesProps) => {
  return (
    <XStack gap="$1.5" items="center">
      {/* Small circular Lightning badge */}
      <View
        width={18}
        height={18}
        rounded={100}

        borderWidth={1}
        borderColor="rgba(127, 127, 127, 0.35)"
        items="center"
        justify="center"
      >
        <Zap size={10} color="#858585ff" fill="#848484ff" />
      </View>

      {/* Additional small circular Bitcoin badge for NUT-30 supported mints */}
      {supportsNut30 && (
        <View
          width={18}
          height={18}
          rounded={100}

          borderWidth={1}
          borderColor="rgba(122, 122, 122, 0.35)"
          items="center"
          justify="center"
        >
          <Bitcoin size={10} color="#7f7f7fff" />
        </View>
      )}
    </XStack>
  );
});

MintBadges.displayName = 'MintBadges';

// ─── Connected Mint Row Component (UI matching HistoryItem) ─────────────────
interface ConnectedMintRowProps {
  mint: any;
  balance: number;
  isActive: boolean;
  hideBalance: boolean;
  displayAsSats: boolean;
  showBitcoinSymbol: boolean;
  btcPrice?: number;
  secondaryCurrency: string;
  refreshCounter: number;
  onPress: (mintUrl: string) => void;
  showTopSeparator?: boolean;
}

const ConnectedMintRow = React.memo(
  ({
    mint,
    balance,
    isActive,
    hideBalance,
    displayAsSats,
    showBitcoinSymbol,
    btcPrice,
    secondaryCurrency,
    refreshCounter,
    onPress,
    showTopSeparator,
  }: ConnectedMintRowProps) => {
    const { data: meta } = useQuery<MintMetadata>({
      queryKey: ['mint-meta', mint.mintUrl],
      queryFn: () => fetchMintMeta(mint.mintUrl),
      staleTime: 10 * 60 * 1000,
    });

    const displayName =
      mint.nickname ||
      meta?.name ||
      mint.name ||
      (() => {
        try {
          return new URL(mint.mintUrl).hostname;
        } catch {
          return mint.mintUrl;
        }
      })();

    const hostname = useMemo(() => {
      try {
        return new URL(mint.mintUrl).hostname;
      } catch {
        return mint.mintUrl;
      }
    }, [mint.mintUrl]);

    const displayValue = useMemo(() => {
      if (hideBalance) return '****';
      if (!displayAsSats) {
        if (!btcPrice) return '...';
        const fiat = currencyService.convertSatsToCurrency(balance, btcPrice);
        return currencyService.formatValue(fiat, secondaryCurrency as CurrencyCode);
      }
      return balance;
    }, [hideBalance, displayAsSats, balance, btcPrice, secondaryCurrency]);

    const prefix = useMemo(() => {
      if (hideBalance || !displayAsSats) return '';
      return showBitcoinSymbol ? '₿' : '';
    }, [hideBalance, displayAsSats, showBitcoinSymbol]);

    const suffix = useMemo(() => {
      if (hideBalance || !displayAsSats) return '';
      return showBitcoinSymbol ? '' : ' SATS';
    }, [hideBalance, displayAsSats, showBitcoinSymbol]);

    const currentTrigger = `${refreshCounter}_${mint.mintUrl}_${hideBalance ? 'hidden' : 'visible'}_${displayAsSats ? 'SATS' : 'FIAT'}_${showBitcoinSymbol}`;

    return (
      <YStack>
        {showTopSeparator && <Separator borderColor="$borderColor" opacity={0.3} />}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => onPress(mint.mintUrl)}
          style={{ paddingVertical: 12, flexDirection: 'row', alignItems: 'center' }}
        >
          {/* Left: 48px Circular icon */}
          <View mr="$3">
            <MintIcon url={mint.mintUrl} hintIcon={mint.icon} size={48} />
          </View>

          {/* Middle: title + badges + URL */}
          <YStack flex={1} mr="$2" justify="center" gap={3}>
            <XStack items="center" gap="$2" flexWrap="nowrap">
              <Text
                fontSize="$4"
                fontWeight="700"
                color="$color"
                numberOfLines={1}
                style={{ maxWidth: '70%' }}
              >
                {displayName}
              </Text>
              <MintBadges supportsNut30={meta?.supportsNut30} />
            </XStack>

            <Text fontSize="$2" color="$gray10" numberOfLines={1}>
              {hostname}
            </Text>
          </YStack>

          {/* Right: Balance */}
          <YStack items="flex-end" justify="center">
            <RollingNumber
              fontSize={16}
              fontWeight="800"
              color="$color"
              decimalOpacity={0.4}
              showDecimals={!displayAsSats}
              prefix={prefix}
              suffix={suffix}
              trigger={currentTrigger}
            >
              {displayValue}
            </RollingNumber>
          </YStack>
        </TouchableOpacity>
        <Separator borderColor="$borderColor" opacity={0.3} />
      </YStack>
    );
  },
);

ConnectedMintRow.displayName = 'ConnectedMintRow';

// ─── Discovered Mint Row Component (UI matching HistoryItem) ─────────────────
interface DiscoveredMintRowProps {
  mint: MintRecommendation;
  isAdded: boolean;
  onPress: (url: string) => void;
  onAdd: (url: string) => void;
  showTopSeparator?: boolean;
}

const DiscoveredMintRow = React.memo(
  ({ mint, isAdded, onPress, onAdd, showTopSeparator }: DiscoveredMintRowProps) => {
    const { data: meta } = useQuery<MintMetadata>({
      queryKey: ['mint-meta', mint.url],
      queryFn: () => fetchMintMeta(mint.url),
      staleTime: 10 * 60 * 1000,
    });

    const displayName =
      meta?.name ||
      mint.name ||
      (() => {
        try {
          return new URL(mint.url).hostname;
        } catch {
          return mint.url;
        }
      })();

    const hostname = useMemo(() => {
      try {
        return new URL(mint.url).hostname;
      } catch {
        return mint.url;
      }
    }, [mint.url]);

    return (
      <YStack>
        {showTopSeparator && <Separator borderColor="$borderColor" opacity={0.3} />}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => onPress(mint.url)}
          style={{ paddingVertical: 12, flexDirection: 'row', alignItems: 'center' }}
        >
          {/* Left: 48px Circular icon */}
          <View mr="$3">
            <MintIcon url={mint.url} hintIcon={mint.icon} size={48} />
          </View>

          {/* Middle: Title + badges + URL */}
          <YStack flex={1} mr="$2" justify="center" gap={3}>
            <XStack items="center" gap="$2" flexWrap="nowrap">
              <Text
                fontSize="$4"
                fontWeight="700"
                color="$color"
                numberOfLines={1}
                style={{ maxWidth: '70%' }}
              >
                {displayName}
              </Text>
              <MintBadges supportsNut30={meta?.supportsNut30} />
            </XStack>

            <Text fontSize="$2" color="$gray10" numberOfLines={1}>
              {hostname}
            </Text>
          </YStack>

          {/* Right: Add button or Added status */}
          <View>
            {isAdded ? (
              <XStack rounded="$10" items="center" gap="$1" px="$2">
                <Check size={12} color="$accent4" strokeWidth={3} />
                <Text fontSize="$2" fontWeight="700" color="$accent4">
                  Added
                </Text>
              </XStack>
            ) : (
              <Button
                size="$3.5"
                theme="gray"
                rounded="$10"
                px="$3"
                icon={<Plus size={16} strokeWidth={2.5} />}
                pressStyle={{ scale: 0.95 }}
                onPress={(e) => {
                  e.stopPropagation();
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onAdd(mint.url);
                }}
              >
                <Text fontSize="$2" fontWeight="700">
                  Add
                </Text>
              </Button>
            )}
          </View>
        </TouchableOpacity>
        <Separator borderColor="$borderColor" opacity={0.3} />
      </YStack>
    );
  },
);

DiscoveredMintRow.displayName = 'DiscoveredMintRow';

// ─── Main AddMintScreen ─────────────────────────────────────────────────────
export default function AddMintScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const addMintRef = useRef<AddMintModalRef>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const {
    mints: walletMints,
    balances,
    activeMintUrl,
    refreshCounter,
    refreshMintList,
    refreshBalance,
    scannerResult,
    setScannerResult,
    isInitializing,
  } = useWalletStore();

  const { primaryCurrency, secondaryCurrency, hideBalance, showBitcoinSymbol } = useSettingsStore();

  const isFiatEnabled = secondaryCurrency !== 'NONE';
  const displayAsSats = primaryCurrency === 'SATS' || !isFiatEnabled;

  // Fiat price query
  const { data: btcData } = useQuery({
    queryKey: ['bitcoinPrice', secondaryCurrency],
    queryFn: () =>
      isFiatEnabled ? bitcoinService.fetchPrice(secondaryCurrency) : Promise.resolve({ price: 0 }),
    staleTime: 30000,
    enabled: isFiatEnabled,
  });

  // ─── Discover Mints via NIP-87 & Nostr relays (Cached) ─────────────────────
  const {
    data: allDiscoveredMints = [],
    isLoading: isDiscoverLoading,
    isError: isDiscoverError,
    refetch: refetchDiscover,
  } = useQuery<MintRecommendation[]>({
    queryKey: ['all-mint-recommendations'],
    queryFn: async () => {
      return await mintRecommendationService.discoverMints(100);
    },
    staleTime: 5 * 60 * 1000, // 5 min cache
  });

  // Pull-to-refresh handler
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Promise.all([refetchDiscover(), refreshMintList(), refreshBalance()]);
    } finally {
      setRefreshing(false);
    }
  }, [refetchDiscover, refreshMintList, refreshBalance]);

  // ─── Smart URL Detection & Processing ──────────────────────────────────────
  const cleanQuery = searchQuery.trim();

  // Smart detect: Does it contain a dot (domain) or start with http?
  const isDetectedAsUrl = useMemo(() => {
    if (!cleanQuery) return false;
    const hasDot = cleanQuery.includes('.');
    const isHttp = cleanQuery.startsWith('http://') || cleanQuery.startsWith('https://');
    return (hasDot || isHttp) && !cleanQuery.includes(' ');
  }, [cleanQuery]);

  // If detected as URL, ensure it starts with https:// and remove trailing slash
  const formattedDetectedUrl = useMemo(() => {
    if (!isDetectedAsUrl) return '';
    let url = cleanQuery;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    return url.replace(/\/$/, '');
  }, [cleanQuery, isDetectedAsUrl]);

  const normalizeUrl = (url: string) => url.replace(/\/$/, '').toLowerCase();

  const isDetectedUrlAlreadyAdded = useMemo(() => {
    if (!formattedDetectedUrl) return false;
    const target = normalizeUrl(formattedDetectedUrl);
    return walletMints.some((m) => normalizeUrl(m.mintUrl) === target);
  }, [formattedDetectedUrl, walletMints]);

  // ─── Listen for Scanner Result ─────────────────────────────────────────────
  useEffect(() => {
    if (scannerResult) {
      const scanned = scannerResult.trim();
      setScannerResult(null);
      setSearchQuery(scanned);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      let url = scanned;
      if (url.toLowerCase().startsWith('cashu:')) {
        url = url.substring(6);
      }
      if (url.includes('.') || url.startsWith('http://') || url.startsWith('https://')) {
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          url = 'https://' + url;
        }
        url = url.replace(/\/$/, '');
        addMintRef.current?.present(url);
      }
    }
  }, [scannerResult, setScannerResult]);

  // ─── Filtered Lists & Lazy Pagination ──────────────────────────────────────
  const PAGE_SIZE = 12;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Reset pagination when search query changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [cleanQuery]);

  const filteredConnectedMints = useMemo(() => {
    if (!cleanQuery) return walletMints;
    const q = cleanQuery.toLowerCase();
    return walletMints.filter((m) => {
      const name = m.name?.toLowerCase() || '';
      const nickname = m.nickname?.toLowerCase() || '';
      const url = m.mintUrl.toLowerCase();
      return name.includes(q) || nickname.includes(q) || url.includes(q);
    });
  }, [walletMints, cleanQuery]);

  const filteredDiscoveredMints = useMemo(() => {
    if (!cleanQuery) return allDiscoveredMints;
    const q = cleanQuery.toLowerCase();
    return allDiscoveredMints.filter((m) => {
      const name = m.name?.toLowerCase() || '';
      const url = m.url.toLowerCase();
      const desc = m.description?.toLowerCase() || '';
      return name.includes(q) || url.includes(q) || desc.includes(q);
    });
  }, [allDiscoveredMints, cleanQuery]);

  // Lazy-loaded slice of discovered mints
  const displayedDiscoveredMints = useMemo(() => {
    return filteredDiscoveredMints.slice(0, visibleCount);
  }, [filteredDiscoveredMints, visibleCount]);

  const hasMore = visibleCount < filteredDiscoveredMints.length;

  const handleLoadMore = useCallback(() => {
    if (hasMore && !isDiscoverLoading) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setVisibleCount((prev) => prev + PAGE_SIZE);
    }
  }, [hasMore, isDiscoverLoading]);

  // Auto load more on reaching near bottom of scroll
  const handleScroll = useCallback(
    ({ nativeEvent }: any) => {
      const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
      const isCloseToBottom =
        layoutMeasurement.height + contentOffset.y >= contentSize.height - 200;
      if (isCloseToBottom && hasMore && !isDiscoverLoading) {
        setVisibleCount((prev) => prev + PAGE_SIZE);
      }
    },
    [hasMore, isDiscoverLoading],
  );

  // Set of connected mint URLs for quick lookup
  const connectedUrlSet = useMemo(() => {
    return new Set(walletMints.map((m) => normalizeUrl(m.mintUrl)));
  }, [walletMints]);

  // ─── Navigation Handlers ───────────────────────────────────────────────────
  const handleConnectedMintPress = useCallback(
    (mintUrl: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push({
        pathname: '/(modals)/mint-details',
        params: { mintUrl },
      });
    },
    [router],
  );

  const handleDiscoveredMintPress = useCallback(
    (url: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push({
        pathname: '/(modals)/mint-profile',
        params: { url },
      });
    },
    [router],
  );

  const handleAddMintAction = useCallback((url: string) => {
    Keyboard.dismiss();
    addMintRef.current?.present(url);
  }, []);

  const safeGoBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  }, [router]);

  return (
    <YStack flex={1} bg="$background">
      {/* ─── Screen Header with Top-Right Scan Icon ─────────────────────────── */}
      <Stack.Screen
        options={{
          headerTitle: 'Mints',
          headerLeft: () => (
            <Button
              circular
              size="$4"
              chromeless
              pressStyle={{ scale: 0.95, bg: '$gray4' }}
              icon={<ChevronLeft size={28} color="$color" />}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                safeGoBack();
              }}
            />
          ),
          headerRight: () => (
            <Button
              circular
              size="$4"
              chromeless
              pressStyle={{ scale: 0.95, bg: '$gray4' }}
              icon={<Scan size={28} color="$color" />}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({
                  pathname: '/(modals)/scanner',
                  params: { returnTo: '/(modals)/add-mint' },
                });
              }}
            />
          ),
        }}
      />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: insets.bottom + 40,
        }}
        keyboardShouldPersistTaps="handled"
        onScroll={handleScroll}
        scrollEventThrottle={32}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.accentColor?.val || '#888'}
          />
        }
      >
        {/* ─── Search Bar (Finding & Adding by URL) ───────────────────────────── */}
        <YStack gap="$3" mb="$4">
          <XStack
            bg="$gray3"
            rounded="$6"
            px="$3.5"
            py="$2"
            items="center"
            borderWidth={0}
            borderColor="$borderColor"
            gap="$3"
          >
            <Search size={20} strokeWidth={3} color="$gray10" />
            <Input
              flex={1}
              placeholder="Search mint name or enter URL..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="search"
              borderWidth={0}
              bg="transparent"
              fontSize="$4"
              color="$color"
              fontWeight={800}
              p={0}
              focusStyle={{ borderWidth: 0 }}
              placeholderTextColor={theme.gray9.val}
              onSubmitEditing={() => {
                if (isDetectedAsUrl && formattedDetectedUrl) {
                  handleAddMintAction(formattedDetectedUrl);
                }
              }}
            />
            {!!searchQuery && (
              <TouchableOpacity
                onPress={() => {
                  Haptics.selectionAsync();
                  setSearchQuery('');
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={16} color="$gray10" />
              </TouchableOpacity>
            )}
          </XStack>

          {/* ─── Smart URL Detection Card ─────────────────────────────────────── */}
          {isDetectedAsUrl && (
            <YStack py="$2" gap="$2.5">
              <XStack justify="space-between" items="center">
                <XStack gap="$2" items="center" flex={1} mr="$2">
                  <View
                    width={40}
                    height={40}
                    rounded="$10"
                    bg="$gray4"
                    items="center"
                    justify="center"
                  >
                    <Landmark size={18} color="$gray10" />
                  </View>
                  <YStack flex={1}>
                    <Text fontSize="$3" fontWeight="700" color="$color">
                      Custom Mint URL Detected
                    </Text>
                    <Text fontSize="$2" color="$gray10" numberOfLines={1}>
                      {formattedDetectedUrl}
                    </Text>
                  </YStack>
                </XStack>

                {isDetectedUrlAlreadyAdded ? (
                  <XStack bg="$green3" px="$2.5" py="$1.5" rounded="$10" items="center" gap="$1">
                    <Check size={12} color="$green10" />
                    <Text fontSize="$2" fontWeight="700" color="$green10">
                      Connected
                    </Text>
                  </XStack>
                ) : (
                  <Button
                    size="$3"
                    themeInverse
                    rounded="$10"
                    px="$3"
                    onPress={() => handleAddMintAction(formattedDetectedUrl)}
                    iconAfter={<ArrowRight size={14} />}
                  >
                    <Text fontWeight="700" color="$color">
                      Add
                    </Text>
                  </Button>
                )}
              </XStack>
            </YStack>
          )}
        </YStack>

        {/* ─── Section 1: Connected Mints ────────────────────────────────────── */}
        <YStack gap="$2" mb="$5">
          <XStack justify="space-between" items="center" mb="$1" px="$1">
            <XStack items="center" gap="$2">
              <Text fontSize="$4" fontWeight="800" color="$gray10">
                Connected Mints
              </Text>
              <View bg="$gray4" px="$2" py="$0.5" rounded="$10">
                <Text fontSize="$2" fontWeight="700" color="$gray10">
                  {filteredConnectedMints.length}
                </Text>
              </View>
            </XStack>
          </XStack>

          {isInitializing ? (
            <MintSkeletonList count={2} />
          ) : filteredConnectedMints.length === 0 ? (
            <YStack py="$5" items="center" justify="center" gap="$2" bg="$color2" rounded="$5">
              <Globe size={24} color="$gray10" />
              <Text fontWeight="600" fontSize="$3" color="$color">
                {cleanQuery ? 'No matching connected mints' : 'No mints connected yet'}
              </Text>
              <Text fontSize="$2" color="$gray10" textAlign="center" px="$4">
                {cleanQuery
                  ? 'Try searching discovered mints below or connect via URL.'
                  : 'Add a Cashu mint to start sending and receiving ecash.'}
              </Text>
            </YStack>
          ) : (
            <YStack>
              {filteredConnectedMints.map((mint, index) => {
                const balance = balances[mint.mintUrl] || 0;
                const isActive = normalizeUrl(mint.mintUrl) === normalizeUrl(activeMintUrl || '');

                return (
                  <ConnectedMintRow
                    key={mint.mintUrl}
                    mint={mint}
                    balance={balance}
                    isActive={isActive}
                    hideBalance={hideBalance}
                    displayAsSats={displayAsSats}
                    showBitcoinSymbol={showBitcoinSymbol}
                    btcPrice={btcData?.price}
                    secondaryCurrency={secondaryCurrency}
                    refreshCounter={refreshCounter}
                    onPress={handleConnectedMintPress}
                    showTopSeparator={index === 0}
                  />
                );
              })}
            </YStack>
          )}
        </YStack>

        {/* ─── Section 2: Discover Mints (NIP-87) ────────────────────────────── */}
        <YStack gap="$2">
          <XStack justify="space-between" items="center" mb="$1" px="$1">
            <XStack items="center" gap="$2">
              <Text fontSize="$4" fontWeight="800" color="$gray10">
                Discover Mints
              </Text>
              <View bg="$gray4" px="$2" py="$0.5" rounded="$10">
                <Text fontSize="$2" fontWeight="700" color="$gray10">
                  {filteredDiscoveredMints.length}
                </Text>
              </View>
            </XStack>

            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                refetchDiscover();
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <RefreshCw size={14} color="$gray10" />
            </TouchableOpacity>
          </XStack>

          {isDiscoverLoading ? (
            <MintSkeletonList count={6} />
          ) : isDiscoverError ? (
            <YStack py="$5" items="center" justify="center" gap="$2" bg="$color2" rounded="$5">
              <Text color="$red10" fontWeight="600" fontSize="$3">
                Failed to discover mints
              </Text>
              <Button size="$2.5" theme="accent" onPress={() => refetchDiscover()}>
                <Text fontWeight="700" color="white">
                  Retry
                </Text>
              </Button>
            </YStack>
          ) : filteredDiscoveredMints.length === 0 ? (
            <YStack py="$5" items="center" justify="center" gap="$1" bg="$color2" rounded="$5">
              <Text fontWeight="600" fontSize="$3" color="$color">
                No mints found
              </Text>
              <Text fontSize="$2" color="$gray10">
                Try a different keyword or enter the exact mint URL above.
              </Text>
            </YStack>
          ) : (
            <YStack>
              {displayedDiscoveredMints.map((mint, index) => {
                const isAdded = connectedUrlSet.has(normalizeUrl(mint.url));

                return (
                  <DiscoveredMintRow
                    key={mint.url}
                    mint={mint}
                    isAdded={isAdded}
                    onPress={handleDiscoveredMintPress}
                    onAdd={handleAddMintAction}
                    showTopSeparator={index === 0}
                  />
                );
              })}

              {/* Load more indicator / button */}
              {hasMore && (
                <XStack justify="center" py="$4">
                  <Button
                    size="$3"
                    theme="gray"
                    rounded="$10"
                    onPress={handleLoadMore}
                    icon={<ChevronDown size={16} />}
                    pressStyle={{ scale: 0.96 }}
                  >
                    <Text fontSize="$3" fontWeight="700" color="$color">
                      {`Load More Mints (${filteredDiscoveredMints.length - visibleCount} remaining)`}
                    </Text>
                  </Button>
                </XStack>
              )}
            </YStack>
          )}
        </YStack>
      </ScrollView>

      {/* Trust & Add confirmation modal */}
      <AddMintModal ref={addMintRef} />
    </YStack>
  );
}
