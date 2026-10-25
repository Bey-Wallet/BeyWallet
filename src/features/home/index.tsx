import { RefreshControl, Animated, Easing } from 'react-native';
import { YStack, ScrollView, XStack, Text, View, useTheme } from 'tamagui';
import * as Haptics from 'expo-haptics';
import { useToastController } from '@tamagui/toast';
import WalletCard from '~/features/home/components/WalletCard';
import ActionButtons from '~/features/home/components/ActionButtons';
import { SupporterCard } from '~/features/supporter/SupporterCard';
import BackupWarningCard from '~/features/home/components/BackupWarningCard';
import ClaimUsernameCard from '~/features/home/components/ClaimUsernameCard';
import RestoreProgressCard from '~/features/home/components/RestoreProgressCard';
import { useWalletStore } from '~/state/walletStore';
import React from 'react';
import StatusScreen from '~/shared/ui/StatusScreen';
import BeyIcon from '~/shared/icons/BeyIcon';
import { useLightningAddressStore } from '~/state/lightningAddressStore';
import { ChevronRight, Zap } from '@tamagui/lucide-icons';
import { AppPressable } from '~/shared/ui/AppPressable';
import { appTypography } from '~/shared/theme/appearance';

// Lazy-load below-the-fold components — they mount AFTER the above-fold
// content (WalletCard + ActionButtons) is already painted, so the user
// sees the critical content instantly.
import ConnectedMintsCard from '~/features/home/components/ConnectedMintsCard';
import NostrActivity from '~/features/home/components/NostrActivity';
import { useAuthStore } from '~/state/authStore';
import { useRouter, type Href } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
const LazyBitcoinPriceCard = React.lazy(
  () => import('~/features/home/components/BitcoinPriceCard'),
);

const LazySupportView = React.lazy(() => import('~/features/home/components/SupportView'));

type StatusType = 'success' | 'error' | 'pending' | null;

/** Skeleton fallback shown while lazy components load */
function HomeSkeleton() {
  const pulseAnim = React.useRef(new Animated.Value(0.3)).current;

  React.useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.8,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 1200,
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  return (
    <YStack
      width="100%"
      height={300}
      bg="$buttonDefaultSecondary"
      rounded="$6"
      items="center"
      justify="center"
    >
      <Animated.View style={{ opacity: pulseAnim }}>
        <BeyIcon size={40} />
      </Animated.View>
    </YStack>
  );
}

export function HomeTabScreen() {
  const theme = useTheme();
  const router = useRouter();
  const pendingLightning = useLightningAddressStore((s) => s.pending.length);
  const queryClient = useQueryClient();
  const refreshBalance = useWalletStore((s) => s.refreshBalance);
  const error = useWalletStore((s) => s.error);
  const [refreshing, setRefreshing] = React.useState(false);
  const [showStatus, setShowStatus] = React.useState<StatusType>(null);
  const toast = useToastController();
  const { lock } = useAuthStore();

  React.useEffect(() => {
    // Load pending Nostr requests on mount so auto-claim matching works instantly
    const { useNostrRequestStore } = require('~/state/nostrRequestStore');
    useNostrRequestStore
      .getState()
      .loadPendingRequests()
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    if (error) {
      toast.show(error, { kind: 'error' });
    }
  }, [error]);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await Promise.all([
        refreshBalance(),
        queryClient.invalidateQueries({ queryKey: ['bitcoinPrice'] }),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [refreshBalance, queryClient]);

  if (showStatus) {
    return (
      <StatusScreen
        visible={true}
        type={showStatus}
        title={
          showStatus === 'success'
            ? 'Payment Sent!'
            : showStatus === 'error'
              ? 'Payment Failed'
              : 'Processing...'
        }
        message={
          showStatus === 'success'
            ? 'Your payment was sent successfully'
            : showStatus === 'error'
              ? 'Unable to complete the transaction'
              : 'Please wait while we process your payment'
        }
        amount="1,234"
        onClose={() => setShowStatus(null)}
        onAction={showStatus === 'success' ? () => setShowStatus(null) : undefined}
        actionLabel={showStatus === 'success' ? 'View Details' : undefined}
      />
    );
  }

  return (
    <ScrollView
      bg="$background"
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={String(theme.iconSecondary.val)}
          colors={[String(theme.iconSecondary.val)]}
          progressBackgroundColor={String(theme.background.val)}
        />
      }
    >
      <YStack flex={1} items="center" gap="$4" px="$4" pt="$2" pb="$20">
        {/* Above-the-fold: renders immediately */}
        <WalletCard />
        <ActionButtons />
        {pendingLightning > 0 && (
          <AppPressable
            width="100%"
            minHeight={56}
            rounded="$6"
            bg="$buttonDefaultSecondary"
            px="$4"
            py="$3"
            flexDirection="row"
            items="center"
            gap="$3"
            hoverStyle={{ bg: '$buttonDefaultSecondaryHover' }}
            pressStyle={{ bg: '$buttonDefaultSecondaryPress' }}
            accessibilityLabel={`Pending Lightning payments (${pendingLightning})`}
            accessibilityHint="View incoming Lightning payments awaiting collection"
            onPress={() => router.push('/(tabs)/settings/lightning-address-payments' as Href)}
          >
            <View width={24} items="center" justify="center" aria-hidden>
              <Zap size={22} color="$color" strokeWidth={1.8} />
            </View>
            <Text {...appTypography.label2} color="$color" flex={1}>
              {`Pending Lightning payments (${pendingLightning})`}
            </Text>
            <ChevronRight size={20} color="$gray10" aria-hidden />
          </AppPressable>
        )}
        <SupporterCard />

        <RestoreProgressCard />

        <BackupWarningCard />

        <ClaimUsernameCard />

        {/* Below-the-fold: lazy-loaded with skeleton shimmer */}
        <React.Suspense fallback={<HomeSkeleton />}>
          {/* <LazyBitcoinPriceCard /> */}
          <NostrActivity />
          <ConnectedMintsCard />

          {/* <LazySupportView /> */}
        </React.Suspense>
      </YStack>
    </ScrollView>
  );
}
