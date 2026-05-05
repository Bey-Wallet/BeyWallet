import React from 'react';
import { YStack, XStack, Text, Button, H1, Separator } from "tamagui";
import { Sprout, Zap } from "@tamagui/lucide-icons";
import { Spinner } from '../../components/UI/Spinner';
import { ProcessingSheet } from "~/components/UI/ProcessingSheet";
import * as Haptics from 'expo-haptics';

interface ConfirmStageProps {
    amount: string;
    mintUrl: string;
    isLoading?: boolean;
    onConfirm: () => void;
    onBack: () => void;
}

export function ConfirmStage({ amount, mintUrl, isLoading, onConfirm, onBack }: ConfirmStageProps) {
    const sats = parseInt(amount, 10);

    // Extract mint name from URL
    const getMintName = (url: string) => {
        try {
            const hostname = new URL(url).hostname;
            return hostname.replace('testnut.', '').replace('.cashu.space', '');
        } catch {
            return url;
        }
    };

    return (
        <YStack flex={1} gap="$2">
            <YStack width="100%" justify="space-between" height={260} bg="$gray2" rounded="$5" items="center" gap="$4" mb="$6">
                <Text width="100%" p="$3" text="center" borderBottomWidth={1} borderColor="$borderColor" fontWeight="800" fontSize="$5" color="$color">
                    Confirm Deposit
                </Text>
                <YStack items="center" justify="center">
                    <Text fontSize="$9" fontWeight="900" color="$green11">
                        +₿{Number(amount || 0).toLocaleString()}
                    </Text>
                    <Text fontSize="$5" fontWeight="600" color="$gray10">
                        Ecash SATS
                    </Text>
                </YStack>
                <YStack items="center" width="100%" gap="$1" p="$3" borderTopWidth={1} borderColor="$borderColor">
                    <Text color="$gray10" fontSize="$4" text="center">
                        You are about to request a Lightning invoice.
                    </Text>
                </YStack>
            </YStack>

            <YStack gap="$0" mb="$6" bg="$gray2" rounded="$5" overflow="hidden" separator={<Separator borderColor="$borderColor" opacity={0.5} />}>
                <DetailItem label="Mint" value={getMintName(mintUrl)} icon={<Sprout size={16} color="$green10" />} />
                <DetailItem label="Network" value="Lightning" icon={<Zap size={16} color="$yellow10" />} />
                <DetailItem label="Amount" value={`${sats} SATS`} />
            </YStack>

            <YStack mt="auto" pb="$0" gap="$3">
                <Button
                    theme="accent"
                    size="$5"
                    height={55}
                    rounded="$4"
                    fontWeight="800"
                    disabled={isLoading}
                    icon={isLoading ? <Spinner size="small" color="$color" /> : undefined}
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        onConfirm();
                    }}
                >
                    {isLoading ? 'Creating Invoice...' : 'Confirm Deposit'}
                </Button>
                <Button
                    bg="$gray3"
                    color="$color"
                    size="$5"
                    height={55}
                    rounded="$4"
                    fontWeight="800"
                    disabled={isLoading}
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        onBack();
                    }}
                >
                    Go Back
                </Button>
            </YStack>
            <ProcessingSheet
                visible={!!isLoading}
                title="Creating Invoice"
                amount={sats}
                detail={`Requesting from ${getMintName(mintUrl)}`}
            />
        </YStack>
    );
}

function DetailItem({ label, value, icon }: { label: string, value: string, icon?: React.ReactNode }) {
    return (
        <XStack justify="space-between" items="center" py="$3" px="$4">
            <Text fontSize="$3" color="$gray10" fontWeight="600">{label}</Text>
            <XStack gap="$2" items="center">
                {icon}
                <Text fontSize="$3" fontWeight="800" color="$color" numberOfLines={1} style={{ maxWidth: 200 }}>
                    {value}
                </Text>
            </XStack>
        </XStack>
    );
}

