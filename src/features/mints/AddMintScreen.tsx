import { AppInput as Input } from '~/shared/ui/AppInput';
import { HeaderIconButton } from '~/shared/ui/HeaderIconButton';
import { AppButton } from '~/shared/ui/AppButton';
import { AppIconButton } from '~/shared/ui/AppIconButton';
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Text, YStack, XStack, Paragraph, View, useTheme, ScrollView, Separator } from 'tamagui';
import {
  Scan,
  ArrowLeft,
  Search,
  X,
  Plus,
  Check,
  Sprout,
  Zap,
  Bitcoin,
  RefreshCw,
  ChevronDown,
  Landmark,
} from '@tamagui/lucide-icons';
import * as Haptics from 'expo-haptics';
import { RefreshControl, TouchableOpacity, Keyboard } from 'react-native';
import Animated, {
  type SharedValue,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWalletStore } from '~/state/walletStore';
import type { MintRecommendation } from '~/services/api/mintRecommendationService';
import { mintMetadataFromInfo } from '~/features/explore/components/mintMeta';
import { useMintInfo } from '~/shared/hooks/useMintInfo';
import { appTypography } from '~/shared/theme/appearance';
import { useMintDiscovery } from './hooks/useMintDiscovery';
import { MintIcon } from '~/features/explore/components/MintIcon';
import { mintUrlKey } from '~/shared/utils/mintUrl';
import { useQuickMintConnection } from './hooks/useQuickMintConnection';

// ─── Skeleton Loading Components ─────────────────────────────────────────────
interface MintSkeletonRowProps {
  progress: SharedValue<number>;
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

interface DiscoveredMintRowProps {
  mint: MintRecommendation;
  isAdded: boolean;
  onPress: (url: string) => void;
  onAdd: (url: string) => void;
  showTopSeparator?: boolean;
  connecting: boolean;
  disabled: boolean;
  error?: string;
}

const DiscoveredMintRow = React.memo(
  ({
    mint,
    isAdded,
    onPress,
    onAdd,
    showTopSeparator,
    connecting,
    disabled,
    error,
  }: DiscoveredMintRowProps) => {
    const { data: info } = useMintInfo(mint.url);
    const meta = mintMetadataFromInfo(info, mint.url);

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
        {showTopSeparator && (
          <Separator height={2} borderWidth={0} bg="$borderColor" opacity={0.3} />
        )}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => onPress(mint.url)}
          disabled={disabled}
          style={{
            paddingVertical: 12,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          {/* Left: 48px Circular icon */}
          <View mr="$3">
            <MintIcon url={mint.url} hintIcon={mint.icon} size={48} />
          </View>

          {/* Middle: Title + badges + URL */}
          <YStack flex={1} mr="$2" justify="center" gap={3}>
            <XStack items="center" gap="$2" flexWrap="nowrap">
              <Text
                {...appTypography.label1}
                fontWeight="600"
                color="$color"
                numberOfLines={1}
                style={{ maxWidth: '70%' }}
              >
                {displayName}
              </Text>
              <MintBadges supportsNut30={meta?.supportsNut30} />
            </XStack>

            <Text {...appTypography.body2} color="$gray10" numberOfLines={1}>
              {hostname}
            </Text>
          </YStack>

          {/* Right: Add button or Added status */}
          <View>
            {isAdded ? (
              <XStack rounded="$10" items="center" gap="$1" px="$2">
                <Check size={12} color="$color" strokeWidth={3} />
                <Text {...appTypography.body3} fontWeight="600" color="$gray10">
                  Added
                </Text>
              </XStack>
            ) : (
              <AppIconButton
                variant="default"
                shape="circular"
                accessibilityLabel={`Add ${displayName}`}
                emphasis="secondary"
                size="small"
                loading={connecting}
                loadingText={`Connecting to ${displayName}`}
                disabled={disabled}
                icon={<Plus size={16} strokeWidth={2.5} />}
                onPress={(e) => {
                  e.stopPropagation();
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onAdd(mint.url);
                }}
              />
            )}
          </View>
        </TouchableOpacity>
        {error && (
          <Text color="$red10" fontSize={11} accessibilityRole="alert" pb="$2">
            {error}
          </Text>
        )}
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

  const [searchQuery, setSearchQuery] = useState('');
  const searchInput = useRef<React.ElementRef<typeof Input>>(null);
  const mintScroll = useRef<React.ElementRef<typeof ScrollView>>(null);
  const enterMintUrl = () => {
    mintScroll.current?.scrollTo({ y: 0, animated: true });
    searchInput.current?.focus();
  };
  const [refreshing, setRefreshing] = useState(false);
  const {
    requestConnection,
    connectingUrl,
    connectionError,
    sheet: connectionSheet,
  } = useQuickMintConnection();

  const { mints: walletMints, scannerResult, setScannerResult } = useWalletStore();

  // MintRadar's directory plus NIP-87 relay discovery (cached).
  const {
    data: allDiscoveredMints = [],
    isLoading: isDiscoverLoading,
    isError: isDiscoverError,
    refetch: refetchDiscover,
  } = useMintDiscovery();

  // Pull-to-refresh handler
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await refetchDiscover();
    } finally {
      setRefreshing(false);
    }
  }, [refetchDiscover]);

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

