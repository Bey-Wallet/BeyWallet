import React, { useCallback, useMemo } from 'react'
import { YStack, XStack, Button, Text, Spinner, View } from 'tamagui'
import { ChevronLeft } from '@tamagui/lucide-icons'
import * as Haptics from 'expo-haptics'

interface NumericKeypadProps {
    value: string
    onValueChange: (value: string) => void
    onConfirm: () => void
    confirmLabel: string
    isLoading?: boolean
    maxAmount?: number
    currency?: string
    showBalance?: boolean
    showAmountDisplay?: boolean
    showConfirmButton?: boolean
    confirmDisabled?: boolean
    confirmIcon?: any
}

// Keypad grid — defined once, never recreated
const KEYPAD_ROWS = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['.', '0', 'delete'],
] as const;

/**
 * Individual number button — extracted to module scope and memoized.
 * This prevents React from unmounting/remounting all 10 buttons on every keystroke.
 */
const NumButton = React.memo(({ digit, onPress }: { digit: string; onPress: (d: string) => void }) => (
    <Button
        flex={1}
        height={55}
        chromeless
        onPress={() => onPress(digit)}
        pressStyle={{ bg: "$colorTransparent", borderColor: "$colorTransparent", scale: 1.5 }}
    >
        <Text fontSize={32} fontVariant={['tabular-nums']} fontWeight="800" color="$color">
            {digit}
        </Text>
    </Button>
))

const DeleteButton = React.memo(({ onPress }: { onPress: () => void }) => (
    <Button
        flex={1}
        height={55}
        chromeless
        onPress={onPress}
        pressStyle={{ bg: "transparent", borderColor: "$colorTransparent", scale: 1.5 }}
        icon={<ChevronLeft size={32} color="$color" />}
    />
))

export function NumericKeypad({
    value,
    onValueChange,
    onConfirm,
    confirmLabel,
    isLoading = false,
    maxAmount,
    currency = 'SATS',
    showBalance = false,
    showAmountDisplay = true,
    showConfirmButton = true,
    confirmDisabled = false,
    confirmIcon = null
}: NumericKeypadProps) {

    const amountNum = Number(value) || 0
    const isOverBalance = maxAmount !== undefined && amountNum > maxAmount
    const isBalanceZero = maxAmount !== undefined && maxAmount === 0
    const canContinue = amountNum > 0 && !isOverBalance && !isLoading && !isBalanceZero

    const handlePress = useCallback((digit: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        onValueChange(value === '0' ? digit : value + digit)
    }, [value, onValueChange])

    const handleDelete = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        if (value.length <= 1) {
            onValueChange('0')
        } else {
            onValueChange(value.slice(0, -1))
        }
    }, [value, onValueChange])

    const handleConfirm = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        onConfirm()
    }, [onConfirm])

    // Memoize amount display color
    const amountColor = isOverBalance || isBalanceZero ? '$red10' : '$color'

    return (
        <YStack flex={showAmountDisplay ? 1 : undefined} justify="space-between" width="100%">
            {/* Amount Display */}
            {showAmountDisplay && (
                <YStack items="center" py="$6" gap="$1">
                    <XStack items="baseline" gap="$2">
                        <Text
                            fontSize={56}
                            fontWeight="700"
                            color={amountColor}
                        >
                            {value}
                        </Text>
                        <Text fontSize={20} fontWeight="600" color="$gray10" mb="$2">
                            {currency}
                        </Text>
                    </XStack>
                    {showBalance && maxAmount !== undefined && (
                        <Text color="$gray10" fontSize="$3">
                            Balance: {maxAmount} {currency}
                        </Text>
                    )}
                </YStack>
            )}

            {/* Keypad and Action Button */}
            <YStack pb="$4" >
                {/* Keypad Layout */}
                <YStack width="100%" gap="$0" pb="$4" >
                    {KEYPAD_ROWS.map((row, i) => (
                        <XStack key={i} gap="$10">
                            {row.map((digit) => {
                                if (digit === 'delete') {
                                    return <DeleteButton key="delete" onPress={handleDelete} />
                                }
                                return <NumButton key={digit} digit={digit} onPress={handlePress} />
                            })}
                        </XStack>
                    ))}
                </YStack>
                {showConfirmButton && (
                    <Button
                        size="$5"
                        fontSize="$6"
                        fontWeight={800}
                        theme={canContinue && !confirmDisabled ? "accent" : "gray"}
                        onPress={handleConfirm}
                        disabled={!canContinue || confirmDisabled}
                        opacity={(!canContinue || confirmDisabled) ? 0.5 : 1}
                        icon={isLoading ? <Spinner color="$color" /> : (confirmIcon || null)}
                    >
                        {isLoading ? 'Processing...' : confirmLabel}
                    </Button>
                )}
            </YStack>
        </YStack>
    )
}
