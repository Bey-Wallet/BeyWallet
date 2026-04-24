import React, { useEffect, useState } from 'react';
import { Text, YStack, XStack, View } from "tamagui";
import Balance from "./Balance";
import Blockies from 'components/UI/Blockies';
import { Copy, AtSign } from "@tamagui/lucide-icons";
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { useToastController } from "@tamagui/toast";
import { useRouter } from "expo-router";
import { useSettingsStore } from "~/store/settingsStore";
import { useWalletStore } from "~/store/walletStore";
import { Animated, Easing } from 'react-native';
import { useNip05Lookup } from '~/hooks/useNip05Lookup';

export default function WalletCard() {
    const npub = useSettingsStore(state => state.npub);
    const { isRestoring } = useWalletStore();
    const toast = useToastController();
    const router = useRouter();

    // Live NIP-05 lookup from bey.cash
    const { username, nip05, loading: nip05Loading } = useNip05Lookup();

    const [countdown, setCountdown] = useState(2);
    const spin = React.useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (isRestoring) {
            setCountdown(2);
            Animated.loop(
                Animated.timing(spin, {
                    toValue: 1,
                    duration: 1200,
                    easing: Easing.linear,
                    useNativeDriver: true,
                })
            ).start();
            const interval = setInterval(() => {
                setCountdown(c => Math.max(0, c - 1));
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
        toast.show(nip05 ? 'Nostr address copied' : 'Copied npub to clipboard');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    };

    const truncateNpub = (str: string) => {
        if (!str || str.length < 15) return str;
        return `${str.slice(0, 9)}...${str.slice(-4)}`;
    };

    return (
        <YStack width={"100%"} gap="$2">
            <XStack gap="$2" items="center" justify="space-between">
                <XStack gap="$2" items="center">
                    {/* Avatar → nostr profile modal */}
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

                    {/* Identity display */}
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
                                        /* Show username@bey.cash when found */
                                        <Text fontSize="$6" fontWeight="700" color="$accent4" numberOfLines={1}>
                                            {username}
                                            <Text fontSize="$6" fontWeight="700" color="$accent10" numberOfLines={1}>
                                                @bey.cash
                                            </Text>
                                        </Text>
                                    ) : (
                                        /* No bey.cash username → show truncated npub */
                                        <Text fontSize="$4" fontWeight="700" color="$accent10" numberOfLines={1}>
                                            {npub ? truncateNpub(npub) : 'Bey Wallet'}
                                        </Text>
                                    )}
                                    {npub && <Copy size={14} color="$accent10" />}
                                </XStack>
                            </YStack>
                        </XStack>
                        {/* Show truncated npub beneath nip05 */}
                        {username && npub && (
                            <Text fontSize="$1" color="$gray9" mt="$0.5">
                                {truncateNpub(npub)}
                            </Text>
                        )}
                    </YStack>
                </XStack>
            </XStack>
            <Balance />
        </YStack>
    );
}