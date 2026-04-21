import React from 'react';
import { YStack, XStack, Text, Button, View, Separator, ScrollView } from 'tamagui';
import { Copy, Share as ShareIcon } from '@tamagui/lucide-icons';
import QRCodeStyled from 'react-native-qrcode-styled';
import * as Clipboard from 'expo-clipboard';
import { Share } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useToastController } from '@tamagui/toast';
import Blockies from 'components/UI/Blockies';
import { useSettingsStore } from '~/store/settingsStore';
import { useTheme } from 'tamagui';

export default function NostrProfileScreen() {
    const toast = useToastController();
    const npub = useSettingsStore(state => state.npub);

    const handleCopy = async () => {
        if (!npub) return;
        await Clipboard.setStringAsync(npub);
        toast.show("Copied npub to clipboard");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    };

    const handleShare = async () => {
        if (!npub) return;
        try {
            await Share.share({
                message: npub,
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

    const theme = useTheme();

    return (
        <ScrollView bg="$background" contentContainerStyle={{ p: '$4', items: 'center', gap: '$6', pt: '$2', pb: '$2' }}>

            {npub ? (
                <View
                    p="$2"
                    bg="$background"
                    rounded="$7"
                    borderWidth={1}
                    borderColor="$borderColor"


                >
                    <QRCodeStyled
                        data={npub}
                        size={310}
                        padding={10}
                        color={theme.color.val}
                        pieceSize={6}
                        pieceCornerType="rounded"
                        pieceBorderRadius={4}
                        isPiecesGlued
                        outerEyesOptions={{
                            borderRadius: 12,
                        }}
                        innerEyesOptions={{
                            borderRadius: 6,
                        }}
                    />
                </View>
            ) : (
                <View
                    p="$4"
                    bg="$gray3"
                    rounded="$6"
                    width={260}
                    height={260}
                    items="center"
                    justify="center"
                >
                    <Text color="$gray10" fontWeight="600">Generating npub...</Text>
                </View>
            )}

            {/* <XStack gap="$4" width="100%" px="$2">
                <Button
                    flex={1}
                    size="$5"
                    theme="gray"
                    fontWeight="800"
                    icon={<Copy size={20} />}
                    onPress={handleCopy}
                    disabled={!npub}
                >
                    Copy NPUB
                </Button>
                <Button
                    flex={1}
                    size="$5"
                    theme="accent"
                    fontWeight="800"
                    icon={<ShareIcon size={20} />}
                    onPress={handleShare}
                    disabled={!npub}
                >
                    Share
                </Button>
            </XStack> */}

            <YStack gap="$0" width="100%" mt="$0" bg="$gray2" rounded="$5" overflow="hidden" separator={<Separator borderColor="$borderColor" opacity={0.5} />}>
                <DetailItem label="Profile Name" value="Bey Wallet User" />
                <DetailItem label="Network" value="Nostr Protocol" />
                <DetailItem label="Public Key" value={formatNpub(npub)} isCopyable copyValue={npub || ''} onCopy={handleCopy} onPress={handleShare} />

            </YStack>
        </ScrollView>
    );
}

function DetailItem({ label, value, isCopyable, copyValue, onCopy, onPress }: { label: string, value: string, isCopyable?: boolean, copyValue?: string, onCopy?: () => void, onPress?: () => void }) {
    return (
        <XStack justify="space-between" items="center" py="$3" px="$4">
            <Text fontSize="$3" color="$gray10" fontWeight="600">{label}</Text>
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
