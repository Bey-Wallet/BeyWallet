import { RefreshControl, Animated } from "react-native";
import { YStack, ScrollView, Button } from "tamagui";
import * as Haptics from "expo-haptics";
import { useToastController } from "@tamagui/toast";
import WalletCard from "./components/WalletCard";
import ActionButtons from "./components/ActionButtons";
import { useWalletStore } from "../../store/walletStore";
import React from "react";
import StatusScreen from "../../components/StatusScreen";
import BeyIcon from "~/components/icons/BeyIcon";

// Lazy-load below-the-fold components — they mount AFTER the above-fold
// content (WalletCard + ActionButtons) is already painted, so the user
// sees the critical content instantly.
import ManageBalances from "./components/ManageBalances";
import NostrActivity from "./components/NostrActivity";
import { NostrClaimSheet } from "../../components/NostrClaimSheet";
import { ArrowRight } from "@tamagui/lucide-icons";
import { useAuthStore } from "~/store/authStore";
const LazyBitcoinPriceCard = React.lazy(
  () => import("./components/BitcoinPriceCard"),
);

const LazySupportView = React.lazy(() => import("./components/SupportView"));

type StatusType = "success" | "error" | "pending" | null;

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
      bg="$gray2"
      rounded="$5"
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
  const refreshBalance = useWalletStore((s) => s.refreshBalance);
  const error = useWalletStore((s) => s.error);
  const [refreshing, setRefreshing] = React.useState(false);
  const [showStatus, setShowStatus] = React.useState<StatusType>(null);
  const toast = useToastController();
  const { lock } = useAuthStore();

  React.useEffect(() => {
    // Load pending Nostr requests on mount so auto-claim matching works instantly
    const { useNostrRequestStore } = require("../../store/nostrRequestStore");
    useNostrRequestStore.getState().loadPendingRequests().catch(() => {});
  }, []);

  React.useEffect(() => {
    if (error) {
      toast.show("Error", { message: error });
    }
  }, [error]);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await refreshBalance();
    } finally {
      setRefreshing(false);
    }
  }, [refreshBalance]);

  if (showStatus) {
    return (
      <StatusScreen
        visible={true}
        type={showStatus}
        title={
          showStatus === "success"
            ? "Payment Sent!"
            : showStatus === "error"
              ? "Payment Failed"
              : "Processing..."
        }
        message={
          showStatus === "success"
            ? "Your payment was sent successfully"
            : showStatus === "error"
              ? "Unable to complete the transaction"
              : "Please wait while we process your payment"
        }
        amount="1,234"
        onClose={() => setShowStatus(null)}
        onAction={
          showStatus === "success" ? () => setShowStatus(null) : undefined
        }
        actionLabel={showStatus === "success" ? "View Details" : undefined}
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
          tintColor="#FFD700"
        />
      }
    >
      <YStack flex={1} items="center" gap="$4" px="$4" pt="$2" pb="$20">
        {/* Above-the-fold: renders immediately */}
        <WalletCard />
        <ActionButtons />

        {/* Below-the-fold: lazy-loaded with skeleton shimmer */}
        <React.Suspense fallback={<HomeSkeleton />}>
          {/* <LazyBitcoinPriceCard /> */}
          <NostrActivity />
          <ManageBalances />

          {/* <LazySupportView /> */}
        </React.Suspense>
      </YStack>

      {/* Global Nostr claim sheet — listens for incoming payments */}
      <NostrClaimSheet />
    </ScrollView>
  );
}
