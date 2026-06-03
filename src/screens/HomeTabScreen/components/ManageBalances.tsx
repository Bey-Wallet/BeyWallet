import React, { useMemo } from "react";
import {
  View,
  Text,
  YStack,
  XStack,
  H4,
  H6,
  Image,
  styled,
  H5,
  useThemeName,
} from "tamagui";
import { ChevronRight } from "@tamagui/lucide-icons";
import { RollingNumber } from "~/components/UI/RollingNumber";
import { useRouter } from "expo-router";
import { useWalletStore } from "~/store/walletStore";
import { useNostrInboxStore } from "~/store/nostrInboxStore";
import { useSettingsStore } from "~/store/settingsStore";
import { useQuery } from "@tanstack/react-query";
import { historyService } from "~/services/core";
import * as Haptics from "expo-haptics";
import { useAppTheme } from "~/context/ThemeContext";

const nostrIconWhite = require("../../../assets/images/nostr-icon-white-transparent.png");
const nostrIconBlack = require("../../../assets/images/nostr-icon-black-transparent.png");

interface BalanceItem {
  id: string;
  title: string;
  value: number | string;
  imageSource: any;
  onPress?: () => void;
  isComingSoon?: boolean;
}

const RowContainer = styled(XStack, {
  items: "center",
  justify: "space-between",
  gap: "$2",
  pressStyle: { opacity: 0.7 },
});

interface BalanceRowProps {
  item: BalanceItem;
  trigger?: any;
}

const BalanceRow = ({ item, trigger }: BalanceRowProps) => {
  const { title, value, imageSource, onPress, isComingSoon } = item;
  const { hideBalance } = useSettingsStore();

  const displayValue = React.useMemo(() => {
    if (isComingSoon) return "NA";
    if (hideBalance) return "****";
    return value;
  }, [isComingSoon, hideBalance, value]);

  const currentTrigger = React.useMemo(() => {
    return `${trigger}_${hideBalance ? "hidden" : "visible"}`;
  }, [trigger, hideBalance]);

  return (
    <RowContainer
      onPress={() => {
        if (onPress) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          onPress();
        }
      }}
      opacity={isComingSoon ? 0.5 : 1}
      disabled={isComingSoon}
    >
      <XStack items="center" gap="$2">
        <Image
          source={imageSource}
          alt={title}
          rounded="$2"
          bg={item.title === "Nostr" ? "$purple10" : "transparent"}
          width={45}
          height={45}
        />
        <H6 color="$accent4" textTransform="uppercase">
          {title}
        </H6>
        {!isComingSoon && (
          <ChevronRight size={20} strokeWidth={3} color="$accent9" />
        )}
      </XStack>

      <YStack>
        <RollingNumber
          letterSpacing={-1}
          fontSize={20}
          fontWeight="900"
          color="$accent4"
          decimalOpacity={0.4}
          showDecimals={false}
          prefix={(isComingSoon || hideBalance) ? "" : "₿"}
          trigger={currentTrigger}
        >
          {displayValue}
        </RollingNumber>
      </YStack>
    </RowContainer>
  );
};

const ManageBalances = () => {
  const router = useRouter();
  const balances = useWalletStore((s) => s.balances);
  const refreshCounter = useWalletStore((s) => s.refreshCounter);
  const themeName = useThemeName();
  const nostrItems = useNostrInboxStore((s) => s.items);
  const { resolvedTheme } = useAppTheme();

  const { data: history = [] } = useQuery({
    queryKey: ["history", "pending"],
    queryFn: async () => {
      const entries = await historyService.getHistory(50, 0);
      return entries.filter(
        (e: any) => e.state === "pending" || e.state === "unclaimed",
      );
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  const totalSpendable = useMemo(() => {
    return Object.values(balances).reduce((sum, b) => sum + b, 0);
  }, [balances]);

  const totalPending = useMemo(() => {
    return history.reduce((sum, e) => sum + (e.amount || 0), 0);
  }, [history]);

  const totalNostrUnclaimed = useMemo(() => {
    return nostrItems
      .filter((i) => i.status === "pending" || i.status === "failed")
      .reduce((sum, i) => sum + i.amount, 0);
  }, [nostrItems]);

  const balanceData: BalanceItem[] = [
    {
      id: "ecash",
      title: "E-Cash",
      value: totalPending,
      imageSource: require("../../../assets/images/Cashu.jpg"),
      onPress: () => router.push("/(modals)/ecash"),
    },
    {
      id: "mints",
      title: "Mints",
      value: totalSpendable,
      imageSource: require("../../../assets/images/Mint.png"),
      onPress: () => router.push("/(modals)/mints"),
    },
    {
      id: "nostr",
      title: "Nostr",
      value: totalNostrUnclaimed,
      imageSource: nostrIconWhite,
      onPress: () => router.push("/(modals)/nostr-activity"),
    },
    {
      id: "bitcoin",
      title: "Bitcoin LN",
      value: 0,
      imageSource: require("../../../assets/images/Bitcoin.png"),
      isComingSoon: true,
    },
  ];

  return (
    <YStack
      width="100%"
      gap="$4"
      p="$2.5"
      pr="$4"
      rounded="$5"
      bg={resolvedTheme === "dark" ? "$color2" : "$white"}
    >
      <XStack>
        <H6 color="$gray10">Manage Balances</H6>
      </XStack>
      <YStack gap="$3">
        {balanceData.map((item) => (
          <BalanceRow key={item.id} item={item} trigger={refreshCounter} />
        ))}
      </YStack>
    </YStack>
  );
};

export default ManageBalances;
