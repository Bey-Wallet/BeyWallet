import React, { useState } from 'react'
import { YStack, XStack, Text, Button, H2, View, ScrollView } from 'tamagui'
import { Copy, Check, AlertTriangle, ChevronRight } from '@tamagui/lucide-icons'
import * as Haptics from 'expo-haptics'
import * as Clipboard from 'expo-clipboard'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface SeedStepProps {
    mnemonic: string
    onContinue: () => void
}

export function SeedStep({ mnemonic, onContinue }: SeedStepProps) {
    const [copied, setCopied] = useState(false)
    const [confirmed, setConfirmed] = useState(false)
    const insets = useSafeAreaInsets()
    const words = mnemonic.split(' ')

    const handleCopy = async () => {
        await Clipboard.setStringAsync(mnemonic)
        setCopied(true)
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        setTimeout(() => setCopied(false), 3000)
    }

    const handleContinue = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        onContinue()
    }

    return (
        <YStack
            flex={1}
            bg="$background"
            px="$4"
            pt={insets.top + 24}
            pb={insets.bottom + 24}
        >
            <ScrollView flex={1} showsVerticalScrollIndicator={false}>
                <YStack gap="$6">
                    {/* Header */}
                    <YStack items="center" gap="$2">
                        <H2 fontSize="$7" fontWeight="700" color="$color">
                            Your Recovery Phrase
                        </H2>
                        <Text color="$gray10" fontSize="$3" text="center">
                            Write these 12 words down and keep them safe
                        </Text>
                    </YStack>

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
                            icon={copied ? <Check color="$green10" /> : <Copy />}
                        >
                            {copied ? 'Copied!' : 'Copy '}
                        </Button>
                    </XStack>


                </YStack>
            </ScrollView>

            {/* Continue Button */}
            <YStack pt="$4" gap="$3">
                {/* Confirmation checkbox */}
                <XStack
                    items="center"
                    gap="$3"
                    p="$3"
                    bg="$gray2"
                    rounded="$3"
                    pressStyle={{ opacity: 0.8 }}
                    onPress={() => {
                        setConfirmed(!confirmed)
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    }}
                >
                    <View
                        width={24}
                        height={24}
                        rounded="$2"
                        borderWidth={2}
                        borderColor={confirmed ? '$green9' : '$gray8'}
                        bg={confirmed ? '$green9' : 'transparent'}
                        items="center"
                        justify="center"
                    >
                        {confirmed && <Check size={16} color="white" />}
                    </View>
                    <Text color="$color" fontSize="$3" flex={1}>
                        I have saved my recovery phrase securely
                    </Text>
                </XStack>
                <Button
                    size="$5"
                    theme="accent"
                    disabled={!confirmed}
                    opacity={confirmed ? 1 : 0.5}
                    onPress={handleContinue}
                    iconAfter={<ChevronRight size={20} />}
                    fontSize="$5"
                    fontWeight="700"
                    rounded="$4"
                >
                    Continue
                </Button>
            </YStack>
        </YStack>
    )
}
