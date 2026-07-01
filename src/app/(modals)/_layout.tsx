import { Stack, useRouter } from 'expo-router'
import { Button, useTheme, Text } from 'tamagui'
import { Nfc, Send, X } from '@tamagui/lucide-icons'
import React from 'react'
import HomeHeaderMintSelector from '~/components/HomeMintSelector'

// Extracted to module scope — never recreated on re-render
const DefaultHeaderTitle = React.memo(({ children }: { children: string }) => (
    <Text fontWeight="700" fontSize={20} color="$color">
        {children}
    </Text>
))

export default function ModalLayout() {
    const theme = useTheme()
    const router = useRouter()

    return (
        <Stack
            screenOptions={{
                headerShown: true,
                presentation: 'formSheet',
                headerStyle: {
                    backgroundColor: theme.background?.val,
                },
                headerTitleStyle: {
                    color: theme.color?.val,
                    fontWeight: '500',

                },
                headerTitleAlign: 'center',
                headerTintColor: theme.color?.val,
                headerShadowVisible: false,
                headerTitle: ({ children }) => <DefaultHeaderTitle>{children}</DefaultHeaderTitle>,
                headerLeft: () => (
                    <Button
                        circular
                        size="$3"
                        rounded="$10"
                        icon={<X size={24} color="$color" />}
                        onPress={() => router.back()}
                    />
                ),
                contentStyle: {
                    backgroundColor: theme.background?.val,
                },
            }}
        >
            <Stack.Screen
                name="mint-details"
                options={{
                    presentation: "fullScreenModal",
                }}
            />
            <Stack.Screen
                name="receive"
                options={{
                    title: 'Receive Ecash',
                    presentation: "fullScreenModal",
                }}
            />
            <Stack.Screen
                name="nfc-receive"
                options={{
                    headerTitle: ({ children }) => <DefaultHeaderTitle>NFC</DefaultHeaderTitle>,
                    presentation: "fullScreenModal",
                }}
            />
            <Stack.Screen
                name="+not-found"
                options={{
                    title: 'Not Found',
                    presentation: "fullScreenModal",
                }}
            />
            <Stack.Screen
                name="send"
                options={{
                    title: 'Send',
                    presentation: "fullScreenModal",
                }}
            />
            <Stack.Screen
                name="mint-profile"
                options={{
                    title: 'Mint Profile',
                    presentation: "fullScreenModal",
                    headerShown: true,
                }}
            />
            <Stack.Screen
                name="mint"
                options={{
                    title: 'Mint Cash',
                    presentation: "fullScreenModal",
                }}
            />
            <Stack.Screen
                name="melt"
                options={{
                    title: 'Pay Lightning',
                    presentation: "fullScreenModal",
                }}
            />
            <Stack.Screen
                name="swap"
                options={{
                    title: 'Swap',
                    presentation: "fullScreenModal",
                }}
            />
            <Stack.Screen
                name="scanner"
                options={{
                    headerShown: false,
                    presentation: "modal",
                }}
            />
            <Stack.Screen
                name="txn-details"
                options={{
                    presentation: "fullScreenModal",
                    title: 'Transaction Details',
                }}
            />
            <Stack.Screen
                name="ecash"
                options={{
                    title: 'E-Cash',
                    presentation: "fullScreenModal",
                }}
            />
            <Stack.Screen
                name="mints"
                options={{
                    title: 'Mints',
                    presentation: "fullScreenModal",
                }}
            />
            <Stack.Screen
                name="nostr-profile"
                options={{
                    presentation: "fullScreenModal",
                    headerShown: true,
                    headerTitle: '',
                }}
            />
            <Stack.Screen
                name="nostr-settings"
                options={{
                    title: 'Nostr Settings',
                    presentation: "fullScreenModal",
                }}
            />
            <Stack.Screen
                name="about"
                options={{
                    title: 'About',
                    presentation: "fullScreenModal",
                }}
            />
            <Stack.Screen
                name="proofs"
                options={{
                    presentation: "modal",
                    title: 'Proof Manager',
                }}
            />
            <Stack.Screen
                name="optimize-wallet"
                options={{
                    presentation: "modal",
                    title: 'Optimize Wallet',
                }}
            />
            <Stack.Screen
                name="nostr-username"
                options={{
                    title: 'Nostr Username',
                    presentation: "fullScreenModal",
                }}
            />
            <Stack.Screen
                name="add-mint"
                options={{
                    title: 'Add Mint',
                    presentation: "fullScreenModal",
                }}
            />
            <Stack.Screen
                name="contact-search"
                options={{
                    title: 'Search Contact',
                    presentation: "fullScreenModal",
                }}
            />
            <Stack.Screen
                name="search"
                options={{
                    title: 'Search',
                    presentation: "formSheet",
                    animation: "slide_from_bottom",
                }}
            />
            <Stack.Screen
                name="discover-mints"
                options={{
                    title: 'Discover Mints',
                    presentation: "fullScreenModal",
                }}
            />
            <Stack.Screen
                name="contact-details"
                options={{
                    title: 'Contact Details',
                    presentation: "fullScreenModal",
                }}
            />
            <Stack.Screen
                name="ota-update"
                options={{
                    title: 'Update App',
                    presentation: "fullScreenModal",
                }}
            />
            <Stack.Screen
                name="token-details"
                options={{
                    title: 'Token Details',
                    presentation: "fullScreenModal",
                }}
            />
            <Stack.Screen
                name="backup-seed"
                options={{
                    title: 'Backup Seed',
                    presentation: "fullScreenModal",
                }}
            />
            <Stack.Screen
                name="nostr-activity"
                options={{
                    title: 'Nostr Activity',
                    presentation: "fullScreenModal",
                }}
            />

        </Stack>
    )
}
