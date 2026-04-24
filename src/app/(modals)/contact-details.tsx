import React from 'react';
import { YStack, XStack, Text, Button, ScrollView, Separator, useTheme } from 'tamagui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Copy, Heart, Send, ArrowDownLeft, Activity, Share as ShareIcon } from '@tamagui/lucide-icons';
import { Share } from 'react-native';
import * as Linking from 'expo-linking';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useToastController } from '@tamagui/toast';
import Blockies from '~/components/UI/Blockies';
import { useContactsStore } from '~/store/contactsStore';

export default function ContactDetailsScreen() {
    const { npub, username } = useLocalSearchParams<{ npub: string; username?: string }>();
    const theme = useTheme();
    const toast = useToastController();
    const router = useRouter();

    const { addFavorite, removeFavorite, isFavorite } = useContactsStore();
    const favorite = isFavorite(npub || '');

    const handleCopyNpub = async () => {
        if (!npub) return;
        await Clipboard.setStringAsync(npub);
        toast.show("Copied npub to clipboard");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    };

    const toggleFavorite = () => {
        if (!npub) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (favorite) {
            removeFavorite(npub);
            toast.show("Removed from favorites");
        } else {
            addFavorite({ npub, username: username || null, isFavorite: true });
            toast.show("Added to favorites");
        }
    };

    const handleSend = () => {
        router.push({
            pathname: '/(modals)/send',
            params: { to: npub, username: username || '' }
        });
    };

    const handleRequest = () => {
        router.push({
            pathname: '/(modals)/receive',
            params: { from: npub, username: username || '' }
        });
    };

    const handleShare = async () => {
        if (!npub) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        // Construct the intent link dynamically to work in both Expo Go and Prod
        const intentLink = Linking.createURL('/(modals)/contact-details', {
            queryParams: {
                npub: npub,
                ...(username ? { username: username } : {})
            }
        });

        // Copy to clipboard
        await Clipboard.setStringAsync(intentLink);
        toast.show("Link copied to clipboard");

        // Open Share sheet
        try {
            await Share.share({
                message: `Check out this profile on Bey Wallet: \n${intentLink}`,
                url: intentLink,
            });
        } catch (error: any) {
            console.error("Error sharing contact:", error.message);
        }
    };

    if (!npub) return <Text p="$4">Invalid Contact</Text>;

    const displayUsername = username ? `${username}@bey.cash` : 'Unknown User';

    return (
        <ScrollView f={1} bg="$background" contentContainerStyle={{ p: '$4', gap: '$6' }}>
            {/* Header / Identity */}
            <YStack items="center" gap="$4" pt="$4">
                <Blockies seed={npub} size={12} scale={6} style={{ borderRadius: 7 }} />

                <YStack items="center" gap="$1">
                    <Text fontSize="$7" fontWeight="bold" color="$color">
                        {displayUsername}
                    </Text>
                    <XStack items="center" gap="$2" cursor="pointer" onPress={handleCopyNpub}>
                        <Text fontSize="$4" color="$gray10" numberOfLines={1} style={{ maxWidth: 200 }}>
                            {`${npub.slice(0, 12)}...${npub.slice(-10)}`}
                        </Text>
                        <Copy size={14} color="$gray10" />
                    </XStack>
                </YStack>
            </YStack>

            {/* Action Buttons */}
            <XStack justify="space-evenly" py="$2">
                <YStack items="center" gap="$2">
                    <Button
                        size="$5"
                        circular
                        bg="$gray4"
                        icon={<Send size={20} color="$color" />}
                        onPress={handleSend}
                    />
                    <Text fontSize="$3" color="$gray10">Send</Text>
                </YStack>

                <YStack items="center" gap="$2">
                    <Button
                        size="$5"
                        circular
                        bg="$gray4"
                        icon={<ArrowDownLeft size={20} color="$color" />}
                        onPress={handleRequest}
                    />
                    <Text fontSize="$3" color="$gray10">Request</Text>
                </YStack>

                <YStack items="center" gap="$2">
                    <Button
                        size="$5"
                        circular
                        bg={favorite ? '$red4' : '$gray4'}
                        icon={<Heart size={20} color={favorite ? '$red10' : '$color'} fill={favorite ? theme.red10.val : 'transparent'} />}
                        onPress={toggleFavorite}
                    />
                    <Text fontSize="$3" color="$gray10">{favorite ? 'Favorited' : 'Favorite'}</Text>
                </YStack>

                <YStack items="center" gap="$2">
                    <Button
                        size="$5"
                        circular
                        bg="$gray4"
                        icon={<ShareIcon size={20} color="$color" />}
                        onPress={handleShare}
                    />
                    <Text fontSize="$3" color="$gray10">Share</Text>
                </YStack>
            </XStack>

            <Separator borderColor="$borderColor" opacity={0.5} />

            {/* Activity Section */}
            <YStack gap="$4">
                <Text fontSize="$5" fontWeight="600" color="$color">
                    Activity
                </Text>
                <YStack bg="$gray2" p="$6" rounded="$5" items="center" justify="center" gap="$3" minHeight={150}>
                    <Activity size={32} color="$gray8" />
                    <Text color="$gray10" textAlign="center">
                        No recent activity with this contact.
                    </Text>
                </YStack>
            </YStack>

        </ScrollView>
    );
}
