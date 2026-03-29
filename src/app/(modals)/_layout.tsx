import { Stack, useRouter } from 'expo-router'
import { Button, useTheme, XStack, Text } from 'tamagui'
import { X, ChevronLeft, RefreshCw } from '@tamagui/lucide-icons'

export default function ModalLayout() {
    const theme = useTheme()
    const router = useRouter()

    const DefaultHeaderTitle = ({ children }: { children: string }) => (
        <Text fontWeight="700" fontSize={20} color="$color">
            {children}
        </Text>
    )

    return (
        <Stack
            screenOptions={{
                headerShown: true,
                presentation: 'formSheet',
                headerStyle: {
                    backgroundColor: theme.background.val,
                },
                headerTitleStyle: {
                    color: theme.color.val,
                    fontWeight: '500',

                },
                headerTitleAlign: 'center',
                headerTintColor: theme.color.val,
                headerShadowVisible: false,
                headerTitle: ({ children }) => <DefaultHeaderTitle>{children}</DefaultHeaderTitle>,
                headerLeft: () => (
                    <Button
                        circular
                        size="$3"
                        chromeless
                        icon={<X size={24} color="$color" />}
                        onPress={() => router.back()}
                    />
                ),
                contentStyle: {
                    backgroundColor: theme.background.val,
                },
            }}
        >
            <Stack.Screen
                name="receive"
                options={{
                    title: 'Receive Ecash',
                }}
            />
            <Stack.Screen
                name="send"
                options={{
                    title: 'Send',
                }}
            />
            <Stack.Screen
                name="mint-profile"
                options={{
                    title: 'Mint Profile',
                }}
            />
            <Stack.Screen
                name="mint"
                options={{
                    title: 'Mint Cash',
                }}
            />
            <Stack.Screen
                name="melt"
                options={{
                    title: 'Pay Lightning',
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
                    presentation: "modal",
                    title: 'Transaction Details',
                }}
            />
            <Stack.Screen
                name="ecash"
                options={{
                    title: 'E-Cash',
                }}
            />
            <Stack.Screen
                name="mints"
                options={{
                    title: 'Mints',
                }}
            />
            <Stack.Screen
                name="nostr-profile"
                options={{
                    title: 'Nostr Identity',
                }}
            />
            <Stack.Screen
                name="about"
                options={{
                    title: 'About',
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
                name="nostr-username"
                options={{
                    title: 'Nostr Username',
                }}
            />
        </Stack>
    )
}

