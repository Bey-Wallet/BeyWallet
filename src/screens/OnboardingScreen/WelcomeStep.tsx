import React from 'react'
import { YStack, Text, Button, H1, Image, View, XStack } from 'tamagui'
import { Wallet, KeyRound, FolderOpen } from '@tamagui/lucide-icons'
import * as Haptics from 'expo-haptics'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Alert } from 'react-native'
import { useAppTheme } from '../../context/ThemeContext'
import GlowCard from '~/components/UI/GlowCard'

interface WelcomeStepProps {
    onCreateWallet: () => void
    onImportWallet: () => void
    onImportFromFile: () => void
    hasSavedWallet?: boolean
    onOpenSavedWallet?: () => void
    onDeleteSavedWallet?: () => void
}

export function WelcomeStep({
    onCreateWallet,
    onImportWallet,
    onImportFromFile,
    hasSavedWallet = false,
    onOpenSavedWallet,
    onDeleteSavedWallet
}: WelcomeStepProps) {
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

            justify="space-between"
        >
            {/* Top spacer */}
            <View />

            {/* Center - Logo and Title */}


            <YStack height={400} width='100%' bg="$gray2" rounded="$5" alignItems="center" justifyContent="center" >
                <Image source={resolvedTheme === 'dark' ? require('../../assets/icons/bey-logo-white-transparent.png') : require('../../assets/icons/bey-logo-black-transparent.png')} width={100} height={100}
                    // rotate="90deg"
                    resizeMode="contain" />
            </YStack>




            {/* Bottom - CTAs */}
            <YStack gap="$3" mb="$4" justify="center" items="center" pb="$4">

                <YStack items="center" gap="$2">
                    <H1 fontSize="$9" text="center" lineHeight="$9" fontWeight="700" color="$color">
                        {hasSavedWallet ? "Resume Setup" : "Bitcoin for online & offline."}
                    </H1>
                    <Text color="$gray10" pb="$4" fontSize="$4" text="center" px="$4">
                        {hasSavedWallet 
                            ? "We found a saved wallet that didn't finish initialization."
                            : "Cashu wallet for private, instant Bitcoin payments."}
                    </Text>
                </YStack>

                {hasSavedWallet ? (
                    <>
                        <Button
                            size="$5"
                            theme="accent"
                            width="100%"
                            onPress={onOpenSavedWallet}
                            icon={<Wallet size={24} />}
                            fontSize="$5"
                            fontWeight="700"
                            rounded="$5"
                            pressStyle={{ scale: 0.98, opacity: 0.9 }}
                        >
                            Open saved wallet
                        </Button>

                        <Button
                            size="$5"
                            theme="gray"
                            width="100%"
                            onPress={() => {
                                Alert.alert(
                                    'Delete Wallet',
                                    'Are you sure you want to delete the saved wallet and start over? This cannot be undone.',
                                    [
                                        { text: 'Cancel', style: 'cancel' },
                                        { text: 'Delete', style: 'destructive', onPress: onDeleteSavedWallet }
                                    ]
                                )
                            }}
                            icon={<FolderOpen size={24} color="$red10" />}
                            fontSize="$5"
                            fontWeight="700"
                            rounded="$5"
                            pressStyle={{ scale: 0.98, opacity: 0.9 }}
                            color="$red10"
                        >
                            Delete & Start Over
                        </Button>
                    </>
                ) : (
                    <>
                        <Button
                            size="$5"
                            theme="accent"
                            width="100%"
                            onPress={handleCreate}
                            icon={<Wallet size={24} />}
                            fontSize="$5"
                            fontWeight="700"
                            rounded="$5"
                            pressStyle={{ scale: 0.98, opacity: 0.9 }}
                        >
                            Create a new wallet
                        </Button>

                        <Button
                            size="$5"
                            theme="gray"
                            width="100%"
                            onPress={handleImport}
                            icon={<KeyRound size={24} />}
                            fontSize="$5"
                            fontWeight="700"
                            rounded="$5"
                            pressStyle={{ scale: 0.98, opacity: 0.9 }}
                        >
                            Import existing wallet
                        </Button>
                    </>
                )}


            </YStack>
        </YStack>
    )
}

