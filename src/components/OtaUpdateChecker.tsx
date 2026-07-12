import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Button, Text, YStack, useTheme, XStack } from 'tamagui';
import * as Updates from 'expo-updates';
import { useRouter } from 'expo-router';
import AppBottomSheet, { AppBottomSheetRef } from './UI/AppBottomSheet';
import { Download } from '@tamagui/lucide-icons';

export function OtaUpdateChecker() {
    const sheetRef = useRef<AppBottomSheetRef>(null);
    const router = useRouter();
    const theme = useTheme();
    const [hasUpdate, setHasUpdate] = useState(false);

    useEffect(() => {
        async function checkUpdates() {
            try {
                if (__DEV__) return; // Skip in development
                
                const update = await Updates.checkForUpdateAsync();
                if (update.isAvailable) {
                    setHasUpdate(true);
                    // Slight delay to ensure UI is ready
                    setTimeout(() => {
                        sheetRef.current?.present();
                    }, 1000);
                }
            } catch (error) {
                console.log('Error checking for updates', error);
            }
        }
        
        checkUpdates();
    }, []);

    if (!hasUpdate) return null;

    return (
        <AppBottomSheet ref={sheetRef}>
            <YStack padding="$4" space="$4" alignItems="center">
                <View style={{ backgroundColor: theme.color5?.val, padding: 16, borderRadius: 50, marginBottom: 8 }}>
                    <Download size={32} color={theme.color?.val} />
                </View>
                <Text fontSize={20} fontWeight="bold" textAlign="center">
                    Update Available
                </Text>
                <Text fontSize={16} color="$color11" textAlign="center" marginBottom="$4">
                    A new version of Bey Wallet is available. Update now to get the latest features and bug fixes.
                </Text>
                <XStack space="$3" width="100%" justifyContent="center" marginTop="$2">
                    <Button flex={1} size="$4" onPress={() => sheetRef.current?.dismiss()}>
                        Later
                    </Button>
                    <Button 
                        flex={1} 
                        size="$4"
                        theme="active" 
                        onPress={() => {
                            sheetRef.current?.dismiss();
                            // Small delay to let the sheet close before navigating
                            setTimeout(() => {
                                router.push('/(modals)/ota-update');
                            }, 300);
                        }}
                    >
                        Update Now
                    </Button>
                </XStack>
            </YStack>
        </AppBottomSheet>
    );
}
