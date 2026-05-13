import React, { useState } from 'react'
import { YStack, XStack, Text, Button, H2, View, Card, H3, Separator } from 'tamagui'
import { Check, ShieldCheck, Sprout, Star, Info } from '@tamagui/lucide-icons'
import * as Haptics from 'expo-haptics'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Spinner } from '../../components/UI/Spinner'

const DEFAULT_MINTS = [
    {
        url: 'https://mint.minibits.cash/Bitcoin',
        name: 'Minibits',
        description: 'Reliable community mint with high uptime.',
        isTestnet: false,
    },
    {
        url: 'https://testnut.cashu.space',
        name: 'Testnut',
        description: 'Official Cashu testnet (for testing only).',
        isTestnet: true,
    },
    {
        url: 'https://nofee.testnut.cashu.space',
        name: 'Testnut (No Fee)',
        description: 'Fee-free testnet mint.',
        isTestnet: true,
    }
]

interface MintConfirmationStepProps {
    onComplete: (mintUrls: string[]) => void
    onSkip: () => void
}

export function MintConfirmationStep({ onComplete, onSkip }: MintConfirmationStepProps) {
    const insets = useSafeAreaInsets()
    const [isConnecting, setIsConnecting] = useState(false)

    const handleConfirm = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        setIsConnecting(true)
        try {
            // Simulated delay for UI feedback
            await new Promise(resolve => setTimeout(resolve, 800))
            onComplete(DEFAULT_MINTS.map(m => m.url))
        } finally {
            setIsConnecting(false)
        }
    }

    const handleSkip = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        onSkip()
    }

    return (
        <YStack
            flex={1}
            bg="$background"
            px="$4"
            pt={insets.top + 24}
            pb={insets.bottom + 16}
            justify="space-between"
        >
            <YStack gap="$6">
                <YStack gap="$2">
                    <H2 fontSize="$8" fontWeight="700">Connect to Mints</H2>
                    <Text color="$gray10" fontSize="$4">
                        We'll connect you to these reliable mints to get started. You can add more later.
                    </Text>
                </YStack>

                <YStack gap="$2">
                    {DEFAULT_MINTS.map((mint) => (
                        <Card
                            key={mint.url}
                            bg="$gray3"
                            p="$3"

                            rounded="$5"
                        >
                            <XStack gap="$3" items="center">
                                <View
                                    bg={mint.isTestnet ? "$orange3" : "$blue2"}
                                    p="$2"
                                    rounded="$3"
                                >
                                    <Sprout size={20} color={mint.isTestnet ? "$orange10" : "$blue10"} />
                                </View>
                                <YStack flex={1}>
                                    <XStack items="center" gap="$2">
                                        <Text fontWeight="700" fontSize="$4">{mint.name}</Text>
                                        {mint.isTestnet ? (
                                            <View bg="$orange2" px="$1.5" py="$0.5" rounded="$1" borderWidth={0.5} borderColor="$orange6">
                                                <Text fontSize="$1" fontWeight="800" color="$orange10">TESTNET</Text>
                                            </View>
                                        ) : (
                                            <View bg="$blue2" px="$1.5" py="$0.5" rounded="$1" borderWidth={0.5} borderColor="$blue6">
                                                <Text fontSize="$1" fontWeight="800" color="$blue10">MAINNET</Text>
                                            </View>
                                        )}
                                    </XStack>
                                    <Text color="$gray10" fontSize="$2" numberOfLines={1}>{mint.description}</Text>
                                </YStack>
                                <Check size={18} color="$green10" />
                            </XStack>
                        </Card>
                    ))}
                </YStack>

                <XStack bg="$blue3" p="$3" rounded="$4" gap="$3" items="center" >
                    <Info size={18} color="$blue10" />
                    <Text color="$blue11" fontSize="$2" flex={1}>
                        You can always add, remove, or change your trusted mints in Settings.
                    </Text>
                </XStack>
            </YStack>

            <YStack gap="$3">
                <Button
                    size="$5"
                    theme="accent"
                    onPress={handleConfirm}
                    disabled={isConnecting}
                    icon={isConnecting ? <Spinner size="small" /> : <ShieldCheck size={20} />}
                    fontWeight="700"
                    fontSize="$5"
                    rounded="$4"
                    pressStyle={{ scale: 0.98 }}
                >
                    {isConnecting ? 'Connecting...' : 'Connect & Continue'}
                </Button>

                <Button
                    size="$4"
                    chromeless
                    onPress={handleSkip}
                    disabled={isConnecting}
                >
                    <Text color="$gray10" fontSize="$3">Skip for now</Text>
                </Button>
            </YStack>
        </YStack>
    )
}
