import { Moon, Sun, Monitor } from '@tamagui/lucide-icons'
import { Button, XStack, YStack, Text, useTheme } from 'tamagui'
import { useAppTheme } from '../context/ThemeContext'
import * as Haptics from 'expo-haptics'

export function ThemeSelector() {
    const { themeMode, setThemeMode } = useAppTheme()
    const theme = useTheme()

    const modes = [
        { id: 'light', icon: Sun, label: 'Light' },
        { id: 'dark', icon: Moon, label: 'Dark' },
        { id: 'system', icon: Monitor, label: 'System' },
    ] as const

    const handleThemeChange = (mode: typeof modes[number]['id']) => {
        setThemeMode(mode)
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    }

    return (
        <YStack gap="$4" width="100%">
            <Text fontSize="$3" fontWeight="500" color="$gray12">Choose Mode</Text>
            <XStack gap="$2">
                {modes.map((mode) => {
                    const isActive = themeMode === mode.id
                    const Icon = mode.icon

                    return (
                        <Button
                            key={mode.id}
                            flex={1}
                            flexDirection="column"
                            height={80}
                            p="$2"
                            bg={isActive ? '$blue5' : '$background'}
                            borderColor={isActive ? '$blue10' : '$borderColor'}
                            borderWidth={isActive ? 2 : 1}
                            onPress={() => handleThemeChange(mode.id)}
                            hoverStyle={{ bg: isActive ? '$blue6' : '$backgroundHover' }}
                            pressStyle={{ bg: isActive ? '$blue4' : '$backgroundPress' }}
                        >
                            <YStack items="center" gap="$1">
                                <Icon size={24} color={isActive ? '$blue10' : '$color'} />
                                <Text fontSize="$2" fontWeight={isActive ? "600" : "400"} color={isActive ? '$blue10' : '$color'}>
                                    {mode.label}
                                </Text>
                            </YStack>
                        </Button>
                    )
                })}
            </XStack>
        </YStack>
    )
}
