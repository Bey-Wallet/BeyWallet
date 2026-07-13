import React, { useState } from 'react';
import { YStack, Text, View, XStack, Button } from 'tamagui';
import { AlertTriangle, Copy, Check, Trash2 } from '@tamagui/lucide-icons';
import { ActivityIndicator } from 'react-native';
import AppBottomSheet, { AppBottomSheetRef } from '~/components/UI/AppBottomSheet';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';

interface DeleteWalletSheetProps {
    innerRef: React.RefObject<AppBottomSheetRef>;
    isDeleting: boolean;
    seedWords: string[];
    onDelete: () => void;
    onCancel: () => void;
}

export const DeleteWalletSheet: React.FC<DeleteWalletSheetProps> = ({
    innerRef,
    isDeleting,
    seedWords,
    onDelete,
    onCancel
}) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        const text = seedWords.join(' ');
        if (text) {
            await Clipboard.setStringAsync(text);
            setCopied(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <AppBottomSheet ref={innerRef} snapPoints={['85%']}>
            <YStack p="$4" gap="$4">
                {/* Warning */}
                <View bg="$red3" p="$4" rounded="$4" borderWidth={1} borderColor="$red8">
                    <XStack gap="$3">
                        <AlertTriangle color="$red10" size={24} />
                        <YStack flex={1}>
                            <Text color="$red10" fontWeight="700" fontSize="$5">
                                Delete Wallet
                            </Text>
                            <Text color="$red10" fontSize="$3" mt="$1">
                                This will permanently delete all wallet data including proofs, mints, and history. Back up your seed phrase before proceeding!
                            </Text>
                        </YStack>
                    </XStack>
                </View>

                {/* Seed Display */}
                <YStack gap="$3">
                    <XStack justify="space-between" items="center">
                        <Text fontWeight="700" fontSize="$5">Recovery Phrase</Text>
                        <Button
                            size="$3"
                            chromeless
                            icon={copied ? <Check size={18} color="$green9" /> : <Copy size={18} />}
                            onPress={handleCopy}
                        >
                            {copied ? 'Copied' : 'Copy'}
                        </Button>
                    </XStack>

                    <View
                        bg="$gray3"
                        p="$3"
                        rounded="$4"
                        borderWidth={1}
                        borderColor="$borderColor"
                    >
                        <XStack flexWrap="wrap" gap="$2" justify="center">
                            {seedWords.map((word, index) => (
                                <XStack
                                    key={index}
                                    bg="$background"
                                    px="$3"
                                    py="$2"
                                    rounded="$3"
                                    borderWidth={1}
                                    borderColor="$borderColor"
                                    minW="45%"
                                    items="center"
                                >
                                    <Text fontSize="$2" color="$gray10" mr="$2" width={20}>
                                        {index + 1}
                                    </Text>
                                    <Text
                                        fontSize="$4"
                                        fontWeight="600"
                                    >
                                        {word}
                                    </Text>
                                </XStack>
                            ))}
                        </XStack>
                    </View>
                </YStack>

                {/* Delete Buttons */}
                <YStack gap="$3" mt="$2">
                    {isDeleting ? (
                        <YStack items="center" gap="$3" py="$4">
                            <ActivityIndicator size="large" color="#ff0000" />
                            <Text color="$red10" fontWeight="600">Deleting wallet...</Text>
                        </YStack>
                    ) : (
                        <>
                            <Button
                                size="$5"
                                bg="$red9"
                                color="white"
                                fontWeight="700"
                                rounded="$4"
                                onPress={onDelete}
                                pressStyle={{ scale: 0.98, bg: '$red10' }}
                                icon={<Trash2 size={20} color="white" />}
                            >
                                I've Backed Up, Delete Everything
                            </Button>
                            <Button
                                size="$5"
                                theme="gray"
                                fontWeight="700"
                                rounded="$4"
                                onPress={onCancel}
                            >
                                Cancel
                            </Button>
                        </>
                    )}
                </YStack>
            </YStack>
        </AppBottomSheet>
    );
};
