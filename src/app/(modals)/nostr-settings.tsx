import React, { useState } from 'react';
import { YStack, Text, XStack, Button, Separator, View, Input, ScrollView, useTheme, Image } from 'tamagui';
import { Key, Copy, Eye, EyeOff, Server, AlertTriangle, Plus, Trash2, ShieldAlert } from '@tamagui/lucide-icons';
import { Stack, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useToastController } from '@tamagui/toast';
import { biometricService } from '~/services/biometricService';
import { useSettingsStore } from '~/store/settingsStore';
import { SafeFlex } from '~/components/UI/Flex';

export default function NostrSettingsScreen() {
    const theme = useTheme();
    const toast = useToastController();
    const router = useRouter();
    const npub = useSettingsStore(state => state.npub);
    const nsec = useSettingsStore(state => state.nsec);
    const [isNsecVisible, setIsNsecVisible] = useState(false);

    // Placeholder for relays - these could later be persisted in a store
    const [relays, setRelays] = useState<string[]>([
        'wss://relay.damus.io',
        'wss://nos.lol',
    ]);
    const [newRelay, setNewRelay] = useState('');

    const handleCopy = async (text: string | null, type: 'npub' | 'nsec' | 'relay') => {
        if (!text) return;
        await Clipboard.setStringAsync(text);
        toast.show(`Copied ${type} to clipboard`);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    };

    const handleRevealNsec = async () => {
        if (isNsecVisible) {
            setIsNsecVisible(false);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            return;
        }

        const success = await biometricService.authenticateAsync('Authenticate to view your secret nsec');
        if (success) {
            setIsNsecVisible(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
    };

    const handleAddRelay = () => {
        if (newRelay && !relays.includes(newRelay)) {
            let url = newRelay.trim();
            if (!url.startsWith('wss://') && !url.startsWith('ws://')) {
                url = `wss://${url}`;
            }
            setRelays([...relays, url]);
            setNewRelay('');
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
    };

    const handleRemoveRelay = (relayToRemove: string) => {
        setRelays(relays.filter(r => r !== relayToRemove));
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const truncateKey = (str: string | null) => {
        if (!str || str.length < 24) return str;
        return `${str.slice(0, 16)}...${str.slice(-12)}`;
    };

    return (
        <SafeFlex fill bg="$background">
            <Stack.Screen options={{ headerTitle: 'Nostr Settings' }} />
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
                <YStack p="$4" gap="$5">
                    
                    {/* Header */}
                    <XStack items="center" gap="$3" py="$2">
                        <View p="$2" bg="white" rounded="$5">
                            <Image
                            src={require('../../assets/images/nostr-icon-black-transparent.png')}
                            width={36}
                            height={36}
                            resizeMode='contain'
                            alt=''
                            />
                        </View>
                        <YStack>
                            <Text fontSize="$5" fontWeight="900" color="$color">Nostr Keys</Text>
                            <Text fontSize="$2" color="$gray10">Manage your public and private credentials</Text>
                        </YStack>
                    </XStack>

                    {/* Keys Section */}
                    <YStack gap="$4">
                        {/* NPUB Card */}
                        <XStack
                            justify="space-between"
                            items="center"
                            width="100%"
                            bg="$gray3"
                            p="$4"
                            rounded="$6"
                            minH={70}
                        >
                            <XStack gap="$3" items="center" flex={1} mr="$2">
                                <Key size={20} color="$accent5" strokeWidth={2.5} />
                                <YStack flex={1} justify="center">
                                    <Text fontSize="$1" fontWeight="800" color="$gray10" textTransform="uppercase" mb="$1">
                                        Public Key (npub)
                                    </Text>
                                    <Text fontSize="$4" fontWeight="800" color="$accent5" numberOfLines={1}>
                                        {npub ? truncateKey(npub) : 'Loading...'}
                                    </Text>
                                </YStack>
                            </XStack>
                            <Button
                                size="$3"
                                circular
                                chromeless
                                icon={<Copy size={16} color="$accent5" strokeWidth={2.5} />}
                                onPress={() => handleCopy(npub, 'npub')}
                            />
                        </XStack>

                        {/* NSEC Card */}
                        <YStack gap="$2.5">
                            <XStack
                                justify="space-between"
                                items="center"
                                width="100%"
                                bg="$red3"
                                p="$4"
                                rounded="$6"
                                minH={70}
                            >
                                <XStack gap="$3" items="center" flex={1} mr="$2">
                                    <ShieldAlert size={20} color="$red10" strokeWidth={2.5} />
                                    <YStack flex={1} justify="center">
                                        <Text fontSize="$1" fontWeight="800" color="$red9" textTransform="uppercase" mb="$1">
                                            Secret Key (nsec)
                                        </Text>
                                        <Text
                                            fontSize={isNsecVisible ? "$2" : "$4"}
                                            fontWeight="800"
                                            color="$red10"
                                            numberOfLines={1}
                                            style={isNsecVisible ? { fontSize: 13 } : { lineHeight: 20 }}
                                        >
                                            {isNsecVisible ? truncateKey(nsec) : '••••••••••••••••••••••••••••••••'}
                                        </Text>
                                    </YStack>
                                </XStack>
                                <XStack gap="$1">
                                    {isNsecVisible && (
                                        <Button
                                            size="$3"
                                            circular
                                            chromeless
                                            icon={<Copy size={16} color="$red10" strokeWidth={2.5} />}
                                            onPress={() => handleCopy(nsec, 'nsec')}
                                        />
                                    )}
                                    <Button
                                        size="$3"
                                        circular
                                        chromeless
                                        icon={isNsecVisible ? <EyeOff size={16} color="$red10" strokeWidth={2.5} /> : <Eye size={16} color="$red10" strokeWidth={2.5} />}
                                        onPress={handleRevealNsec}
                                    />
                                </XStack>
                            </XStack>
                            <XStack gap="$2" items="center" px="$2">
                                <AlertTriangle size={14} color="$red10" />
                                <Text fontSize="$2" color="$red10" fontWeight="600">Never share your nsec with anyone.</Text>
                            </XStack>
                        </YStack>
                    </YStack>

                    <Separator borderColor="$borderColor" opacity={0.5} my="$2" />

                    {/* Relays Section */}
                    <YStack gap="$4">
                        <XStack items="center" gap="$3">
                            <View p="$2.5" bg="$accent4" rounded="$5">
                                <Server size={22} color="$accent10" strokeWidth={2.5} />
                            </View>
                            <YStack>
                                <Text fontSize="$5" fontWeight="900" color="$color">Relays</Text>
                                <Text fontSize="$2" color="$gray10">Connect to the decentralized Nostr network</Text>
                            </YStack>
                        </XStack>

                        {/* Add Relay Card (mimics DestinationInputRow) */}
                        <XStack
                            justify="space-between"
                            items="center"
                            width="100%"
                            bg="$gray3"
                            p="$4"
                            rounded="$6"
                            minH={70}
                        >
                            <XStack gap="$3" items="center" flex={1} mr="$2">
                                <Server size={20} color="$accent5" strokeWidth={2.5} />
                                <YStack flex={1} justify="center">
                                    <Text fontSize="$1" fontWeight="800" color="$gray10" textTransform="uppercase" mb="$1">
                                        Add New Relay
                                    </Text>
                                    <Input
                                        value={newRelay}
                                        onChangeText={setNewRelay}
                                        placeholder="wss://relay.damus.io"
                                        size="$3"
                                        borderWidth={0}
                                        bg="transparent"
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        color="$color"
                                        fontSize="$4"
                                        fontWeight={800}
                                        p={0}
                                        height={30}
                                        style={{ outlineStyle: 'none' }}
                                    />
                                </YStack>
                            </XStack>
                            <Button
                                size="$3"
                                circular
                                theme="accent"
                                icon={<Plus size={16} strokeWidth={2.5} />}
                                disabled={!newRelay}
                                onPress={handleAddRelay}
                            />
                        </XStack>

                        {/* Relay List */}
                        <YStack gap="$2.5" mt="$1">
                            {relays.map((relay) => (
                                <XStack
                                    key={relay}
                                    bg="$gray3"
                                    px="$4"
                                    py="$3.5"
                                    rounded="$6"
                                    items="center"
                                    justify="space-between"
                                >
                                    <XStack gap="$3" items="center" flex={1} mr="$2">
                                        <View width={6} height={6} rounded={3} bg="$green9" />
                                        <Text fontSize="$3" fontWeight="800" color="$color" numberOfLines={1} flex={1}>
                                            {relay}
                                        </Text>
                                    </XStack>
                                    <Button
                                        size="$3"
                                        circular
                                        chromeless
                                        icon={<Trash2 size={16} color="$red10" strokeWidth={2.5} />}
                                        onPress={() => handleRemoveRelay(relay)}
                                    />
                                </XStack>
                            ))}
                        </YStack>
                    </YStack>

                </YStack>
            </ScrollView>
        </SafeFlex>
    );
}
