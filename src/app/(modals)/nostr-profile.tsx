import React from 'react';
import { YStack, XStack, Text, Button, View, Separator, ScrollView } from 'tamagui';
import { Copy, Share as ShareIcon, AtSign, RefreshCw } from '@tamagui/lucide-icons';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { Share, InteractionManager } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useToastController } from '@tamagui/toast';
import { Spinner } from 'tamagui';
import Blockies from 'components/UI/Blockies';
import { useSettingsStore } from '~/store/settingsStore';
import { useTheme } from 'tamagui';
import { useNip05Lookup } from '~/hooks/useNip05Lookup';

export default function NostrProfileScreen() {
    const toast = useToastController();
    const npub = useSettingsStore(state => state.npub);
    const theme = useTheme();

    // Live NIP-05 lookup from bey.cash
    const { username, nip05, loading: nip05Loading, refresh } = useNip05Lookup();

    // Defer QR code rendering to avoid blocking navigation transition
    const [isQrReady, setIsQrReady] = React.useState(false);

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
    };

    const handleCopyNip05 = async () => {
        if (!nip05) return;
        await Clipboard.setStringAsync(nip05);
        toast.show("Copied Nostr address");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
        return `${str.slice(0, 8)}...${str.slice(-6)}`;
    };

    return (
        <ScrollView bg="$background" contentContainerStyle={{ p: '$4', items: 'center', gap: '$6', pt: '$2', pb: '$2' }}>

            {npub && isQrReady ? (
                <View
                    p="$5"
                    bg="white"
                    rounded="$6"
                    borderWidth={1}
                    borderColor="$borderColor"
                    shadowColor="$color"
                    shadowOpacity={0.1}
                    shadowRadius={10}
                    shadowOffset={{ width: 0, height: 4 }}
                >
                    <QRCode
                        value={npub}
                        size={300}
                        color="black"
                        backgroundColor="white"
                    />
                </View>
            ) : (
                <View
                    p="$4"
                    bg="$gray3"
                    rounded="$6"
                    width={330}
                    height={330}
                    items="center"
                    justify="center"
                >
                    <Spinner size="large" color="$accent10" />
                    <Text color="$gray10" fontWeight="600" mt="$4">
                        {!npub ? 'Generating npub...' : 'Loading QR Code...'}
                    </Text>
                </View>
            )}

            <YStack gap="$0" width="100%" mt="$0" bg="$gray2" rounded="$5" overflow="hidden" separator={<Separator borderColor="$borderColor" opacity={0.5} />}>
                {/* NIP-05 identity — show only if found */}
                {nip05 && (
                    <DetailItem
                        label="Nostr Address"
                        value={nip05}
                        isCopyable
                        copyValue={nip05}
                        onCopy={handleCopyNip05}
                        icon={<AtSign size={14} color="$accent10" />}
                    />
                )}

                {/* Display name */}
                <DetailItem
                    label="Profile Name"
                    value={username ? username : 'Bey Wallet User'}
                />

                <DetailItem label="Network" value="Nostr Protocol" />

                <DetailItem
                    label="Public Key"
                    value={formatNpub(npub)}
                    isCopyable
                    copyValue={npub || ''}
                    onCopy={handleCopy}
                    onPress={handleShare}
                />

                {/* Refresh NIP-05 lookup */}
                <XStack justify="center" py="$3" px="$4">
                    <Button
                        size="$3"
                        theme="gray"
                        chromeless
                        icon={<RefreshCw size={14} color="$gray10" />}
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            refresh();
                        }}
                        disabled={nip05Loading}
                        opacity={nip05Loading ? 0.5 : 1}
                    >
                        {nip05Loading ? 'Checking…' : 'Refresh Identity'}
                    </Button>
                </XStack>
            </YStack>
        </ScrollView>
    );
}

function DetailItem({
    label,
    value,
    isCopyable,
    copyValue,
    onCopy,
    onPress,
    icon
}: {
    label: string;
    value: string;
    isCopyable?: boolean;
    copyValue?: string;
    onCopy?: () => void;
    onPress?: () => void;
    icon?: React.ReactNode;
}) {
    return (
        <XStack justify="space-between" items="center" py="$3" px="$4">
            <XStack gap="$2" items="center">
                {icon}
                <Text fontSize="$3" color="$gray10" fontWeight="600">{label}</Text>
            </XStack>
            <XStack gap="$2" items="center">
                <Text fontSize="$3" fontWeight="800" color="$color" numberOfLines={3} style={{ maxWidth: 200 }}>
                    {value}
                </Text>
                {onPress && (
                    <Button size="$2" chromeless icon={<ShareIcon size={16} color="$gray10" />} onPress={onPress} />
                )}
                {isCopyable && (
                    <Button size="$2" chromeless icon={<Copy size={16} color="$gray10" />} onPress={onCopy} />
                )}
            </XStack>
        </XStack>
    );
}
