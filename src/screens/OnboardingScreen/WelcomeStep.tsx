import React from 'react'
import { YStack, Text, Button, H1, Image, View } from 'tamagui'
import { Wallet, KeyRound, FolderOpen } from '@tamagui/lucide-icons'
import * as Haptics from 'expo-haptics'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAppTheme } from '../../context/ThemeContext'

interface WelcomeStepProps {
    onCreateWallet: () => void
    onImportWallet: () => void
    onImportFromFile: () => void
}

export function WelcomeStep({ onCreateWallet, onImportWallet, onImportFromFile }: WelcomeStepProps) {
    const { resolvedTheme } = useAppTheme()
    const insets = useSafeAreaInsets()

    const handleCreate = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        onCreateWallet()
    }

    const handleImport = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        onImportWallet()
    }

    const handleImportFromFile = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        onImportFromFile()
    }

    return (
        <YStack
            flex={1}
            bg="$background"
            px="$4"
            pt={insets.top + 24}
            pb={insets.bottom + 24}
            justify="space-between"
        >
            {/* Top spacer */}
            <View />

            {/* Center - Logo and Title */}
            <YStack items="center" gap="$6">
                <View
                    width={140}
                    height={140}
                    rounded="$10"
                    bg="$color"
                    items="center"
                    justify="center"
                    overflow="hidden"
                    borderWidth={1}
                    borderColor="$borderColor"
                >
                    <Image
                        source={resolvedTheme === 'dark'
                            ? require('../../assets/icons/Bey-light-logo.png')
                            : require('../../assets/icons/Bey-dark-logo.png')}
                        style={{ width: 90, height: 90 }}
                        resizeMode="contain"
                    />
                </View>

                <YStack items="center" gap="$2">
                    <H1 fontSize="$9" text="center" lineHeight="$9" fontWeight="700" color="$color">
                        Get Access to Cashu E-Cash with Bey Wallet
                    </H1>
                    <Text color="$gray10" fontSize="$4" text="center" px="$4">
                        Your self-custodial Cashu wallet for private, instant Bitcoin payments
                    </Text>
                </YStack>
            </YStack>

            {/* Bottom - CTAs */}
            <YStack gap="$3" items="center" pb="$4">
                <Button
                    size="$5"
                    theme="accent"
                    width="100%"
                    onPress={handleCreate}
                    icon={<Wallet size={24} />}
                    fontSize="$5"
                    fontWeight="700"
                    rounded="$4"
                    pressStyle={{ scale: 0.98, opacity: 0.9 }}
                >
                    Create New Wallet
                </Button>

                <Button
                    size="$5"
                    theme="gray"
                    width="100%"
                    onPress={handleImport}
                    icon={<KeyRound size={24} />}
                    fontSize="$5"
                    fontWeight="700"
                    rounded="$4"
                    pressStyle={{ scale: 0.98, opacity: 0.9 }}
                >
                    Import via Seed Phrase
                </Button>


            </YStack>
        </YStack>
    )
}

