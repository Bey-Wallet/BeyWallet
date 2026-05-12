import { Link, Stack } from 'expo-router'
import React from 'react'
import { YStack, Text, Button, useTheme } from 'tamagui'
import { AlertCircle } from '@tamagui/lucide-icons'
import * as Haptics from 'expo-haptics'

export default function NotFoundScreen() {
    const theme = useTheme();

    return (
        <>
            <Stack.Screen options={{ title: 'Oops!' }} />
            <YStack flex={1} bg="$background" p="$4" justify="center" items="center" gap="$5">
                <EmptyState
                    icon={<AlertCircle size={64} color={theme.color4.val} />}
                    title="Oops!"
                    subtitle="This screen doesn't exist or has been moved."
                />

                <Link href="/" asChild>
                    <Button
                        size="$5"
                        theme="accent"
                        fontWeight="700"
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                        rounded="$10"
                        mt="$4"
                        fontSize="$4"

                        maxWidth={300}
                    >
                        Go to Home
                    </Button>
                </Link>
            </YStack>
        </>
    )
}

function EmptyState({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
    return (
        <YStack items="center" justify="center" gap="$3" width={300} >
            {icon}
            <Text color="$color" fontSize="$6" fontWeight="700">
                {title}
            </Text>
            <Text color="$gray10" text="center" fontSize="$4" maxWidth={260}>
                {subtitle}
            </Text>
        </YStack>
    );
}
