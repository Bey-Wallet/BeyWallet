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
import { Flex, SafeFlex } from '~/components/UI/Flex';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ContactDetailsScreen() {
    const { npub, username } = useLocalSearchParams<{ npub: string; username?: string }>();
    if (!npub) return <Text p="$4">Invalid Contact</Text>;
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
            params: { to: npub, username: username || '', mode: 'nostr' }
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
      const insets = useSafeAreaInsets()

    const displayUsername = username ? `${username}@bey.cash` : '';

    return (
      <Flex fill bg="$background" pb={insets.bottom || 16}>

          
            <ScrollView f={1} contentContainerStyle={{ p: '$4', gap: '$6', paddingBottom: 100, height: '100%' }}>
                {/* Header / Identity */}
                <YStack items="center" gap="$4" pt="$4">
                    <Blockies seed={npub} size={12} scale={6} style={{ borderRadius: 7 }} />

                    <YStack items="center" gap="$1">
                        {displayUsername ? (
                            <Text fontSize="$7" fontWeight="bold" color="$color">
                                {displayUsername}
                            </Text>
                        ) : null}
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


            </ScrollView>

            {/* Floating Send Button */}
            <YStack
                position="absolute"
                bottom={insets.bottom + 16}
                left="$4"
                right="$4"
            >
                <Button
                    size="$5"
                    bg="$color"
                    color="$background"
                    fontWeight="bold"
                    icon={<Send size={20} color="$background" />}
                    onPress={handleSend}
                    rounded="$5"
                >
                    Send Ecash
                </Button>
            </YStack>
              </Flex>
    
    );
}
