import React from 'react'
import { YStack, Text, Button, H1, View, XStack, Image } from 'tamagui'
import { Wallet, KeyRound, FolderOpen } from '@tamagui/lucide-icons'
import * as Haptics from 'expo-haptics'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Alert } from 'react-native'
import GlowCard from '~/components/UI/GlowCard'
import BeyIcon from '~/components/icons/BeyIcon'

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


            <YStack
                height={400}
                width="100%"
                bg="$gray2"
                rounded="$5"
                items="center"
                justify="center"
                position="relative"
                overflow="hidden"
            >
                <Image
                    source={require('~/assets/images/Moving-clouds.gif')}
                    position="absolute"
                    t={0}
                    l={0}
                    r={0}
                    b={0}
                    width="100%"
                    height="100%"

                    resizeMode="cover"
                />
                <BeyIcon color="black" size={50} />
            </YStack>




            {/* Bottom - CTAs */}
            <YStack gap="$3" mb="$4" justify="center" items="center" pb="$4">

                <YStack items="center" gap="$2">
                    <H1 fontSize="$9" letterSpacing={-0.5} text="center" lineHeight="$9" fontWeight="700" color="$color">
                        {hasSavedWallet ? "Finish Setup" : "Bitcoin, Reimagined."}
                    </H1>
                    <Text color="$gray10" pb="$4" fontSize="$4" text="center" px="$4" lineHeight={22}>
                        {hasSavedWallet
                            ? "We found a wallet setup in progress. Let's finish initializing it."
                            : "A beautiful e-cash wallet designed for instant payments, privacy, and full offline support."}
                    </Text>
                </YStack>

                {hasSavedWallet ? (
                    <>

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

                            fontSize="$6"
                            fontWeight="700"
                            rounded="$5"
                            pressStyle={{ scale: 0.98, opacity: 0.9 }}
                            color="$red10"
                        >
                            Delete & Start Over
                        </Button>
                        <Button
                            size="$5"
                            theme="accent"
                            width="100%"
                            onPress={onOpenSavedWallet}
                            fontSize="$6"
                            fontWeight="700"
                            rounded="$5"
                            pressStyle={{ scale: 0.98, opacity: 0.9 }}
                        >
                            Open saved wallet
                        </Button>
                    </>
                ) : (
                    <>


                        <Button
                            size="$5"
                            theme="gray"
                            width="100%"
                            onPress={handleImport}
                            fontSize="$6"
                            fontWeight="700"
                            rounded="$5"
                            pressStyle={{ scale: 0.98, opacity: 0.9 }}
                        >
                            Import existing wallet
                        </Button>
                        <Button
                            size="$5"
                            theme="accent"
                            width="100%"
                            onPress={handleCreate}
                            fontSize="$6"
                            fontWeight="700"
                            rounded="$5"
                            pressStyle={{ scale: 0.98, opacity: 0.9 }}
                        >
                            Create a new wallet
                        </Button>
                    </>
                )}


            </YStack>
        </YStack>
    )
}

