import React, { useState, useEffect } from 'react';
import { YStack, XStack, Text, Button, View, ScrollView } from 'tamagui';
import { ShieldCheck, Copy, Eye, EyeOff, AlertTriangle, CheckCircle2 } from '@tamagui/lucide-icons';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
import { seedService } from '~/services/seedService';
import { initService } from '~/services/core';

export function BackupSeedScreen() {
    const router = useRouter();
    const [mnemonic, setMnemonic] = useState<string | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [hasBackedUp, setHasBackedUp] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        const fetchOrGenerateMnemonic = async () => {
            let m = await seedService.getMnemonic();

            if (!m) {
                // Generate a new mnemonic if one doesn't exist
                console.log('[BackupSeedScreen] No mnemonic found, generating new one...');
                m = seedService.generateMnemonic();
                await seedService.saveMnemonic(m);

                // Re-initialize coco with new seed
                try {
                    initService.reset();
                    await initService.init();
                    console.log('[BackupSeedScreen] ✅ Coco re-initialized with new seed');
                } catch (e) {
                    console.warn('[BackupSeedScreen] Re-init warning (non-fatal):', e);
                }
            }

            setMnemonic(m);

            // Check if already marked as backed up
            const backedUp = await SecureStore.getItemAsync('wallet_backed_up');
            setHasBackedUp(backedUp === 'true');
        };
        fetchOrGenerateMnemonic();
    }, []);

    const handleCopy = async () => {
        if (mnemonic) {
            await Clipboard.setStringAsync(mnemonic);
            setCopied(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleConfirmBackup = async () => {
        await SecureStore.setItemAsync('wallet_backed_up', 'true');
        setHasBackedUp(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        console.log('[BackupSeedScreen] ✅ Wallet marked as backed up');
        router.back();
    };

    const words = mnemonic?.split(' ') || [];

    return (
        <YStack flex={1} bg="$background">
            <ScrollView showsVerticalScrollIndicator={false}>
                <YStack p="$4" gap="$6">

                    <View bg="$yellow2" p="$4" rounded="$4" borderWidth={1} borderColor="$yellow8">
                        <XStack gap="$3">
                            <AlertTriangle color="$yellow10" size={20} />
                            <YStack flex={1}>
                                <Text color="$yellow10" fontWeight="700">Security Warning</Text>
                                <Text color="$yellow10" fontSize="$2" mt="$1">
                                    NEVER share your recovery phrase. Anyone with these 12 words can take your funds. Store them in a safe, physical location.
                                </Text>
                            </YStack>
                        </XStack>
                    </View>

                    <YStack gap="$4">
                        <View
                            items="center" justify="center"
                        >
                            <XStack flexWrap="wrap" items="center" justify="center" gap="$2" >
                                {words.map((word, index) => (
                                    <XStack
                                        key={index}
                                        bg={isVisible ? "$color4" : "$color2"}
                                        px="$3"
                                        py="$4"
                                        rounded="$3"
                                        borderWidth={1}

                                        minW="48%"
                                        items="center"
                                    >
                                        <Text fontSize="$2" color="$gray10" mr="$2" width={20}>{index + 1}</Text>
                                        <Text
                                            fontSize="$4"
                                            fontWeight="600"
                                            filter={isVisible ? undefined : 'blur(5px)'}
                                        >
                                            {word}
                                        </Text>
                                    </XStack>
                                ))}
                            </XStack>
                        </View>

                        <XStack gap="$3">
                            <Button
                                flex={1}
                                size="$5"
                                icon={isVisible ? EyeOff : Eye}
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    setIsVisible(!isVisible);
                                }}
                                rounded="$4"
                                bg="$gray5"
                            >
                                {isVisible ? 'Hide' : 'Show'}
                            </Button>
                            <Button
                                flex={1}
                                size="$5"
                                icon={copied ? CheckCircle2 : Copy}
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    handleCopy();
                                }}
                                rounded="$4"
                                bg="$gray5"
                            >
                                {copied ? 'Copied!' : 'Copy'}
                            </Button>
                        </XStack>
                    </YStack>

                    {hasBackedUp ? (
                        <XStack items="center" gap="$2" justify="center" py="$2">
                            <CheckCircle2 size={18} color="$green10" />
                            <Text color="$green10" fontWeight="600">Already backed up</Text>
                        </XStack>
                    ) : null}


                </YStack>
            </ScrollView>
        </YStack>
    );
}
