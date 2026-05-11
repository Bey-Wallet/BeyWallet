import React, { useState } from 'react';
import { YStack, XStack, Text, Button, View, useTheme, Theme, Image } from 'tamagui';
import Blockies from '~/components/UI/Blockies';
import { useWalletStore } from '~/store/walletStore';
import { useNip05Lookup } from '~/hooks/useNip05Lookup';
import { useSettingsStore } from '~/store/settingsStore';
import NFCFill2 from '~/components/icons/NFC-fill-2';
import { ProcessingSheet } from '~/components/UI/ProcessingSheet';
import * as Haptics from 'expo-haptics';
import { DarkTheme } from '@react-navigation/native';
import { useAppTheme } from '~/context/ThemeContext';
import { Scan } from '@tamagui/lucide-icons';
import NFCFillIcon from '~/components/icons/NFC-fill';
import { router } from 'expo-router';

export default function NFCReceiveScreen() {
    const theme = useTheme();
    const npub = useSettingsStore(state => state.npub);
    const { username } = useNip05Lookup();
    const activeMintUrl = useWalletStore(s => s.activeMintUrl);
    const balances = useWalletStore(s => s.balances);
    const mints = useWalletStore(s => s.mints);

    const [processing, setProcessing] = useState(false);
    const [status, setStatus] = useState<'processing' | 'success'>('processing');

    const activeMint = mints.find(m => m.mintUrl === activeMintUrl);
    const mintName = activeMint?.nickname || activeMint?.name || activeMintUrl?.replace(/^https?:\/\//, '').replace(/\/$/, '') || 'Unknown Mint';
    const balance = activeMintUrl ? balances[activeMintUrl] || 0 : 0;

    const handleReceive = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setProcessing(true);
        setStatus('processing');

        // Mock for 20 seconds
        const timer = setTimeout(() => {
            setStatus('success');
            // Auto close after success
            setTimeout(() => {
                setProcessing(false);
            }, 3000);
        }, 20000);

        return () => clearTimeout(timer);
    };

    const { resolvedTheme } = useAppTheme();

    return (
        <YStack flex={1} bg="$background" p="$4" justify="space-between">
            {/* Card */}
            <Theme inverse >

                <YStack
                    bg="$accent12"
                    p="$3"
                    rounded="$5"
                    borderWidth={1}
                    borderColor="$borderColor"
                    gap="$6"
                    width="100%"
                    justify="space-between"
                    minH={230}
                >
                    {/* Top Row */}
                    <XStack justify="space-between" items="center">
                        <XStack gap="$3" items="center">
                            <Blockies seed={npub || 'default'} size={10} scale={4} style={{ borderRadius: 5 }} />
                            <Text fontSize="$5" fontWeight="700" color="$color">
                                {username || 'Bey Wallet User'}
                            </Text>
                        </XStack>
                        <NFCFill2 size={40} color={theme.color1.val} />
                    </XStack>
                    <View width="100%" justify="center" items="center">

                        <Image alt='bey' source={resolvedTheme === 'dark'
                            ? require('../../assets/icons/Frame 10.png')
                            : require('../../assets/icons/Frame 9.png')}

                            width={250} height={80}
                            resizeMode="contain"
                        />

                    </View>
                    {/* Bottom Row */}
                    <XStack justify="space-between" items="flex-end">
                        <YStack gap="$1">
                            <Text fontSize="$2" color="$gray10" fontWeight="600">Selected Mint</Text>
                            <Text fontSize="$4" fontWeight="700" color="$color" numberOfLines={1} style={{ maxWidth: 150 }}>
                                {mintName}
                            </Text>
                        </YStack>
                        <YStack items="flex-end" gap="$1">
                            <Text fontSize="$2" color="$gray10" fontWeight="600">Balance (sats)</Text>
                            <Text fontSize="$6" fontWeight="900" color="$color">
                                ₿{balance.toLocaleString()}
                            </Text>
                        </YStack>
                    </XStack>
                </YStack>

            </Theme>

            {/* NFC History Section */}
            <YStack flex={1} justify="center">
                <EmptyState
                    icon={<NFCFillIcon size={48} color={theme.color4.val} />}
                    title="No NFC History"
                    subtitle="Your NFC transactions will appear here."
                />
            </YStack>

            {/* Bottom Button */}
            <YStack gap="$2">
                <Button
                    variant="outlined"
                    size="$5"
                    chromeless
                    theme="gray"
                    fontWeight="700"
                    icon={<Scan size={24} color={theme.color.val} />}
                    onPress={() => router.push('/(modals)/opy')}
                    rounded="$5"
                >
                    Scan QR Instead
                </Button>
                <Button
                    size="$5"

                    fontWeight="700"
                    icon={<NFCFill2 size={24} color={theme.color.val} />}
                    onPress={handleReceive}

                    rounded="$5"
                >
                    Tap to Receive
                </Button>
            </YStack>

            <ProcessingSheet
                visible={processing}
                status={status}
                title="NFC Receiving"
                detail="Hold your phone near the sender"
                variant="nfc"
                onClose={() => setProcessing(false)}
            />
        </YStack>
    );
}

function EmptyState({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
    return (
        <YStack items="center" justify="center" py="$10" gap="$3">
            {icon}
            <Text color="$gray9" fontSize="$5" fontWeight="600">
                {title}
            </Text>
            <Text color="$gray8" fontSize="$3" textAlign="center" maxWidth={260}>
                {subtitle}
            </Text>
        </YStack>
    );
}
