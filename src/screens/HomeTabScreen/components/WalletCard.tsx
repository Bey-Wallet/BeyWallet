import React, { useEffect, useState } from "react";
import { Text, YStack, XStack, View } from "tamagui";
import Balance from "./Balance";
import Blockies from "components/UI/Blockies";
import { Copy, AtSign, Check } from "@tamagui/lucide-icons";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { useSettingsStore } from "~/store/settingsStore";
import { useWalletStore } from "~/store/walletStore";
import { Animated, Easing } from "react-native";
import { useNip05Lookup } from "~/hooks/useNip05Lookup";

export default function WalletCard() {
  const npub = useSettingsStore((state) => state.npub);
  const { isRestoring } = useWalletStore();
  const router = useRouter();

  // Live NIP-05 lookup from bey.cash
  const { username, nip05, loading: nip05Loading } = useNip05Lookup();

  const [countdown, setCountdown] = useState(2);
  const spin = React.useRef(new Animated.Value(0)).current;
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isRestoring) {
      setCountdown(2);
      Animated.loop(
        Animated.timing(spin, {
          toValue: 1,
          duration: 1200,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ).start();
      const interval = setInterval(() => {
        setCountdown((c) => Math.max(0, c - 1));
      }, 1000);
      return () => clearInterval(interval);
    } else {
      spin.stopAnimation();
      Animated.spring(spin, { toValue: 0, useNativeDriver: true }).start();
    }
  }, [isRestoring]);

  const handleCopy = async () => {
    const value = nip05 || npub;
    if (!value) return;
    await Clipboard.setStringAsync(value);
    setCopied(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

  const truncateNpub = (str: string) => {
    if (!str || str.length < 15) return str;
    return `${str.slice(0, 9)}...${str.slice(-9)}`;
  };

  return (
    <YStack width={"100%"} gap="$2">
      <Balance />
      <YStack justify="center">
        <XStack
          items="center"
          justify="center"
          gap="$2"
          pressStyle={npub ? { opacity: 0.7 } : undefined}
          onPress={npub ? handleCopy : undefined}
        >
          {username ? (
            <Text
              fontSize="$6"
              fontWeight="700"
              color={copied ? "$accent5" : "$orange10"}
              numberOfLines={1}
            >
              {username}
              <Text
                fontSize="$6"
                fontWeight="700"
                color="$accent5"
                numberOfLines={1}
              >
                @bey.cash
              </Text>
            </Text>
          ) : (
            <Text
              fontSize="$5"
              fontVariant={["tabular-nums"]}
              fontWeight="700"
              color="$accent5"
              numberOfLines={1}
            >
              {npub ? truncateNpub(npub) : "Bey Wallet"}
            </Text>
          )}
          {npub && (
            copied ? (
              <Check size={14} strokeWidth={2.5} color="$accent5" />
            ) : (
              <Copy size={14} strokeWidth={2.5} color="$accent5" />
            )
          )}
        </XStack>
      </YStack>

      {/* <XStack gap="$2" items="center" justify="space-between">
                <XStack gap="$2" items="center">
                  
                    <XStack
                        pressStyle={{ opacity: 0.7, scale: 0.95 }}
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            router.push('/(modals)/nostr-profile');
                        }}
                    >
                        <Blockies
                            style={{ borderRadius: 3 }}
                            seed={npub || "bey-wallet"}
                            size={10}
                            scale={4}
                        />
                    </XStack>

              
                    <YStack justify="center">
                        <XStack
                            gap="$1.5"
                            items="center"
                            pressStyle={{ opacity: 0.7 }}
                            onPress={handleCopy}
                        >

                            <YStack justify='center' >
                                <XStack items='center' gap="$2">
                                    {username ? (
                                      
                                        <Text fontSize="$6" fontWeight="700" color="$accent4" numberOfLines={1}>
                                            {username}
                                            <Text fontSize="$6" fontWeight="700" color="$accent10" numberOfLines={1}>
                                                @bey.cash
                                            </Text>
                                        </Text>
                                    ) : (
                                        
                                        <Text fontSize="$5" fontVariant={['tabular-nums']} fontWeight="700" color="$accent5" numberOfLines={1}>
                                            {npub ? truncateNpub(npub) : 'Bey Wallet'}
                                        </Text>
                                    )}
                                    {npub && <Copy size={14} strokeWidth={2.5} color="$accent5" />}
                                </XStack>
                            </YStack>
                        </XStack>
                     

                    </YStack>
                </XStack>
            </XStack> */}
    </YStack>
  );
}
