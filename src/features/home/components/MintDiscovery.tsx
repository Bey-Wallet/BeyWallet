import React, { useEffect } from 'react';
import { YStack, XStack, Text, Button, Card, H3, H4, Image, View } from 'tamagui';
import { Spinner } from '~/shared/ui/Spinner';
import {
  Search,
  Star,
  MessageSquare,
  Plus,
  RefreshCw,
  Check,
  Sprout,
  Info,
  ExternalLink,
  ShieldCheck,
  ShieldOff,
} from '@tamagui/lucide-icons';
import { useQuery } from '@tanstack/react-query';
import { mintRecommendationService } from '~/services/api/mintRecommendationService';
import { useWalletStore } from '~/state/walletStore';
import { initService } from '~/services/wallet';
import * as Haptics from 'expo-haptics';
import { useToastController } from '@tamagui/toast';
import { useRouter } from 'expo-router';
import { AppBottomSheetRef } from '~/shared/ui/AppBottomSheet';
import AddMintModal, { AddMintModalRef } from '~/shared/ui/AddMintModal';

interface MintDiscoveryProps {
  refreshTrigger?: number;
  onRefreshStarted?: () => void;
  onRefreshFinished?: () => void;
}

export function MintDiscovery({
  refreshTrigger,
  onRefreshStarted,
  onRefreshFinished,
}: MintDiscoveryProps) {
  const [loadingMessage, setLoadingMessage] = React.useState('Loading...');
  const {
    data: recommendations = [],
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['mint-recommendations'],
    queryFn: async () => {
      const repo = initService.getRepo();

      setLoadingMessage('Fetching from local database...');
      const cached = await repo.mintRecommendationRepository.getAll();

      if (cached.length === 0) {
        setLoadingMessage('Searching the Nostr network...');
        const discovered = await mintRecommendationService.discoverMints();
        if (discovered.length > 0) {
          await repo.mintRecommendationRepository.saveAll(discovered);
          return discovered;
        }
      }

      return cached;
    },
    staleTime: Infinity,
  });

  const handleRefresh = async () => {
    onRefreshStarted?.();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLoadingMessage('Syncing with the Nostr network...');

    try {
      const discovered = await mintRecommendationService.discoverMints();
      if (discovered.length > 0) {
        const repo = initService.getRepo();
        await repo.mintRecommendationRepository.deleteAll();
        await repo.mintRecommendationRepository.saveAll(discovered);
        refetch();
      }
    } catch (e) {
      console.error('[MintDiscovery] Refresh failed:', e);
    } finally {
      onRefreshFinished?.();
    }
  };

  React.useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      handleRefresh();
    }
  }, [refreshTrigger]);

  const { mints, trustMint } = useWalletStore();
  const router = useRouter();
  const addMintRef = React.useRef<AddMintModalRef>(null);

  const normalizeUrl = (url: string) => url.replace(/\/$/, '');

  const handleAction = async (url: string, status: 'none' | 'untrusted' | 'trusted') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (status === 'none') {
      addMintRef.current?.present(url);
    } else if (status === 'untrusted') {
      // Quick trust
      try {
        await trustMint(url);
      } catch (e) {
        console.error('[MintDiscovery] Quick trust failed:', e);
      }
    }
  };

  const handleViewProfile = (url: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: '/(modals)/mint-profile',
      params: { url },
    });
  };

  return (
    <YStack gap="$4" width="100%">
      <XStack items="center" justify="space-between" px="$1">
        <H3 fontSize="$6" fontWeight="bold">
          Discover Mints
        </H3>
        <Button
          size="$2"
          circular
          chromeless
          icon={isLoading || isRefetching ? <Spinner size="small" /> : <RefreshCw size={14} />}
          onPress={handleRefresh}
          disabled={isLoading || isRefetching}
        />
      </XStack>

      {(isLoading || isRefetching) && recommendations.length === 0 && (
        <YStack height={200} items="center" justify="center" gap="$3">
          <Spinner size="large" color="$accent9" />
          <Text color="$gray10">{loadingMessage}</Text>
        </YStack>
      )}

      {error && recommendations.length === 0 && (
        <YStack height={100} items="center" justify="center" gap="$2">
          <Text color="$red10">Failed to load recommendations</Text>
          <Button size="$3" onPress={() => refetch()}>
            Retry
          </Button>
        </YStack>
      )}

      {!isLoading && recommendations.length === 0 && !error && (
        <Card p="$4" items="center" justify="center" bg="$gray2">
          <Text color="$gray10">No mints found in your relays.</Text>
        </Card>
      )}

      <YStack gap="$3">
        {recommendations.map((mint, index) => {
          const normalizedMintUrl = normalizeUrl(mint.url);
          const walletMint = mints.find((m) => normalizeUrl(m.mintUrl) === normalizedMintUrl);

          const isAlreadyAdded = !!walletMint;
          const isTrusted = walletMint?.trusted ?? false;
          const isMostRecommended = index < 2;

          let status: 'none' | 'untrusted' | 'trusted' = 'none';
          if (isAlreadyAdded) {
            status = isTrusted ? 'trusted' : 'untrusted';
          }

          return (
            <Card
              key={mint.url}
              size="$4"
              p="$3"
              bg="$gray3"
              minH={150}
              pressStyle={{ scale: 0.98 }}
              borderWidth={isTrusted ? 1 : 0}
              borderColor={isTrusted ? '$green8' : 'transparent'}
            >
              <YStack justify="space-between" flex={1}>
                <XStack gap="$3">
                  <View
                    width={48}
                    height={48}
                    rounded="$4"
                    bg="$gray4"
                    items="center"
                    justify="center"
                    overflow="hidden"
                  >
                    {mint.icon ? (
                      <Image source={{ uri: mint.icon, width: 48, height: 48 }} />
                    ) : (
                      <Sprout size={28} color="$gray10" />
                    )}
                  </View>

                  <YStack flex={1} gap="$1">
                    <XStack items="center" justify="space-between" width="100%">
                      <XStack items="center" gap="$2" flex={1}>
                        <H4 fontSize="$5" fontWeight="700" numberOfLines={1}>
                          {mint.name ||
                            (() => {
                              try {
                                return new URL(mint.url).hostname;
                              } catch (e) {
                                return mint.url;
                              }
                            })()}
                        </H4>
                        {isTrusted ? (
                          <ShieldCheck size={16} color="$green10" />
                        ) : isAlreadyAdded ? (
                          <ShieldOff size={16} color="$orange10" />
                        ) : null}
                      </XStack>
                      <Button
                        size="$2"
                        circular
                        icon={<ExternalLink size={16} color="$gray10" />}
                        onPress={() => handleViewProfile(mint.url)}
                        chromeless
                      />
                    </XStack>

                    <Text color="$gray10" fontSize="$3" numberOfLines={2}>
                      {mint.description || mint.url}
                    </Text>
                  </YStack>
                </XStack>

                <XStack mt="$2" items="center" justify="space-between">
                  <XStack gap="$3" items="center">
                    <XStack items="center" gap="$1.5">
                      <MessageSquare size={14} color="$gray9" />
                      <Text fontSize="$2" color="$gray9">
                        {mint.reviewsCount}
                      </Text>
                    </XStack>

                    <XStack items="center" gap="$1.5">
                      <Star size={14} color="#FFD700" fill="#FFD700" />
                      <Text fontSize="$3" fontWeight="bold">
                        {mint.averageRating ? mint.averageRating.toFixed(1) : 'N/A'}
                      </Text>
                    </XStack>
                  </XStack>

                  <Button
                    size="$3"
                    fontWeight="bold"
                    theme={
                      status === 'trusted' ? 'green' : status === 'untrusted' ? 'orange' : 'accent'
                    }
                    disabled={status === 'trusted'}
                    icon={status === 'trusted' ? <ShieldCheck size={14} /> : <Plus size={14} />}
                    onPress={() => handleAction(mint.url, status)}
                  >
                    {status === 'trusted'
                      ? 'Trusted'
                      : status === 'untrusted'
                        ? 'Trust Now'
                        : 'Connect'}
                  </Button>
                </XStack>
              </YStack>

              {isMostRecommended && (
                <XStack
                  position="absolute"
                  t={-10}
                  r={12}
                  bg="gold"
                  px="$2"
                  py="$1"
                  rounded="$2"
                  borderWidth={1}
                  borderColor="$yellow10"
                  items="center"
                  gap="$1"
                  z={10}
                  elevation={3}
                >
                  <Star size={10} color="black" fill="black" />
                  <Text fontSize="$1" fontWeight="800" color="black" letterSpacing={0.5}>
                    TOP BEST
                  </Text>
                </XStack>
              )}
            </Card>
          );
        })}
      </YStack>

      <AddMintModal ref={addMintRef} />
    </YStack>
  );
}
