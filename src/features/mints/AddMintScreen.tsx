import { AppInput as Input } from '~/shared/ui/AppInput';
import { HeaderIconButton } from '~/shared/ui/HeaderIconButton';
import { AppButton } from '~/shared/ui/AppButton';
import { Spinner } from '~/shared/ui/Spinner';
import { AppIconButton } from '~/shared/ui/AppIconButton';
import { AppPressable } from '~/shared/ui/AppPressable';
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Text, YStack, XStack, View, useTheme, Separator } from 'tamagui';
import { LegendList, type LegendListRef } from '@legendapp/list/react-native';
import {
  Scan,
  ArrowLeft,
  Search,
  X,
  Plus,
  Check,
  Zap,
  Bitcoin,
  Landmark,
  CircleOff,
} from '~/shared/icons';
import { RefreshControl, TouchableOpacity, Keyboard, useWindowDimensions } from 'react-native';
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
import { useMintInfo, mintInfoQueryOptions } from '~/shared/hooks/useMintInfo';
import { appTypography } from '~/shared/theme/appearance';
import { useMintDiscovery } from './hooks/useMintDiscovery';
import { MintIconImage } from '~/features/explore/components/MintIcon';
import { mintUrlKey } from '~/shared/utils/mintUrl';
import { useQuickMintConnection } from './hooks/useQuickMintConnection';
import { useQueries } from '@tanstack/react-query';
import { BUIOutlineChip } from '~/shared/ui/BUI/BUIChip';
import { BUIAppearanceProvider, useBUIOverlayAppearance } from '~/shared/ui/BUI/useBUITheme';
import { useAppToast } from '~/shared/hooks/useAppToast';

