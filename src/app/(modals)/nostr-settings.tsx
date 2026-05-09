import React, { useState } from 'react';
import { YStack, Text, XStack, Button, Separator, View, Input, ScrollView } from 'tamagui';
import { Key, Copy, Eye, EyeOff, Server, AlertTriangle, Plus, Trash2 } from '@tamagui/lucide-icons';
import { Stack, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useToastController } from '@tamagui/toast';
import { biometricService } from '~/services/biometricService';
import { useSettingsStore } from '~/store/settingsStore';

export default function NostrSettingsScreen() {
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

    const handleCopy = async (text: string | null, type: 'npub' | 'nsec') => {
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
        if (!str || str.length < 20) return str;
        return `${str.slice(0, 12)}...${str.slice(-8)}`;
    };

    return (
        <YStack flex={1} bg="$background">
            <Stack.Screen options={{ headerTitle: 'Nostr Settings' }} />
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
                <YStack p="$4" gap="$6" pb="$10">
                    <XStack items="center" gap="$3">
                        <View p="$2" bg="$accent3" rounded="$4">
                            <Key size={24} color="$accent10" />
                        </View>
                        <Text fontSize="$6" fontWeight="800">Your Nostr Identity</Text>
                    </XStack>

                    {/* Keys Section */}
                    <YStack gap="$4">
                        {/* NPUB */}
                        <YStack gap="$2">
                            <Text fontSize="$3" color="$gray10" fontWeight="600">Public Key (npub)</Text>
                            <XStack
                                bg="$gray2"
                                p="$3"
                                rounded="$4"
                                items="center"
                                justify="space-between"
                                borderWidth={1}
                                borderColor="$borderColor"
                            >
                                <Text fontSize="$3" fontWeight="500" color="$color" numberOfLines={1} flex={1}>
                                    {npub ? truncateKey(npub) : 'Loading...'}
                                </Text>
                                <Button size="$3" chromeless icon={<Copy size={18} />} onPress={() => handleCopy(npub, 'npub')} />
                            </XStack>
                        </YStack>

                        {/* NSEC */}
                        <YStack gap="$2">
                            <Text fontSize="$3" color="$red10" fontWeight="600">Secret Key (nsec)</Text>
                            <View
                                bg="$red2"
                                p="$3"
                                rounded="$4"
                                borderWidth={1}
                                borderColor="$red5"
                            >
                                <XStack items="center" justify="space-between" gap="$3">
                                    <View flex={1}>
                                        <Text
                                            fontSize={isNsecVisible ? "$2" : "$4"}
                                            fontWeight="600"
                                            color="$red10"
                                            filter={isNsecVisible ? undefined : 'blur(5px)'}
                                        >
                                            {isNsecVisible ? nsec : '••••••••••••••••••••••••••••••••'}
                                        </Text>
                                    </View>
                                    <XStack gap="$2">
                                        {isNsecVisible && (
                                            <Button size="$3" chromeless icon={<Copy size={18} color="$red10" />} onPress={() => handleCopy(nsec, 'nsec')} />
                                        )}
                                        <Button
                                            size="$3"
                                            chromeless
                                            icon={isNsecVisible ? <EyeOff size={18} color="$red10" /> : <Eye size={18} color="$red10" />}
                                            onPress={handleRevealNsec}
                                        />
                                    </XStack>
                                </XStack>
                            </View>
                            <XStack gap="$2" items="center" mt="$1">
                                <AlertTriangle size={14} color="$red10" />
                                <Text fontSize="$2" color="$red10" fontWeight="600">Never share your nsec with anyone.</Text>
                            </XStack>
                        </YStack>
                    </YStack>

                    <Separator borderColor="$borderColor" opacity={0.5} />

                    {/* Relays Section */}
                    <YStack gap="$4">
                        <XStack items="center" gap="$2">
                            <Server size={18} color="$gray10" />
                            <Text fontSize="$4" fontWeight="700" color="$gray10">Relays</Text>
                        </XStack>
                        <Text fontSize="$3" color="$gray11">Relays are used to connect to the Nostr network.</Text>

                        <XStack gap="$2" items="center">
                            <Input
                                flex={1}
                                size="$4"
                                placeholder="wss://my.relay.com"
                                value={newRelay}
                                onChangeText={setNewRelay}
                                autoCapitalize="none"
                                autoCorrect={false}
                                bg="$background"
                            />
                            <Button
                                size="$4"
                                theme="accent"
                                icon={<Plus size={18} />}
                                disabled={!newRelay}
                                onPress={handleAddRelay}
                            />
                        </XStack>

                        <YStack gap="$2" mt="$2">
                            {relays.map((relay) => (
                                <XStack
                                    key={relay}
                                    bg="$gray2"
                                    p="$3"
                                    rounded="$3"
                                    items="center"
                                    justify="space-between"
                                >
                                    <Text fontSize="$3" fontWeight="500">{relay}</Text>
                                    <Button
                                        size="$2"
                                        chromeless
                                        icon={<Trash2 size={16} color="$red10" />}
                                        onPress={() => handleRemoveRelay(relay)}
                                    />
                                </XStack>
                            ))}
                        </YStack>
                    </YStack>

                </YStack>
            </ScrollView>
        </YStack>
    );
}
