import React from 'react';
import { router } from 'expo-router';
import { YStack, XStack, Text, Button, View, TextArea, ScrollView } from 'tamagui';
import { Scan, Nfc, AlertCircle, ClipboardPaste } from '@tamagui/lucide-icons';
import { Spinner } from '../../components/UI/Spinner';
import * as Haptics from 'expo-haptics';
import * as ClipboardAPI from 'expo-clipboard';

interface InputStageProps {
    token: string;
    setToken: (val: string) => void;
    isLoading?: boolean;
    error?: string | null;
    onContinue: () => void;
    onScanPress?: () => void;
}

export function InputStage({ token, setToken, isLoading, error, onContinue, onScanPress }: InputStageProps) {
    const handlePaste = async () => {
        const text = await ClipboardAPI.getStringAsync();
        if (text) {
            setToken(text);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
    };

    const isPaymentRequest = token.trim().toLowerCase().startsWith('creqa') ||
        token.trim().toLowerCase().startsWith('creqb');

    const isValidToken = !isPaymentRequest && token.trim().length > 5 && (
        token.trim().toLowerCase().includes('cashu') ||
        token.trim().toLowerCase().includes('creq') ||
        token.trim().toLowerCase().startsWith('lnbc') ||
        token.trim().toLowerCase().startsWith('lnurl') ||
        token.trim().toLowerCase().includes('/c/#') ||
        // Check for variation selectors (Peanut format)
        /[\uFE00-\uFE0F\u{E0100}-\u{E01EF}]/u.test(token)
    );

    const [lastAttemptedToken, setLastAttemptedToken] = React.useState('');

    // Reset last attempted token when token is cleared
    React.useEffect(() => {
        if (!token.trim()) {
            setLastAttemptedToken('');
        }
    }, [token]);

    React.useEffect(() => {
        const trimmed = token.trim();
        if (isValidToken && !isLoading && !error && trimmed !== lastAttemptedToken) {
            setLastAttemptedToken(trimmed);
            onContinue();
        }
    }, [token, isValidToken, isLoading, error, lastAttemptedToken, onContinue]);

    const handleScanPress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onScanPress?.();
    };

    return (
        <YStack flex={1} bg="$background" p="$4">
            <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
                <YStack gap="$4">
                    {/* Token Input Card */}
                    <YStack bg="$gray2" rounded="$4" p="$4" minH={250}>
                        <XStack justify="space-between" items="center" mb="$2">
                            <Text color="$gray10" fontSize="$4" fontWeight="600">Enter Token</Text>
                            <Button
                                size="$2.5"
                                theme="gray"
                                onPress={handlePaste}
                                icon={<ClipboardPaste size={14} />}
                                scaleIcon={1.2}
                            >
                                Paste
                            </Button>
                        </XStack>
                        <TextArea
                            value={token}
                            onChangeText={setToken}
                            placeholder="Usage: Paste Cashu token, Lightning invoice, or LNURL..."
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

                    <Text fontSize="$4" fontWeight="600" text="center" color="$gray10" ml="$1" mt="$2">
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
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                router.push('/(modals)/nfc-receive');
                            }}
                            pressStyle={{ bg: '$gray3' }}
                        >
                            <YStack items="center" gap="$2">
                                <View bg="$gray4" p="$3" rounded="$10">
                                    <Nfc size={24} color="$color" />
                                </View>
                                <Text fontSize="$4" fontWeight="600" color="$color">NFC</Text>
                            </YStack>
                        </Button>
                    </XStack>
                </YStack>
            </ScrollView>

            {/* Action Button at the Bottom */}
            <View position="absolute" px="$4" bottom="$4" left="$0" right="$0">
                {isValidToken ? (
                    <Button
                        theme="active"
                        bg="$green9"
                        color="white"
                        size="$5"
                        fontWeight="700"
                        rounded="$4"
                        disabled={isLoading}
                        icon={isLoading ? <Spinner size="small" color="white" /> : undefined}
                        onPress={onContinue}
                        pressStyle={{ opacity: 0.9, scale: 0.98 }}
                    >
                        {isLoading ? 'Decoding...' : 'Preview Token'}
                    </Button>
                ) : (
                    <Button
                        theme="gray"
                        
                        color="$color"
                        size="$5"
                        fontWeight="700"
                        rounded="$4"
                        icon={<ClipboardPaste size={18} />}
                        onPress={handlePaste}
                        pressStyle={{ opacity: 0.9, scale: 0.98 }}
                    >
                        Paste from Clipboard
                    </Button>
                )}
            </View>
        </YStack>
    );
}
