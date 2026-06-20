import React, { useEffect, useRef } from 'react'
import {
    YStack, XStack, Text, Button, H2, View, ScrollView, Circle
} from 'tamagui'
import {
    Animated, Easing
} from 'react-native'
import { CheckCircle2, AlertCircle, Clock, Zap } from '@tamagui/lucide-icons'
import * as Haptics from 'expo-haptics'
import type { MintRestoreEntry } from '../../store/walletStore'

interface RestoreProgressStepProps {
    entries: MintRestoreEntry[]
    isRestoring: boolean
    totalRestoredSats: number
    onDone: () => void
}

// ── Spinner for active mint ──────────────────────────────────────────────────

function SpinnerIcon() {
    const rotation = useRef(new Animated.Value(0)).current

    useEffect(() => {
        Animated.loop(
            Animated.timing(rotation, {
                toValue: 1,
                duration: 1000,
                easing: Easing.linear,
                useNativeDriver: true,
            })
        ).start()
    }, [])

    const spin = rotation.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    })

    return (
        <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <View
                width={22}
                height={22}
                rounded={99999}
                borderWidth={2.5}
                borderColor="$blue9"
                borderTopColor="transparent"
            />
        </Animated.View>
    )
}

// ── Mint row card ────────────────────────────────────────────────────────────

function MintRow({ entry }: { entry: MintRestoreEntry }) {
    const statusAnim = useRef(new Animated.Value(0)).current

    useEffect(() => {
        if (entry.status === 'done' || entry.status === 'error') {
            Animated.spring(statusAnim, {
                toValue: 1,
                useNativeDriver: true,
                tension: 100,
                friction: 8,
            }).start()
        }
    }, [entry.status])

    const hostname = (() => {
        try { return new URL(entry.mintUrl).hostname }
        catch { return entry.mintUrl }
    })()

    const isActive = entry.status === 'scanning'
    const isDone = entry.status === 'done'
    const isError = entry.status === 'error'
    const isPending = entry.status === 'pending'

    return (
        <Animated.View style={{ opacity: isPending ? 0.45 : 1 }}>
            <XStack
                bg={isActive ? '$blue2' : isDone ? '$green2' : isError ? '$red2' : '$gray2'}
                borderWidth={1}
                borderColor={isActive ? '$blue6' : isDone ? '$green6' : isError ? '$red6' : '$borderColor'}
                rounded="$4"
                px="$4"
                py="$3"
                items="center"
                gap="$3"
            >
                {/* Status icon */}
                <View width={28} items="center" justify="center">
                    {isActive && <SpinnerIcon />}
                    {isDone && (
                        <Animated.View style={{ transform: [{ scale: statusAnim }] }}>
                            <CheckCircle2 size={22} color="$green9" />
                        </Animated.View>
                    )}
                    {isError && (
                        <Animated.View style={{ transform: [{ scale: statusAnim }] }}>
                            <AlertCircle size={22} color="$red9" />
                        </Animated.View>
                    )}
                    {isPending && <Clock size={20} color="$gray8" />}
                </View>

                {/* Mint info */}
                <YStack flex={1} gap="$0.5">
                    <Text fontWeight="700" fontSize="$4" numberOfLines={1}>{hostname}</Text>
                    <Text
                        fontSize="$2"
                        color={isActive ? '$blue10' : isDone ? '$green10' : isError ? '$red10' : '$gray9'}
                    >
                        {isActive ? 'Scanning for proofs…' :
                            isDone ? `Restored` :
                                isError ? (entry.error ?? 'Failed') :
                                    'Waiting…'}
                    </Text>
                </YStack>

                {/* Balance badge */}
                {isDone && entry.restoredBalance > 0 && (
                    <XStack
                        bg="$green4"
                        rounded="$3"
                        px="$2"
                        py="$1"
                        items="center"
                        gap="$1"
                    >
                        <Text fontSize="$3" fontWeight="800" color="$green10">
                            {entry.restoredBalance.toLocaleString()}
                        </Text>
                        <Text fontSize="$2" color="$green10">sats</Text>
                    </XStack>
                )}
                {isDone && entry.restoredBalance === 0 && (
                    <Text fontSize="$2" color="$gray9">0 sats</Text>
                )}
            </XStack>
        </Animated.View>
    )
}

// ── Main component ───────────────────────────────────────────────────────────

