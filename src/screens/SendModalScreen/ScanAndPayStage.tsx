import React from 'react';
import { YStack, XStack, Text, Button, View, TextArea, ScrollView } from 'tamagui';
import { Scan, Nfc, AlertCircle, ClipboardPaste } from '@tamagui/lucide-icons';
import { Spinner } from '~/components/UI/Spinner';
import * as Haptics from 'expo-haptics';
import * as ClipboardAPI from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useWalletStore } from '~/store/walletStore';
import { useEffect } from 'react';

interface ScanAndPayStageProps {
    input: string;
    setInput: (val: string) => void;
    isLoading?: boolean;
    error?: string | null;
    onContinue: (forcedInput?: string) => void;
}

export function ScanAndPayStage({ input, setInput, isLoading, error, onContinue }: ScanAndPayStageProps) {
    const router = useRouter();
    const scannerResult = useWalletStore(state => state.scannerResult);
    const setScannerResult = useWalletStore(state => state.setScannerResult);

    useEffect(() => {
        if (scannerResult) {
            setInput(scannerResult);
            setScannerResult(null);
            // Pass scannerResult directly to avoid stale closure
            onContinue(scannerResult);
        }
    }, [scannerResult, setInput, setScannerResult, onContinue]);

    const handlePaste = async () => {
        const text = await ClipboardAPI.getStringAsync();
        if (text) {
            setInput(text);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
    };

    const isLikelyValid = input.trim().length > 5;

    const handleScanPress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push({
            pathname: '/(modals)/scanner',
            params: { returnTo: '/send' }
        });
    };

    return (
        <YStack flex={1} bg="$background" p="$0" pt="$4">
            <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
                <YStack gap="$4">
                    {/* Input Card */}
                    <YStack bg="$gray2" rounded="$4" p="$4" minHeight={180}>
                        <XStack justify="space-between" items="center" mb="$2">
                            <Text color="$gray10" fontSize="$4" fontWeight="600">Enter Payment Request</Text>
                            <Button
                                size="$2.5"
                                bg="$gray4"
                                onPress={handlePaste}
                                icon={<ClipboardPaste size={14} color="$gray10" />}
                                scaleIcon={1.2}
                            >
                                <Text color="$gray10" fontWeight="600">Paste</Text>
                            </Button>
                        </XStack>
                        <TextArea
                            value={input}
                            onChangeText={setInput}
                            placeholder="Usage: Paste payment request (creq...) or Cashu token..."
                            bg="transparent"
                            borderWidth={0}
                            fontSize="$5"
                            color="$color"
                            p={0}
                            flex={1}
                            textAlignVertical="top"
                            placeholderTextColor="$gray8"
                            selectionColor="$green9"
                        />
                    </YStack>

                    {/* Error Display */}
                    {error && (
                        <XStack bg="$red3" p="$3" rounded="$3" gap="$2" items="center">
                            <AlertCircle size={18} color="$red10" />
                            <Text color="$red10" fontSize="$3" flex={1}>{error}</Text>
                        </XStack>
                    )}

                    <Text fontSize="$4" fontWeight="600" color="$gray10" ml="$1" mt="$2">
                        Or scan code
                    </Text>

                    {/* Scanning Options */}
                    <XStack gap="$3">
                        <Button
                            flex={1}
                            height={100}
                            bg="$gray2"
                            rounded="$4"
                            onPress={handleScanPress}
                            pressStyle={{ bg: '$gray3' }}
                        >
                            <YStack items="center" gap="$2">
                                <View bg="$gray4" p="$3" rounded="$10">
                                    <Scan size={24} color="$color" />
                                </View>
                                <Text fontSize="$4" fontWeight="600" color="$color">QR Code</Text>
                            </YStack>
                        </Button>

                        <Button
                            flex={1}
                            height={100}
                            bg="$gray2"
                            rounded="$4"
                            disabled
                            opacity={0.5}
                        >
                            <YStack items="center" gap="$2">
                                <View bg="$gray4" p="$3" rounded="$10">
                                    <Nfc size={24} color="$gray10" />
                                </View>
                                <Text fontSize="$4" fontWeight="600" color="$gray10">NFC</Text>
                            </YStack>
                        </Button>
                    </XStack>
                </YStack>
            </ScrollView>

            {/* Continue Button */}
            {isLikelyValid && (
                <View position="absolute" px="$0" bottom="$4" left="$0" right="$0">
                    <Button
                        theme="active"
                        bg="$green9"
                        color="white"
                        size="$5"
                        fontWeight="700"
                        rounded="$4"
                        disabled={isLoading}
                        icon={isLoading ? <Spinner size="small" color="white" /> : undefined}
                        onPress={() => onContinue()}
                        pressStyle={{ opacity: 0.9, scale: 0.98 }}
                    >
                        {isLoading ? 'Processing...' : 'Preview Payment'}
                    </Button>
                </View>
            )}
        </YStack>
    );
}
