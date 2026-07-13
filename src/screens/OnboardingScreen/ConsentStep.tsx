import React, { useState } from 'react';
import { YStack, XStack, Text, Button, H1, View, ScrollView, Separator } from 'tamagui';
import { Lock, Key, AlertTriangle, FileText, ChevronRight, Check, ArrowLeft, Landmark, Sprout } from '@tamagui/lucide-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Linking } from 'react-native';

interface ConsentStepProps {
    onComplete: () => void;
    onBack: () => void;
}

export function ConsentStep({ onComplete, onBack }: ConsentStepProps) {
    const insets = useSafeAreaInsets();
    const [checked, setChecked] = useState(false);

    const handleContinue = () => {
        if (!checked) return;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onComplete();
    };

    const handleOpenTerms = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        Linking.openURL('http://bey.cash/privacy-policy').catch(() => {});
    };

    return (
        <YStack
            flex={1}
            bg="$background"
            px="$4"
            style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
        >
            {/* Top Back Button */}
            <XStack justify="flex-start" py="$2">
                <Button
                    circular
                    chromeless
                    icon={<ArrowLeft size={24} color="$color" />}
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        onBack();
                    }}
                />
            </XStack>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, justifyContent: 'space-between', paddingBottom: 20 }}>
                <YStack gap="$6" flex={1}>
                    {/* Header */}
                    <YStack gap="$2" mt="$2">
                        <H1 fontSize="$8" textAlign="center" letterSpacing={-0.5} fontWeight="800" color="$color">
                            Risk Acknowledgment
                        </H1>
                    </YStack>

                    {/* Single unified list card container */}
                    <YStack
                        bg="$gray2"
                        rounded="$5"
                        overflow="hidden"
                        borderWidth={0}
                        separator={<Separator borderColor="$borderColor" opacity={0.4} />}
                    >
                        {/* Row 1: Only you control your funds */}
                        <XStack gap="$3" p="$3" items="center">
                            <View width={42} height={42} rounded="$3" bg="$blue3" items="center" justify="center">
                                <Lock size={20} color="$blue10" />
                            </View>
                            <YStack flex={1} gap="$1">
                                <Text fontWeight="800" fontSize="$4" color="$color">Only you control your funds</Text>
                                <Text fontSize="$2" color="$gray10" lineHeight={16}>
                                    Bey Wallet can't hold, freeze, or touch it.
                                </Text>
                            </YStack>
                        </XStack>

                        {/* Row 2: Your recovery phrase is the key */}
                        <XStack gap="$3" p="$3" items="center">
                            <View width={42} height={42} rounded="$3" bg="$purple3" items="center" justify="center">
                                <Key size={20} color="$purple10" />
                            </View>
                            <YStack flex={1} gap="$1">
                                <Text fontWeight="800" fontSize="$4" color="$color">Your recovery phrase is the key</Text>
                                <Text fontSize="$2" color="$gray10" lineHeight={16}>
                                    12 words secure your wallet.
                                </Text>
                            </YStack>
                        </XStack>

                        {/* Row 3: Lose the phrase, lose access */}
                        <XStack gap="$3" p="$3" items="center">
                            <View width={42} height={42} rounded="$3" bg="$red3" items="center" justify="center">
                                <AlertTriangle size={20} color="$red10" />
                            </View>
                            <YStack flex={1} gap="$1">
                                <Text fontWeight="800" fontSize="$4" color="$color">Lose the phrase, lose access</Text>
                                <Text fontSize="$2" color="$gray10" lineHeight={16}>
                                    No one can recover your wallet for you.
                                </Text>
                            </YStack>
                        </XStack>

                        {/* Row 4: Mints hold the backing Bitcoin */}
                        <XStack gap="$3" p="$3" items="center">
                            <View width={42} height={42} rounded="$3" bg="$orange3" items="center" justify="center">
                                <Landmark size={20} color="$orange10" />
                            </View>
                            <YStack flex={1} gap="$1">
                                <Text fontWeight="800" fontSize="$4" color="$color">Mints hold the backing Bitcoin</Text>
                                <Text fontSize="$2" color="$gray10" lineHeight={16}>
                                    If a mint shuts down, its tokens are lost.
                                </Text>
                            </YStack>
                        </XStack>

                        {/* Row 5: Experimental protocol */}
                        <XStack gap="$3" p="$3" items="center">
                            <View width={42} height={42} rounded="$3" bg="$green3" items="center" justify="center">
                                <Sprout size={20} color="$green10" />
                            </View>
                            <YStack flex={1} gap="$1">
                                <Text fontWeight="800" fontSize="$4" color="$color">Experimental protocol</Text>
                                <Text fontSize="$2" color="$gray10" lineHeight={16}>
                                    Avoid storing large balances in ecash.
                                </Text>
                            </YStack>
                        </XStack>

                        {/* Row 6: Read full Terms & Privacy */}
                        <XStack
                            gap="$3"
                            p="$3"
                            items="center"
                            pressStyle={{ bg: "$gray3" }}
                            onPress={handleOpenTerms}
                        >
                            <View width={42} height={42} rounded="$3" bg="$gray4" items="center" justify="center">
                                <FileText size={20} color="$gray10" />
                            </View>
                            <Text flex={1} fontWeight="800" fontSize="$4" color="$color">
                                Read full Terms & Privacy
                            </Text>
                            <ChevronRight size={18} color="$gray10" />
                        </XStack>
                    </YStack>
                </YStack>
            </ScrollView>

            {/* Footer with Checkbox & CTA */}
            <YStack gap="$4" py="$3" bg="$background">
                {/* Checkbox row */}
                <XStack
                    gap="$3"
                    p="$3.5"
                    items="flex-start"
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setChecked(!checked);
                    }}
                >
                    <View
                        width={22}
                        height={22}
                        rounded="$2"
                        borderWidth={2}
                        borderColor={checked ? "$accent9" : "$gray8"}
                        bg={checked ? "$accent9" : "transparent"}
                        items="center"
                        justify="center"
                        mt="$0.5"
                    >
                        {checked && <Check size={14} color="white" strokeWidth={4} />}
                    </View>
                    <Text fontSize="$3" color={checked ? "$accent5" : "$gray10"} flex={1} lineHeight={18}>
                        I understand I'm solely responsible for my recovery phrase, and I agree to the{' '}
                        <Text
                            color="$accent9"
                            fontWeight="700"
                            style={{ textDecorationLine: 'underline' }}
                            onPress={(e) => {
                                e.stopPropagation();
                                handleOpenTerms();
                            }}
                        >
                            Terms
                        </Text>
                        .
                    </Text>
                </XStack>

                <Button
                    size="$5"
                    theme={checked ? "accent" : "gray"}
                    width="100%"
                    onPress={handleContinue}
                    disabled={!checked}
                    fontSize="$5"
                    fontWeight="800"
                    rounded="$4"
                    height={55}
                    pressStyle={checked ? { scale: 0.98, opacity: 0.9 } : undefined}
                >
                    Agree & Continue
                </Button>
            </YStack>
        </YStack>
    );
}