export function RestoreProgressStep({
    entries,
    isRestoring,
    totalRestoredSats,
    onDone,
}: RestoreProgressStepProps) {
    const doneMints = entries.filter(e => e.status === 'done').length
    const totalMints = entries.length
    const allDone = !isRestoring && entries.length > 0

    // Haptic on completion
    useEffect(() => {
        if (allDone) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        }
    }, [allDone])

    // Auto-scroll to currently scanning mint
    const scrollViewRef = useRef<any>(null)
    const activeIndex = entries.findIndex(e => e.status === 'scanning')
    useEffect(() => {
        if (activeIndex !== -1 && scrollViewRef.current) {
            // Approximate height of a row + gap is ~75px
            scrollViewRef.current.scrollTo({ y: activeIndex * 75, animated: true })
        }
    }, [activeIndex])

    // Pulse animation for the icon
    const pulseAnim = useRef(new Animated.Value(1)).current
    useEffect(() => {
        if (isRestoring) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 1.12, duration: 800, useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
                ])
            ).start()
        } else {
            pulseAnim.stopAnimation()
            Animated.spring(pulseAnim, { toValue: 1, useNativeDriver: true }).start()
        }
    }, [isRestoring])

    return (
        <YStack flex={1} bg="$background" px="$4" py="$6" gap="$5">

            {/* Header */}
            <YStack items="center" gap="$3" pt="$4">
                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                    <Circle
                        size={72}
                        bg={allDone ? '$green3' : '$blue3'}
                        borderWidth={2}
                        borderColor={allDone ? '$green7' : '$blue7'}
                        items="center"
                        justify="center"
                    >
                        <Zap
                            size={32}
                            color={allDone ? '$green9' : '$blue9'}
                            fill={allDone ? '$green9' : '$blue9'}
                        />
                    </Circle>
                </Animated.View>

                <YStack items="center" gap="$1">
                    <H2 fontSize="$8" fontWeight="800" style={{ textAlign: 'center' }}>
                        {allDone ? 'Restore Complete' : 'Restoring Wallet'}
                    </H2>
                    <Text color="$gray10" fontSize="$3" style={{ textAlign: 'center' }} px="$4">
                        {allDone
                            ? 'Your proofs have been recovered. You can always restore balances from other mints later by adding them in the app.'
                            : 'Scanning popular mints for your proofs. This may take a moment. You can also restore other mints later!'}
                    </Text>
                </YStack>

                {/* Total balance counter */}
                {totalRestoredSats > 0 && (
                    <XStack
                        bg="$green3"
                        borderWidth={1}
                        borderColor="$green7"
                        rounded="$5"
                        px="$5"
                        py="$2.5"
                        items="center"
                        gap="$2"
                    >
                        <Text fontSize="$7" fontWeight="900" color="$green10">
                            {totalRestoredSats.toLocaleString()}
                        </Text>
                        <Text fontSize="$4" color="$green10" fontWeight="600">sats</Text>
                    </XStack>
                )}

                {/* Progress text */}
                {isRestoring && totalMints > 0 && (
                    <Text color="$gray9" fontSize="$3">
                        {doneMints} of {totalMints} mint{totalMints !== 1 ? 's' : ''} scanned
                    </Text>
                )}
            </YStack>

            {/* Mint cards */}
            <ScrollView ref={scrollViewRef} flex={1} showsVerticalScrollIndicator={false}>
                <YStack gap="$2.5">
                    {entries.map(entry => (
                        <MintRow key={entry.mintUrl} entry={entry} />
                    ))}
                </YStack>
            </ScrollView>

            {/* Done button */}
            <YStack gap="$2" width="100%">
                <Button
                    size="$5"
                    theme={allDone ? 'accent' : 'gray'}
                    width="100%"
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                        onDone()
                    }}
                    disabled={isRestoring}
                    opacity={isRestoring ? 0.5 : 1}
                    fontWeight="700"
                    fontSize="$5"
                    rounded="$4"
                    pressStyle={{ scale: 0.98, opacity: 0.9 }}
                    icon={allDone ? <CheckCircle2 size={22} /> : undefined}
                >
                    {isRestoring ? `Scanning ${doneMints}/${totalMints}…` : 'Go to Wallet'}
                </Button>

                {isRestoring && (
                    <Button
                        size="$4"
                        chromeless
                        width="100%"
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                            onDone()
                        }}
                        color="$gray10"
                        fontWeight="600"
                        pressStyle={{ opacity: 0.7 }}
                    >
                        Skip and Go to Wallet
                    </Button>
                )}
            </YStack>
        </YStack>
    )
}