// ─── Skeleton Loading Components ─────────────────────────────────────────────
const mintKey = (mint: MintRecommendation) => mintUrlKey(mint.url);
const supportsOnchain = (info: Record<string, any>) =>
  mintMetadataFromInfo(info, '').supportsNut30 === true;

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
  rank?: number;
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
    rank,
  }: DiscoveredMintRowProps) => {
    const unavailable = mint.status === 'offline' || mint.status === 'archived';
    const toast = useAppToast();
    const explainUnavailable = () =>
      toast.showFeedback({
        title:
          mint.status === 'archived'
            ? 'This mint is no longer active'
            : 'This mint is offline. Try again later.',
        severity: 'warning',
      });
    const { data: info, isLoading } = useMintInfo(mint.url, { enabled: !unavailable });
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
          onPress={() => (unavailable ? explainUnavailable() : onPress(mint.url))}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={`${displayName}${unavailable ? ', unavailable mint' : ''}`}
          style={{
            paddingVertical: 12,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          {rank !== undefined && (
            <View
              width={32}
              height={32}
              rounded={999}
              items="center"
              justify="center"
              mr="$2"
              accessibilityLabel={`Rank ${rank}`}
            >
              <Text
                {...appTypography.title3}
                fontWeight="600"
                color={
                  rank === 1
                    ? '$green11'
                    : rank === 2
                      ? '$cyan11'
                      : rank === 3
                        ? '$orange11'
                        : '$gray10'
                }
              >
                {rank}
              </Text>
            </View>
          )}
          {/* Left: 48px Circular icon */}
          <View mr="$3">
            <MintIconImage
              url={mint.url}
              hintIcon={mint.icon}
              size={48}
              info={info}
              loading={isLoading}
            />
          </View>

          {/* Middle: Title + badges + URL */}
          <YStack flex={1} mr="$2" justify="center" gap={3}>
            <XStack items="center" gap="$2" flexWrap="nowrap">
              <Text
                {...appTypography.label1}
                fontWeight="600"
                color={
                  rank === 1
                    ? '$green11'
                    : rank === 2
                      ? '$cyan11'
                      : rank === 3
                        ? '$orange11'
                        : '$color'
                }
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

          {/* Right: Add button or connected checkmark */}
          <View>
            {unavailable ? (
              <AppPressable
                accessibilityRole="button"
                accessibilityLabel={`Why ${displayName} is unavailable`}
                width={48}
                height={48}
                items="center"
                justify="center"
                disabled={disabled}
                onPress={(event) => {
                  event.stopPropagation();
                  explainUnavailable();
                }}
              >
                <View
                  bg="$gray3"
                  rounded={999}
                  width={32}
                  height={32}
                  items="center"
                  justify="center"
                >
                  <CircleOff size={18} color="$gray10" />
                </View>
              </AppPressable>
            ) : isAdded ? (
              <XStack
                width={48}
                height={48}
                items="center"
                justify="center"
                accessible
                accessibilityRole="image"
                accessibilityLabel={`${displayName} added`}
              >
                <Check size={24} color="$color" strokeWidth={2.5} />
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
  const appearance = useBUIOverlayAppearance();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();

  const [searchQuery, setSearchQuery] = useState('');
  const [onchainOnly, setOnchainOnly] = useState(false);
  const [testnutsOnly, setTestnutsOnly] = useState(false);
  const [activeOnly, setActiveOnly] = useState(false);
  const [topRanked, setTopRanked] = useState(false);
  const searchInput = useRef<React.ElementRef<typeof Input>>(null);
  const mintScroll = useRef<LegendListRef>(null);
  const enterMintUrl = () => {
    mintScroll.current?.scrollToOffset({ offset: 0, animated: true });
    searchInput.current?.focus();
  };
  const [refreshing, setRefreshing] = useState(false);
  const failedChecksRef = useRef<(() => Promise<unknown>)[]>([]);
  const {
    requestConnection,
    connectingUrl,
    connectionError,
    sheet: connectionSheet,
  } = useQuickMintConnection();

  const walletMints = useWalletStore((state) => state.mints);
  const scannerResult = useWalletStore((state) => state.scannerResult);
  const setScannerResult = useWalletStore((state) => state.setScannerResult);

  // MintRadar's directory plus NIP-87 relay discovery (cached).
  const {
    data: allDiscoveredMints = [],
    isFetching: isDiscoverFetching,
    isError: isDiscoverError,
    refetch: refetchDiscover,
  } = useMintDiscovery();

  // Pull-to-refresh handler
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);

    try {
      await Promise.all([refetchDiscover(), ...failedChecksRef.current.map((retry) => retry())]);
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
  const connectedUrlSet = useMemo(
    () => new Set(walletMints.map((mint) => mintUrlKey(mint.mintUrl))),
    [walletMints],
  );
  const candidates = useMemo(() => {
    const q = cleanQuery.toLowerCase();
    const matches = allDiscoveredMints.filter((m) => {
      if (topRanked && m.radarRank === undefined) return false;
      if (testnutsOnly && m.isTestnet !== true) return false;
      if (activeOnly && m.status !== 'online') return false;
      const name = m.name?.toLowerCase() || '';
      const url = m.url.toLowerCase();
      const desc = m.description?.toLowerCase() || '';
      return name.includes(q) || url.includes(q) || desc.includes(q);
    });
    return topRanked ? matches.sort((a, b) => a.radarRank! - b.radarRank!) : matches;
  }, [allDiscoveredMints, cleanQuery, testnutsOnly, activeOnly, topRanked]);

  // Capability discovery is opt-in and uses the shared cache and four-request queue.
  const capabilityQueries = useMemo(
    () =>
      onchainOnly
        ? candidates.map((mint) => ({
            ...mintInfoQueryOptions(mint.url, 'background'),
            select: supportsOnchain,
          }))
        : [],
    [onchainOnly, candidates],
  );
  const capabilities = useQueries({ queries: capabilityQueries });
  const checkingCapabilities =
    onchainOnly && capabilities.some((query) => query.isPending || query.isFetching);
  const failedCapabilities = onchainOnly && capabilities.some((query) => query.isError);
  failedChecksRef.current = capabilities
    .filter((query) => query.isError)
    .map((query) => () => query.refetch({ cancelRefetch: false }));
  const filteredDiscoveredMints = onchainOnly
    ? candidates.filter((_, index) => capabilities[index]?.data === true)
    : candidates;
  const hasFilters = onchainOnly || testnutsOnly || activeOnly || topRanked;
  const clearFilters = () => {
    setSearchQuery('');
    setOnchainOnly(false);
    setTestnutsOnly(false);
    setActiveOnly(false);
    setTopRanked(false);
  };

  // ─── Navigation Handlers ───────────────────────────────────────────────────
  const handleDiscoveredMintPress = useCallback(
    (url: string) => {
      router.push({
        pathname: '/(modals)/mint-profile',
        params: { url },
      });
    },
    [router],
  );

  const discoveredMintsRef = useRef(allDiscoveredMints);
  discoveredMintsRef.current = allDiscoveredMints;

  const handleAddMintAction = useCallback(
    async (url: string) => {
      Keyboard.dismiss();
      const mint = discoveredMintsRef.current.find(
        (mint) => mintUrlKey(mint.url) === mintUrlKey(url),
      );
      await requestConnection({ url, name: mint?.name, icon: mint?.icon });
    },
    [requestConnection],
  );

  const renderDiscoveredMint = useCallback(
    ({ item: mint, index }: { item: MintRecommendation; index: number }) => (
      <DiscoveredMintRow
        mint={mint}
        rank={topRanked ? mint.radarRank : undefined}
        isAdded={connectedUrlSet.has(normalizeUrl(mint.url))}
        connecting={connectingUrl === normalizeUrl(mint.url)}
        disabled={!!connectingUrl}
        error={
          connectionError?.url === normalizeUrl(mint.url) ? connectionError.message : undefined
        }
        onPress={handleDiscoveredMintPress}
        onAdd={handleAddMintAction}
        showTopSeparator={index > 0}
      />
    ),
    [
      connectedUrlSet,
      connectingUrl,
      connectionError,
      handleDiscoveredMintPress,
      handleAddMintAction,
      topRanked,
    ],
  );

  const safeGoBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  }, [router]);

  const rowState = useMemo(
    () => ({ connectedUrlSet, connectingUrl, connectionError, topRanked }),
    [connectedUrlSet, connectingUrl, connectionError, topRanked],
  );

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
                router.push({
                  pathname: '/(modals)/scanner',
                  params: { returnTo: '/(modals)/add-mint' },
                });
              }}
            />
          ),
        }}
      />

      <LegendList
        ref={mintScroll}
        data={filteredDiscoveredMints}
        extraData={rowState}
        renderItem={renderDiscoveredMint}
        keyExtractor={mintKey}
        recycleItems
        estimatedItemSize={74}
        drawDistance={Math.min(1200, Math.max(600, windowHeight))}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: insets.bottom + 40,
        }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.accentColor?.val || '#888'}
          />
        }
        ListHeaderComponent={
          <>
            {/* ─── Search Bar (Finding & Adding by URL) ───────────────────────────── */}
            <YStack gap="$2" mb="$1">
              <XStack
                bg="$gray2"
                rounded="$6"
                px="$1"
                minHeight={48}
                items="center"
                borderWidth={0}
                borderColor="$borderColor"
                gap="$1"
              >
                <XStack width={40} items="center" justify="center">
                  {isDiscoverFetching || checkingCapabilities ? (
                    <Spinner
                      size={18}
                      color="$gray10"
                      accessibilityLabel={
                        checkingCapabilities
                          ? 'Checking on-chain support'
                          : 'Discovering more mints'
                      }
                    />
                  ) : (
                    <Search size={18} color="$gray10" />
                  )}
                </XStack>
                <Input
                  ref={searchInput}
                  flex={1}
                  accessibilityLabel="Search mints"
                  placeholder="Search or paste mint URL"
                  value={searchQuery}
                  editable={!connectingUrl}
                  onChangeText={setSearchQuery}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  returnKeyType="search"
                  borderWidth={0}
                  bg="transparent"
                  {...appTypography.body1}
                  height={48}
                  minWidth={0}
                  color="$color"
                  p={0}
                  focusStyle={{ borderWidth: 0 }}
                  placeholderTextColor={theme.gray10.val}
                  onSubmitEditing={() => {
                    if (isDetectedAsUrl && formattedDetectedUrl) {
                      handleAddMintAction(formattedDetectedUrl);
                    }
                  }}
                />
                <XStack width={48} minHeight={48} items="center" justify="center">
                  {!!searchQuery && (
                    <AppPressable
                      accessibilityRole="button"
                      accessibilityLabel="Clear mint search"
                      minWidth={48}
                      minHeight={48}
                      items="center"
                      justify="center"
                      disabled={!!connectingUrl}
                      onPress={() => {
                        setSearchQuery('');
                        searchInput.current?.focus();
                      }}
                    >
                      <View
                        width={24}
                        height={24}
                        rounded={999}
                        bg="$gray3"
                        items="center"
                        justify="center"
                      >
                        <X size={14} strokeWidth={2.5} color="$gray10" />
                      </View>
                    </AppPressable>
                  )}
                </XStack>
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
                      <XStack
                        bg="$green3"
                        px="$2.5"
                        py="$1.5"
                        rounded="$10"
                        items="center"
                        gap="$1"
                      >
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

            <BUIAppearanceProvider value={appearance}>
              <XStack gap="$2" flexWrap="wrap" py="$2" mb="$1">
                <BUIOutlineChip
                  selected={topRanked}
                  onPress={() => setTopRanked((value) => !value)}
                >
                  Top ranked
                </BUIOutlineChip>
                <BUIOutlineChip
                  selected={onchainOnly}
                  onPress={() => setOnchainOnly((value) => !value)}
                >
                  On-chain
                </BUIOutlineChip>
                <BUIOutlineChip
                  selected={testnutsOnly}
                  onPress={() => setTestnutsOnly((value) => !value)}
                >
                  Testnuts
                </BUIOutlineChip>
                <BUIOutlineChip
                  selected={activeOnly}
                  onPress={() => setActiveOnly((value) => !value)}
                >
                  Active mints
                </BUIOutlineChip>
              </XStack>
            </BUIAppearanceProvider>
            {topRanked && (
              <Text {...appTypography.body3} color="$gray10" mb="$2">
                Ranked by Mint Radar reliability score
              </Text>
            )}
            {connectionError &&
              isDetectedAsUrl &&
              connectionError.url === normalizeUrl(formattedDetectedUrl) && (
                <Text color="$red10" fontSize={11} accessibilityRole="alert" mb="$3">
                  {connectionError.message}
                </Text>
              )}
          </>
        }
        ListEmptyComponent={
          isDiscoverFetching || checkingCapabilities ? (
            <MintSkeletonList count={6} />
          ) : isDiscoverError && allDiscoveredMints.length === 0 ? (
            <YStack py="$5" items="center" justify="center" gap="$2" bg="$gray2" rounded="$6">
              <Text color="$red10" {...appTypography.body2} fontWeight="600">
                Failed to discover mints
              </Text>
              <AppButton
                variant="default"
                emphasis="primary"
                size="xxsmall"
                onPress={handleRefresh}
              >
                Retry
              </AppButton>
            </YStack>
          ) : (
            <YStack py="$5" items="center" justify="center" gap="$2" bg="$gray2" rounded="$6">
              <Text {...appTypography.body2} fontWeight="600" color="$color">
                {failedCapabilities
                  ? 'Some mints could not be checked'
                  : cleanQuery || hasFilters
                    ? 'No matching mints'
                    : 'No mints found'}
              </Text>
              <Text {...appTypography.body3} color="$gray10" textAlign="center" px="$4">
                {failedCapabilities
                  ? 'Pull to refresh or clear the filters.'
                  : hasFilters
                    ? 'Try another filter combination.'
                    : cleanQuery
                      ? 'Try a different keyword or enter the exact mint URL above.'
                      : 'Connect directly using a Cashu mint URL.'}
              </Text>
              {failedCapabilities && (
                <AppButton emphasis="secondary" size="small" onPress={handleRefresh}>
                  Retry
                </AppButton>
              )}
              <AppButton
                emphasis="text"
                onPress={
                  hasFilters ? clearFilters : cleanQuery ? () => setSearchQuery('') : enterMintUrl
                }
              >
                {hasFilters ? 'Clear filters' : cleanQuery ? 'Clear search' : 'Enter mint URL'}
              </AppButton>
            </YStack>
          )
        }
      />
      {connectionSheet}
    </YStack>
  );
}
