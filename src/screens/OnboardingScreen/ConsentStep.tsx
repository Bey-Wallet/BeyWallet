import React, { useState } from 'react';
import { YStack, XStack, Text, Button, H1, View, ScrollView } from 'tamagui';
import { Check, ShieldAlert, Coins, Building2, ChevronRight, AlertTriangle } from '@tamagui/lucide-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ConsentStepProps {
    onComplete: () => void;
    onBack: () => void;
}

export function ConsentStep({ onComplete, onBack }: ConsentStepProps) {
    const insets = useSafeAreaInsets();

    const [checkedEcash, setCheckedEcash] = useState(false);
    const [checkedMints, setCheckedMints] = useState(false);
    const [checkedBackups, setCheckedBackups] = useState(false);
    const [checkedLiability, setCheckedLiability] = useState(false);

    const isAllChecked = checkedEcash && checkedMints && checkedBackups && checkedLiability;

    const handleContinue = () => {
        if (!isAllChecked) return;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onComplete();
    };

    return (
        <YStack
            flex={1}
            bg="$background"
            px="$4"
            justify="space-between"
            style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
        >
            {/* Header */}
            <YStack gap="$2" mt="$2">
                <H1 fontSize="$8" text="center" letterSpacing={-0.5} fontWeight="800" color="$color">
                    Risk Acknowledgment
                </H1>

            </YStack>

            {/* Checkbox Rows */}
            <ScrollView showsVerticalScrollIndicator={false} my="$3">
                <YStack gap="$2.5">
                    {/* Ecash Checkbox */}
                    <XStack
                        gap="$2.5"
                        p="$2.5"
                        bg="$gray2"
                        rounded="$4"
                        borderWidth={1.5}
                        borderColor={checkedEcash ? "$blue10" : "rgba(128,128,128,0.1)"}
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setCheckedEcash(!checkedEcash);
                        }}
                        pressStyle={{ opacity: 0.95 }}
                    >
                        <View
                            width={18}
                            height={18}
                            rounded="$1"
                            borderWidth={2}
                            borderColor={checkedEcash ? "$blue10" : "$gray8"}
                            bg={checkedEcash ? "$blue10" : "transparent"}
                            items="center"
                            justify="center"
                            mt="$0.5"
                        >
                            {checkedEcash && <Check size={11} color="white" strokeWidth={4} />}
                        </View>
                        <YStack flex={1} gap="$0.5">
                            <XStack gap="$2" items="center">
                                <Coins size={14} color={checkedEcash ? "$blue10" : "$gray10"} />
                                <Text fontWeight="700" fontSize="$3" color="$color">Ecash is Cash</Text>
                            </XStack>
                            <Text fontSize="$2" color="$gray10" lineHeight={15}>
                                Your funds are stored locally on this phone. If you delete this app or lose your phone without writing down your backup phrase, your funds are gone forever.
                            </Text>
                        </YStack>
                    </XStack>

                    {/* Mints Checkbox */}
                    <XStack
                        gap="$2.5"
                        p="$2.5"
                        bg="$gray2"
                        rounded="$4"
                        borderWidth={1.5}
                        borderColor={checkedMints ? "$orange10" : "rgba(128,128,128,0.1)"}
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setCheckedMints(!checkedMints);
                        }}
                        pressStyle={{ opacity: 0.95 }}
                    >
                        <View
                            width={18}
                            height={18}
                            rounded="$1"
                            borderWidth={2}
                            borderColor={checkedMints ? "$orange10" : "$gray8"}
                            bg={checkedMints ? "$orange10" : "transparent"}
                            items="center"
                            justify="center"
                            mt="$0.5"
                        >
                            {checkedMints && <Check size={11} color="white" strokeWidth={4} />}
                        </View>
                        <YStack flex={1} gap="$0.5">
                            <XStack gap="$2" items="center">
                                <Building2 size={14} color={checkedMints ? "$orange10" : "$gray10"} />
                                <Text fontWeight="700" fontSize="$3" color="$color">Mints Hold the Bitcoin</Text>
                            </XStack>
                            <Text fontSize="$2" color="$gray10" lineHeight={15}>
                                Mints are custodians holding the real Bitcoin backing your ecash. Mints are separate entities, not run by BeyWallet. Choose trustworthy mints to deposit with.
                            </Text>
                        </YStack>
                    </XStack>

                    {/* Backups Checkbox */}
                    <XStack
                        gap="$2.5"
                        p="$2.5"
                        bg="$gray2"
                        rounded="$4"
                        borderWidth={1.5}
                        borderColor={checkedBackups ? "$purple10" : "rgba(128,128,128,0.1)"}
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setCheckedBackups(!checkedBackups);
                        }}
                        pressStyle={{ opacity: 0.95 }}
                    >
                        <View
                            width={18}
                            height={18}
                            rounded="$1"
                            borderWidth={2}
                            borderColor={checkedBackups ? "$purple10" : "$gray8"}
                            bg={checkedBackups ? "$purple10" : "transparent"}
                            items="center"
                            justify="center"
                            mt="$0.5"
                        >
                            {checkedBackups && <Check size={11} color="white" strokeWidth={4} />}
                        </View>
                        <YStack flex={1} gap="$0.5">
                            <XStack gap="$2" items="center">
                                <ShieldAlert size={14} color={checkedBackups ? "$purple10" : "$gray10"} />
                                <Text fontWeight="700" fontSize="$3" color="$color">Backups Use Relays</Text>
                            </XStack>
                            <Text fontSize="$2" color="$gray10" lineHeight={15}>
                                BeyWallet encrypts and syncs your active balance silently to Nostr relays. You need your 12-word seed phrase to unlock and recover this data on a new device.
                            </Text>
                        </YStack>
                    </XStack>

                    {/* Liability Disclaimer Checkbox */}
                    <XStack
                        gap="$2.5"
                        p="$2.5"
                        bg="$gray2"
                        rounded="$4"
                        borderWidth={1.5}
                        borderColor={checkedLiability ? "$red10" : "rgba(128,128,128,0.1)"}
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setCheckedLiability(!checkedLiability);
                        }}
                        pressStyle={{ opacity: 0.95 }}
                    >
                        <View
                            width={18}
                            height={18}
                            rounded="$1"
                            borderWidth={2}
                            borderColor={checkedLiability ? "$red10" : "$gray8"}
                            bg={checkedLiability ? "$red10" : "transparent"}
                            items="center"
                            justify="center"
                            mt="$0.5"
                        >
                            {checkedLiability && <Check size={11} color="white" strokeWidth={4} />}
                        </View>
                        <YStack flex={1} gap="$0.5">
                            <XStack gap="$2" items="center">
                                <AlertTriangle size={14} color={checkedLiability ? "$red10" : "$gray10"} />
                                <Text fontWeight="700" fontSize="$3" color="$color">No Liability for Lost Funds</Text>
                            </XStack>
                            <Text fontSize="$2" color="$gray10" lineHeight={15}>
                                BeyWallet is self-custodial software. We do not control your keys, balance, mints, or relays, and are not liable for any funds lost due to device loss, software errors, or mint failure.
                            </Text>
                        </YStack>
                    </XStack>
                </YStack>
            </ScrollView>

            {/* Direction Prompt */}
            <Text
                fontSize="$2"
                fontWeight="700"
                text="center"
                color={isAllChecked ? "$green10" : "$orange10"}
                mb="$4"
                letterSpacing={0.5}
            >
                {isAllChecked ? "✓ All acknowledgments checked" : "Check all boxes to proceed"}
            </Text>

            {/* CTAs */}
            <YStack gap="$3" mb="$4">
                <Button
                    size="$5"
                    bg={isAllChecked ? "$accent10" : "$gray4"}
                    color={isAllChecked ? "white" : "$gray8"}
                    width="100%"
                    onPress={handleContinue}
                    disabled={!isAllChecked}
                    iconAfter={<ChevronRight size={18} color={isAllChecked ? "white" : "$gray8"} />}
                    fontSize="$5"
                    fontWeight="700"
                    rounded="$5"
                    pressStyle={isAllChecked ? { scale: 0.98, opacity: 0.9 } : undefined}
                >
                    I Acknowledge & Continue
                </Button>

                <Button
                    size="$4"
                    chromeless
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
                        onBack();
                    }}
                >
                    <Text color="$gray10" fontSize="$3" fontWeight="600">Back</Text>
                </Button>
            </YStack>
        </YStack>
    );
}
