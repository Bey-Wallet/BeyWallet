import React from 'react'
import {
    YStack, XStack, Text, Image, View, ScrollView,
    Separator, H1, H3
} from 'tamagui'
import {
    ShieldCheck, Zap, Globe, Lock, RefreshCw,
    Github, ExternalLink, Heart, RadioReceiver
} from '@tamagui/lucide-icons'
import { useRouter } from 'expo-router'
import { Linking } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants'

const APP_VERSION = Constants.expoConfig?.version ?? '0.1.0'
const BUILD_NUMBER =
    Constants.expoConfig?.ios?.buildNumber ??
    Constants.expoConfig?.android?.versionCode?.toString() ??
    '1'

interface FeatureRowProps {
    icon: React.ReactNode
    title: string
    description: string
}

function FeatureRow({ icon, title, description }: FeatureRowProps) {
    return (
        <XStack gap="$3" items="flex-start" py="$2">
            <View
                width={38} height={38} rounded="$4"
                bg="$gray3" items="center" justify="center"
                mt="$0.5" flexShrink={0}
            >
                {icon}
            </View>
            <YStack flex={1} gap="$0.5">
                <Text fontWeight="600" fontSize="$4" color="$color">{title}</Text>
                <Text fontSize="$3" color="$gray10" lineHeight="$4">{description}</Text>
            </YStack>
        </XStack>
    )
}

interface LinkRowProps {
    label: string
    url: string
    icon?: React.ReactNode
}

function LinkRow({ label, url, icon }: LinkRowProps) {
    return (
        <XStack
            items="center" justify="space-between"
            py="$3" px="$4"
            pressStyle={{ opacity: 0.7 }}
            animation="quick"
            onPress={() => Linking.openURL(url)}
        >
            <XStack gap="$3" items="center">
                {icon && (
                    <View width={32} height={32} rounded="$3"
                        bg="$gray3" items="center" justify="center">
                        {icon}
                    </View>
                )}
                <Text fontWeight="500" fontSize="$4">{label}</Text>
            </XStack>
            <ExternalLink size={16} color="$gray9" />
        </XStack>
    )
}

