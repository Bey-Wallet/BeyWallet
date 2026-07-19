import React from 'react';
import { YStack, XStack, Text, Button, View, Spinner, Separator, ScrollView } from 'tamagui';
import { Copy, AtSign, RefreshCw, ChevronLeft, Scan, Check } from '@tamagui/lucide-icons';
import Blockies from '~/components/UI/Blockies';
import { CustomQRCode } from '../../components/UI/CustomQRCode';
import * as Clipboard from 'expo-clipboard';
import { Share, InteractionManager } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useToastController } from '@tamagui/toast';
import { useSettingsStore } from '~/store/settingsStore';
import { useNip05Lookup } from '~/hooks/useNip05Lookup';
import { useRouter, Stack } from 'expo-router';
import BeyIcon from '~/components/icons/BeyIcon';
import { Flex } from '~/components/UI/Flex';

export default function NostrProfileScreen() {
    const router = useRouter();
    const toast = useToastController();
    const npub = useSettingsStore(state => state.npub);

    // Live NIP-05 lookup from bey.cash
    const { username, nip05, loading: nip05Loading, refresh } = useNip05Lookup();

    // Defer QR code rendering to avoid blocking navigation transition
    const [isQrReady, setIsQrReady] = React.useState(false);
    const [copied, setCopied] = React.useState(false);
    const [copiedNip05, setCopiedNip05] = React.useState(false);

    React.useEffect(() => {
        const task = InteractionManager.runAfterInteractions(() => {
            setIsQrReady(true);
        });
        return () => task.cancel();
    }, []);

    const handleCopy = async () => {
        if (!npub) return;
        await Clipboard.setStringAsync(npub);
        toast.show("Copied npub to clipboard");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleCopyNip05 = async () => {
        if (!nip05) return;
        await Clipboard.setStringAsync(nip05);
        toast.show("Copied Nostr address");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setCopiedNip05(true);
        setTimeout(() => setCopiedNip05(false), 2000);
    };

    const handleShare = async () => {
        if (!npub) return;
        try {
            const shareMessage = nip05 ? `${nip05}\n${npub}` : npub;
            await Share.share({
                message: shareMessage,
            });
        } catch (error: any) {
            console.error("Error sharing npub:", error.message);
        }
    };

    // Helper to format npub like npub1...xyz
    const formatNpub = (str: string | null) => {
        if (!str) return '';
        if (str.length < 20) return str;
        return `${str.slice(0, 10)}...${str.slice(-6)}`;
    };

    return (
        <YStack flex={1} justify="space-between">
            <Stack.Screen
                options={{
                    headerShown: true,

                    headerShadowVisible: false,
                    headerTitleAlign: 'center',

                    headerTitle: () => (
                        <XStack gap="$2" items="center" justify="center">
                            <Text fontSize={18} fontWeight="700" color="$accent4">
                                {username ? username : 'Bey Wallet User'}
                            </Text>
                            <Button
                                size="$2"
                                circular
                                chromeless
                                icon={nip05Loading ? <Spinner size="small" /> : <RefreshCw size={14} />}
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    refresh();
                                }}
                                disabled={nip05Loading}
                            />
                        </XStack>
                    ),
                    headerRight: () => (
                        <Button
                            size="$3.5"
                            circular

                            pressStyle={{ opacity: 0.8 }}
                            icon={<Scan size={20} />}
                            onPress={() => router.push({ pathname: '/(modals)/scanner' })}
                        />
                    ),
                }}
            />
<Flex>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 16, paddingTop: 16, gap: 16 }}>
                {/* Main content */}
                <YStack items="center" gap="$5" flex={1} justify="center">

                    {/* QR Code card */}
                    {npub && isQrReady ? (
                        <View borderWidth={1} borderColor="$gray4" rounded="$6">
                            <CustomQRCode
                                value={npub}
                                size={350}
                                logo={true}
                                logoSize={50}
                                dotShape="circle"
                                finderStyle="rounded"
                            />
                        </View>
                    ) : (
                        <View
                            p="$4"
                            bg="$gray3"
                            rounded="$7"
                            width={350}
                            height={350}
                            items="center"
                            justify="center"
                        >
                            <Spinner size="large" color="$accent10" />
                            <Text color="$gray10" fontWeight="600" mt="$4">
                                {!npub ? 'Generating npub...' : 'Loading QR Code...'}
                            </Text>
                        </View>
                    )}
                </YStack>

                {/* Profile Identity Details Card */}
                <YStack
                    bg="$gray2"
                    rounded="$5"
                    p="$4"
                    gap="$4"
                    mb="$4"
                >
                    {/* Nostr Address (NIP-05) Row - Conditionally Rendered */}
                    {nip05 && (
                        <YStack gap="$3">
                            <XStack
                                justify="space-between"
                                items="center"
                                onPress={handleCopyNip05}
                                pressStyle={{ opacity: 0.7 }}
                            >
                                <YStack gap="$1.5" flex={1}>
                                    <Text fontSize="$2" color="$gray10" fontWeight="600">
                                        Nostr Address
                                    </Text>
                                    <XStack gap="$3" items="center">
                                        <Blockies seed={npub || 'Bey Wallet'} size={10} scale={3.5} style={{ borderRadius: 6 }} />
                                        <YStack flex={1}>
                                            <Text fontSize="$4" fontWeight="700">
                                                {nip05}
                                            </Text>
                                            <Text fontSize="$1" color="$gray9">
                                                Tap to copy address
                                            </Text>
                                        </YStack>
                                    </XStack>
                                </YStack>
                                {copiedNip05 ? (
                                    <Check size={18} color="$accent10" />
                                ) : (
                                    <Copy size={18} color="$gray10" />
                                )}
                            </XStack>
                            <Separator borderColor="$borderColor" opacity={0.5} mt="$2" />
                        </YStack>
                    )}

                    {/* Public Key (npub) Row */}
                    {npub && (
                        <XStack
                            justify="space-between"
                            items="center"
                            onPress={handleCopy}
                            pressStyle={{ opacity: 0.7 }}
                        >
                            <YStack gap="$1.5" flex={1} mr="$3">
                                <Text fontSize="$2" color="$gray10" fontWeight="600">
                                    Public Key (npub)
                                </Text>
                                <Text fontSize="$3" color="$accent4" fontWeight="600" style={{ wordBreak: 'break-all' } as any}>
                                    {npub}
                                </Text>
                                <Text fontSize="$1" color="$gray9">
                                    Tap to copy public key
                                </Text>
                            </YStack>
                            {copied ? (
                                <Check size={18} color="$accent10" />
                            ) : (
                                <Copy size={18} color="$gray10" />
                            )}
                        </XStack>
                    )}
                </YStack>
            </ScrollView>

            {/* Bottom Actions */}
            <YStack gap="$3" px="$4" pb="$4" pt="$2" bg="$background">
                <Button
                    size="$5"
                    theme="accent"
                    fontWeight="800"
                    rounded="$5"
                    icon={<BeyIcon />}
                    onPress={handleShare}
                    pressStyle={{ scale: 0.98, bg: "$gray2" }}
                >
                    Share
                </Button>
            </YStack>
            </Flex>
        </YStack>
    );
}
