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
  Button,
} from "tamagui";
import { ChevronRight, Landmark } from "@tamagui/lucide-icons";
import { RollingNumber } from "~/components/UI/RollingNumber";
import { useRouter } from "expo-router";
import { useWalletStore } from "~/store/walletStore";
import { useNostrInboxStore } from "~/store/nostrInboxStore";
import { useSettingsStore } from "~/store/settingsStore";
import { useQuery } from "@tanstack/react-query";
import { historyService } from "~/services/core";
import * as Haptics from "expo-haptics";
import { useAppTheme } from "~/context/ThemeContext";
import { currencyService, CurrencyCode } from "~/services/currencyService";
import { bitcoinService } from "~/services/bitcoinService";

const nostrIconWhite = require("../../../assets/images/nostr-icon-white-transparent.png");
const nostrIconBlack = require("../../../assets/images/nostr-icon-black-transparent.png");

interface BalanceItem {
  id: string;
  title: string;
  value: number | string;
  imageSource?: any;
  icon?: React.ReactNode;
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
  const { id, title, value, imageSource, icon, onPress, isComingSoon } = item;
  const { primaryCurrency, secondaryCurrency, hideBalance, showBitcoinSymbol } = useSettingsStore();

  const isFiatEnabled = secondaryCurrency !== 'NONE';
  const displayAsSats = primaryCurrency === 'SATS' || !isFiatEnabled;

  const { data: btcData } = useQuery({
    queryKey: ["bitcoinPrice", secondaryCurrency],
    queryFn: () => isFiatEnabled ? bitcoinService.fetchPrice(secondaryCurrency) : Promise.resolve({ price: 0 }),
    staleTime: 30000,
    enabled: isFiatEnabled,
  });

  const displayValue = React.useMemo(() => {
    if (isComingSoon) return "NA";
    if (hideBalance) return "****";

    if (!displayAsSats && typeof value === 'number') {
      if (!btcData?.price) return '...';
      const fiat = currencyService.convertSatsToCurrency(value, btcData.price);
      return currencyService.formatValue(fiat, secondaryCurrency as CurrencyCode);
    }

    return value;
  }, [isComingSoon, hideBalance, value, displayAsSats, secondaryCurrency, btcData?.price]);

  const currentTrigger = React.useMemo(() => {
    return `${trigger}_${hideBalance ? "hidden" : "visible"}_${displayAsSats ? "SATS" : "FIAT"}`;
  }, [trigger, hideBalance, displayAsSats]);

  const prefix = React.useMemo(() => {
    if (isComingSoon || hideBalance) return "";
    if (!displayAsSats) return ""; // formatted currency already includes symbol
    return showBitcoinSymbol ? "₿" : "";
  }, [isComingSoon, hideBalance, displayAsSats, showBitcoinSymbol]);

  const suffix = React.useMemo(() => {
    if (isComingSoon || hideBalance) return "";
    if (!displayAsSats) return "";
    return showBitcoinSymbol ? "" : " SATS";
  }, [isComingSoon, hideBalance, displayAsSats, showBitcoinSymbol]);

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
        {icon ? (
          icon
        ) : (
          <Image
            source={imageSource}
            alt={title}
            rounded="$2"
            bg={item.title === "Nostr" ? "$purple10" : "transparent"}
            width={45}
            height={45}
          />
        )}
        <H6 color="$accent4" textTransform="uppercase">
          {title}
        </H6>
        {!isComingSoon && (
          <ChevronRight size={20} strokeWidth={3} color="$accent9" />
        )}
      </XStack>

      {id === "nostr" || id === "bitcoin" ? (
        <Button
          onPress={() => {
            if (onPress) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              onPress();
            }
          }}
          size="$3"
          theme="gray"
          fontWeight={800}
          rounded={200}
          disabled={id === "bitcoin"}
        >

          {id === "nostr" ? "Open" : "Soon"}

        </Button>
      ) : (
        <YStack>
          <RollingNumber
            fontSize={16}
            fontWeight="900"
            color="$accent4"
            decimalOpacity={0.4}
            showDecimals={!displayAsSats}
            prefix={prefix}
            suffix={suffix}
            trigger={currentTrigger + `_${showBitcoinSymbol}`}
          >
            {displayValue}
          </RollingNumber>
        </YStack>
      )
      }
    </RowContainer >
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
      id: "mints",
      title: "Mints",
      value: totalSpendable,
      icon: (
        <View
          width={45}
          height={45}
          rounded="$2"
          bg="#C1FF72"
          items="center"
          justify="center"
        >
          <Landmark size={24} strokeWidth={2.5} color="black" />
        </View>
      ),
      onPress: () => router.push("/(modals)/mints"),
    },
    {
      id: "ecash",
      title: "E-Cash",
      value: totalPending,
      imageSource: require("../../../assets/images/Cashu.jpg"),
      onPress: () => router.push("/(modals)/ecash"),
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
      bg={"$color2"}
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