export default function AboutModal() {
    const insets = useSafeAreaInsets();

    return (
        <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: insets.bottom + 48 }}
            showsVerticalScrollIndicator={false}
        >
            <YStack gap="$0">

                {/* ── Hero ── */}
                <YStack items="center" pt="$8" pb="$6" gap="$4" bg="$background">
                    <View

                        rounded="$8"
                        overflow="hidden"
                        borderWidth={1}
                        p="$5"
                        bg="white"
                        borderColor="$borderColor"
                        elevation={4}
                    >
                        <Image
                            source={require('../../assets/icons/bey-logo-black-transparent.png')}
                            style={{ width: 50, height: 50 }}
                            resizeMode="cover"
                        />
                    </View>

                    <YStack items="center" gap="$1">
                        <H1 fontSize="$8" fontWeight="800" letterSpacing={-0.5}>Bey Wallet</H1>
                        <Text color="$gray10" fontSize="$3">Modular, Local-First Cashu Wallet</Text>
                    </YStack>

                    {/* Version pill */}
                    <XStack
                        bg="$gray3" rounded="$10" px="$4" py="$2"
                        borderWidth={1} borderColor="$borderColor"
                        gap="$2" items="center"
                    >
                        <View width={8} height={8} rounded="$10" bg="$green9" />
                        <Text fontSize="$2" fontWeight="600" color="$accent4">
                            Version {APP_VERSION}  ·  Build {BUILD_NUMBER}
                        </Text>
                    </XStack>
                </YStack>

                <Separator borderColor="$borderColor" mx="$4" />

                {/* ── What's in 1.1.0 ── */}
                <YStack px="$4" pt="$5" pb="$2" gap="$1">
                    <H3 fontSize="$5" fontWeight="700">What's New in 0.1.0</H3>
                    <Text fontSize="$2" color="$gray10">Latest release · May 2026</Text>
                </YStack>

                <YStack
                    mx="$4" bg="$gray2" rounded="$5" px="$4" py="$3"
                    borderWidth={1} borderColor="$borderColor" gap="$1"
                >
                    {[
                        '💳  Offline NFC Ecash payments & requests',
                        '📩  Encrypted Nostr DM payments & ecash requests',
                        '👤  NIP-05 @bey.cash address registration',
                        '📁  Wallet file export & import (.bey backup)',
                        '🏦  Mint Picker during new wallet setup',
                        '🔄  Full wallet restore from backup file',
                        '🖼️  Live mint icons fetched from /v1/info',
                    ].map((item, i) => (
                        <XStack key={i} gap="$2" py="$1" items="flex-start">
                            <Text fontSize="$3" color="$accent4" lineHeight="$4">{item}</Text>
                        </XStack>
                    ))}
                </YStack>

                <Separator borderColor="$borderColor" mx="$4" mt="$5" />

                {/* ── Features ── */}
                <YStack px="$4" pt="$5" pb="$2">
                    <H3 fontSize="$5" fontWeight="700">Features</H3>
                </YStack>

                <YStack px="$4" gap="$1">
                    <FeatureRow
                        icon={<Zap size={18} color="$yellow10" />}
                        title="Cashu Ecash"
                        description="V3 & V4 token support with multi-mint management and parallel keyset recovery."
                    />
                    <Separator borderColor="$borderColor" opacity={0.4} />
                    <FeatureRow
                        icon={<Lock size={18} color="$blue10" />}
                        title="Local-First & Private"
                        description="All data stored on-device in SQLite. Your keys never leave the secure enclave."
                    />
                    <Separator borderColor="$borderColor" opacity={0.4} />
                    <FeatureRow
                        icon={<RefreshCw size={18} color="$green10" />}
                        title="Deterministic Restore"
                        description="Restore your full balance from just a 12-word seed phrase via NIP-06."
                    />
                    <Separator borderColor="$borderColor" opacity={0.4} />
                    <FeatureRow
                        icon={<Globe size={18} color="$purple10" />}
                        title="Nostr Identity & DMs"
                        description="NIP-05 @bey.cash alias, P2PK locking, and automated ecash requests via encrypted DMs."
                    />
                    <Separator borderColor="$borderColor" opacity={0.4} />
                    <FeatureRow
                        icon={<RadioReceiver size={18} color="$cyan10" />}
                        title="Offline NFC"
                        description="Send and receive ecash seamlessly by tapping phones, even without internet."
                    />
                    <Separator borderColor="$borderColor" opacity={0.4} />
                    <FeatureRow
                        icon={<ShieldCheck size={18} color="$orange10" />}
                        title="Biometric Security"
                        description="Face ID, Touch ID, or passcode guards all sensitive operations."
                    />
                </YStack>

                <Separator borderColor="$borderColor" mx="$4" mt="$5" />

                {/* ── Links ── */}
                <YStack px="$4" pt="$5" pb="$2">
                    <H3 fontSize="$5" fontWeight="700">Links</H3>
                </YStack>

                <YStack mx="$4" bg="$gray2" rounded="$5"
                    borderWidth={1} borderColor="$borderColor" overflow="hidden">
                    <LinkRow
                        label="GitHub"
                        url="https://github.com"
                        icon={<Github size={16} color="$color" />}
                    />
                    <Separator borderColor="$borderColor" opacity={0.5} />
                    <LinkRow
                        label="Cashu Protocol"
                        url="https://cashu.space"
                        icon={<Zap size={16} color="$yellow10" />}
                    />
                    <Separator borderColor="$borderColor" opacity={0.5} />
                    <LinkRow
                        label="Nostr Protocol"
                        url="https://nostr.com"
                        icon={<Globe size={16} color="$purple10" />}
                    />
                </YStack>

                {/* ── Footer ── */}
                <YStack items="center" pt="$8" pb="$4" gap="$2">
                    <XStack gap="$1" items="center">
                        <Text fontSize="$2" color="$gray9">Made with</Text>
                        <Heart size={12} color="#ef4444" fill="#ef4444" />
                        <Text fontSize="$2" color="$gray9">for Bitcoin & Nostr</Text>
                    </XStack>
                    <Text fontSize="$1" color="$gray8">MIT License © Bey Wallet</Text>
                </YStack>

            </YStack>
        </ScrollView>
    )
}