  const normalizeUrl = mintUrlKey;

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
        setSearchQuery(url);
        void requestConnection({ url });
      }
    }
  }, [scannerResult, setScannerResult, requestConnection]);

  // ─── Filtered Lists & Lazy Pagination ──────────────────────────────────────
  const PAGE_SIZE = 12;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Reset pagination when search query changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [cleanQuery]);

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

  const handleAddMintAction = useCallback(
    async (url: string) => {
      Keyboard.dismiss();
      const mint = allDiscoveredMints.find((mint) => mintUrlKey(mint.url) === mintUrlKey(url));
      await requestConnection({ url, name: mint?.name, icon: mint?.icon });
    },
    [allDiscoveredMints, requestConnection],
  );

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
          title: 'Add mint',
          gestureEnabled: !connectingUrl,
          headerLeft: () => (
            <HeaderIconButton
              accessibilityLabel="Go back"
              disabled={!!connectingUrl}
              icon={<ArrowLeft color="$color" />}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                safeGoBack();
              }}
            />
          ),
          headerRight: () => (
            <HeaderIconButton
              accessibilityLabel="Scan QR code"
              disabled={!!connectingUrl}
              icon={<Scan color="$color" />}
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
        ref={mintScroll}
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
            bg="$gray2"
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
              ref={searchInput}
              flex={1}
              placeholder="Search mint name or enter URL..."
              value={searchQuery}
              editable={!connectingUrl}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="search"
              borderWidth={0}
              bg="transparent"
              {...appTypography.label2}
              color="$color"
              fontWeight="500"
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
                    <Text {...appTypography.body2} fontWeight="600" color="$color">
                      Add by URL
                    </Text>
                    <Text {...appTypography.body2} color="$gray10" numberOfLines={1}>
                      {formattedDetectedUrl}
                    </Text>
                  </YStack>
                </XStack>

                {isDetectedUrlAlreadyAdded ? (
                  <XStack bg="$green3" px="$2.5" py="$1.5" rounded="$10" items="center" gap="$1">
                    <Check size={12} color="$green10" />
                    <Text {...appTypography.body3} fontWeight="600" color="$green10">
                      Added
                    </Text>
                  </XStack>
                ) : (
                  <AppIconButton
                    variant="default"
                    shape="circular"
                    accessibilityLabel="Add mint"
                    emphasis="secondary"
                    size="xsmall"
                    loading={connectingUrl === normalizeUrl(formattedDetectedUrl)}
                    loadingText="Connecting to mint…"
                    disabled={!!connectingUrl}
                    icon={<Plus size={16} strokeWidth={2.5} />}
                    onPress={() => handleAddMintAction(formattedDetectedUrl)}
                  />
                )}
              </XStack>
            </YStack>
          )}
        </YStack>

        {connectionError &&
          isDetectedAsUrl &&
          connectionError.url === normalizeUrl(formattedDetectedUrl) && (
            <Text color="$red10" fontSize={11} accessibilityRole="alert" mb="$3">
              {connectionError.message}
            </Text>
          )}

        {/* Discover mints from MintRadar and NIP-87. */}
        <YStack gap="$2">
          <XStack justify="space-between" items="center" mb="$1" px="$1">
            <XStack items="center" gap="$2">
              <Text {...appTypography.label2} fontWeight="600" color="$gray10">
                Discover mints
              </Text>
              <View bg="$gray4" px="$2" py="$0.5" rounded="$10">
                <Text {...appTypography.body3} fontWeight="600" color="$gray10">
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
            <YStack py="$5" items="center" justify="center" gap="$2" bg="$gray2" rounded="$6">
              <Text color="$red10" {...appTypography.body2} fontWeight="600">
                Failed to discover mints
              </Text>
              <AppButton
                variant="default"
                emphasis="primary"
                size="xxsmall"
                onPress={() => refetchDiscover()}
              >
                Retry
              </AppButton>
            </YStack>
          ) : filteredDiscoveredMints.length === 0 ? (
            <YStack py="$5" items="center" justify="center" gap="$2" bg="$gray2" rounded="$6">
              <Text {...appTypography.body2} fontWeight="600" color="$color">
                {cleanQuery ? 'No matching mints' : 'No mints found'}
              </Text>
              <Text {...appTypography.body3} color="$gray10" textAlign="center" px="$4">
                {cleanQuery
                  ? 'Try a different keyword or enter the exact mint URL above.'
                  : 'Connect directly using a Cashu mint URL.'}
              </Text>
              <AppButton
                emphasis="text"
                onPress={cleanQuery ? () => setSearchQuery('') : enterMintUrl}
              >
                {cleanQuery ? 'Clear search' : 'Enter mint URL'}
              </AppButton>
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
                    connecting={connectingUrl === normalizeUrl(mint.url)}
                    disabled={!!connectingUrl}
                    error={
                      connectionError?.url === normalizeUrl(mint.url)
                        ? connectionError.message
                        : undefined
                    }
                    onPress={handleDiscoveredMintPress}
                    onAdd={handleAddMintAction}
                    showTopSeparator={index > 0}
                  />
                );
              })}

              {/* Load more indicator / button */}
              {hasMore && (
                <XStack justify="center" py="$4">
                  <AppButton
                    variant="default"
                    emphasis="secondary"
                    size="xsmall"
                    icon={<ChevronDown size={16} />}
                    onPress={handleLoadMore}
                  >
                    {`Load More Mints (${filteredDiscoveredMints.length - visibleCount} remaining)`}
                  </AppButton>
                </XStack>
              )}
            </YStack>
          )}
        </YStack>
      </ScrollView>
      {connectionSheet}
    </YStack>
  );
}
