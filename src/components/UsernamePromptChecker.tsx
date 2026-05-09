import React, { useEffect, useRef, useState } from 'react';

import { Button, Text, YStack, useTheme, XStack, View } from 'tamagui';
import { useRouter } from 'expo-router';
import AppBottomSheet, { AppBottomSheetRef } from './UI/AppBottomSheet';
import { AtSign } from '@tamagui/lucide-icons';
import { useOnboardingStore } from '~/store/onboardingStore';
import { useSettingsStore } from '~/store/settingsStore';
import { useNip05Lookup } from '~/hooks/useNip05Lookup';

export function UsernamePromptChecker() {
    const sheetRef = useRef<AppBottomSheetRef>(null);
    const router = useRouter();
    const theme = useTheme();
    const { isOnboarded } = useOnboardingStore();
    const isSettingsInitialized = useSettingsStore(state => state.initialized);
    const { nip05, loading } = useNip05Lookup();
    const [hasPrompted, setHasPrompted] = useState(false);

    useEffect(() => {
        // Wait for fully onboarded, settings loaded, and lookup finished
        if (!isOnboarded || !isSettingsInitialized || loading || hasPrompted) return;

        // Give it a brief delay before checking
        const timeout = setTimeout(() => {
            if (!nip05) {
                sheetRef.current?.present();
                setHasPrompted(true); // Don't prompt again in this session
            }
        }, 3000);

        return () => clearTimeout(timeout);
    }, [isOnboarded, isSettingsInitialized, loading, nip05, hasPrompted]);

    return (
        <AppBottomSheet ref={sheetRef} snapPoints={['43%']}>
            <YStack p="$4" gap="$4" items="center" flex={1}>
                <View p="$3" bg="$blue9" rounded={1000} mb="$2">
                    <AtSign size={32} color={"white"} />
                </View>
                <Text fontSize={20} fontWeight="bold" textAlign="center">
                    Claim Your Free Username
                </Text>
                <Text fontSize={16} color="$color11" textAlign="center" marginBottom="$4">
                    It looks like you haven't claimed a bey.cash username yet. Claim one now to make it easier for friends to send you money!
                </Text>
                <XStack space="$3" width="100%" justifyContent="center" marginTop="auto">
                    <Button flex={1} size="$4" onPress={() => sheetRef.current?.dismiss()}>
                        Maybe Later
                    </Button>
                    <Button
                        flex={1}
                        size="$4"
                        bg="$blue9"
                        color="white"
                        fontWeight="500"
                        onPress={() => {
                            sheetRef.current?.dismiss();
                            setTimeout(() => {
                                router.push('/(modals)/nostr-username');
                            }, 300);
                        }}
                    >
                        Claim Now
                    </Button>
                </XStack>
            </YStack>
        </AppBottomSheet>
    );
}
