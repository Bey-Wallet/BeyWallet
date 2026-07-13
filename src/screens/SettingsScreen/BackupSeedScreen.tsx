import React, { useState, useEffect } from 'react';
import { YStack, XStack, Text, Button, View, ScrollView, H2 } from 'tamagui';
import { ShieldCheck, Copy, Eye, EyeOff, AlertTriangle, CheckCircle2, Check } from '@tamagui/lucide-icons';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
import { seedService } from '~/services/seedService';
import { initService } from '~/services/core';
import { useSettingsStore } from '~/store/settingsStore';

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
        await useSettingsStore.getState().setSeedBackedUp(true);
        setHasBackedUp(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        console.log('[BackupSeedScreen] ✅ Wallet marked as backed up');
        router.back();
    };

    const words = mnemonic?.split(' ') || [];

    return (
        <YStack flex={1} px="$4" bg="$background">
            <ScrollView flex={1} showsVerticalScrollIndicator={false}>
                <YStack gap="$6">
                    {/* Header */}


                    {/* Warning */}
                    <XStack
                        bg="$orange2"
                        borderWidth={1}
                        borderColor="$orange6"
                        rounded="$4"
                        p="$3"
                        gap="$3"
                        items="flex-start"
                    >
                        <AlertTriangle size={20} color="$orange10" />
                        <YStack flex={1} gap="$1">
                            <Text color="$orange11" fontSize="$3" fontWeight="600">
                                Never share your recovery phrase
                            </Text>
                            <Text color="$orange10" fontSize="$2">
                                Anyone with these words can access your funds. Store them offline in a secure location.
                            </Text>
                        </YStack>
                    </XStack>

                    {/* Seed Words Grid */}
                    <YStack

                    >
                        <XStack flexWrap="wrap" gap="$2" justify="center">
                            {words.map((word, index) => (
                                <XStack
                                    key={index}
                                    bg="$background"
                                    borderWidth={1}
                                    borderColor="$borderColor"
                                    rounded="$3"
                                    px="$3"
                                    py="$2"
                                    gap="$2"
                                    items="center"
                                    minW={100}
                                >
                                    <Text color="$gray9" fontSize="$2" fontWeight="500" width={20}>
                                        {index + 1}.
                                    </Text>
                                    <Text color="$color" fontSize="$4" fontWeight="600">
                                        {word}
                                    </Text>
                                </XStack>
                            ))}
                        </XStack>
                    </YStack>

                    {/* Copy Button */}
                    <XStack items="center" justify="center">

                        <Button
                            size="$3"
                            rounded="$10"

                            onPress={handleCopy}
                            icon={copied ? <Check /> : <Copy />}
                        >
                            {copied ? 'Copied!' : 'Copy '}
                        </Button>
                    </XStack>


                </YStack>
            </ScrollView>

        </YStack>
    );
}
