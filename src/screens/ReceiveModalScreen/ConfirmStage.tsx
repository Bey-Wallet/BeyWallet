import React from 'react';
import { YStack, XStack, Text, Button, View, Separator, Circle, ScrollView, YGroup } from 'tamagui';
import { ArrowDownLeft, Check, ShieldCheck, AlertTriangle, Copy, Building2, DollarSign, Clock } from '@tamagui/lucide-icons';
import { Spinner } from '../../components/UI/Spinner';
import { ProcessingSheet } from '../../components/UI/ProcessingSheet';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { useToastController } from '@tamagui/toast';
import { useWalletStore } from '../../store/walletStore';
import { mintManager } from '../../services/core';
import { useSettingsStore } from '../../store/settingsStore';
import { useQuery } from '@tanstack/react-query';
import { bitcoinService } from '../../services/bitcoinService';
import { currencyService, CurrencyCode } from '../../services/currencyService';

interface TokenInfo {
    mint: string;
    amount: number;
    proofCount: number;
    preview?: {
        name?: string;
        description?: string;
    };
    p2pkNpub?: string;
}

interface ConfirmStageProps {
    token: string;
    tokenInfo: TokenInfo;
    isLoading?: boolean;
    onConfirm: () => void;
    onReceiveLater: () => void;
    onBack: () => void;
}

export function ConfirmStage({ token, tokenInfo, isLoading, onConfirm, onReceiveLater, onBack }: ConfirmStageProps) {
    const { mints } = useWalletStore();
    const { secondaryCurrency } = useSettingsStore();
    const toast = useToastController();
    const [isSavingLater, setIsSavingLater] = React.useState(false);
    const [estimatedFee, setEstimatedFee] = React.useState(0);

    const { data: btcData } = useQuery({
        queryKey: ['bitcoinPrice', secondaryCurrency],
        queryFn: () => bitcoinService.fetchPrice(secondaryCurrency),
        staleTime: 30000,
    });

    // Fetch fee for this mint
    React.useEffect(() => {
        if (tokenInfo.mint) {
            mintManager.getFeePpk(tokenInfo.mint).then(feePpk => {
                const fee = feePpk > 0 ? Math.ceil(tokenInfo.proofCount * feePpk / 1000) : 0;
                setEstimatedFee(fee);
            }).catch(() => setEstimatedFee(0));
        }
    }, [tokenInfo.mint, tokenInfo.proofCount]);

    // Check if mint is trusted
    const normalizeUrl = (url: string) => url.replace(/\/$/, '').toLowerCase();
    const isMintTrusted = mints.some(m =>
        normalizeUrl(m.mintUrl) === normalizeUrl(tokenInfo.mint) && m.trusted
    );

    // Get mint display name
    const getMintDisplayName = (url: string) => {
        if (tokenInfo.preview?.name) return tokenInfo.preview.name;
        try {
            return new URL(url).hostname;
        } catch {
            return url;
        }
    };

    const handleCopy = async (text: string, label: string) => {
        await Clipboard.setStringAsync(text);
        toast.show('Copied!', { message: `${label} copied to clipboard` });
        Haptics.selectionAsync();
    };


    return (
        <YStack flex={1} bg="$background">
            <ScrollView contentContainerStyle={{ paddingBottom: 250 } as any} showsVerticalScrollIndicator={false}>
                {/* Header Section */}
                <YStack items="center" py="$6" gap="$4">

                    <YStack items="center">
                        <XStack items="center" gap="$2">
                            <Text fontSize={32} fontWeight="700" color="$green11">
                                +{tokenInfo.amount}
                            </Text>
                            <Text fontSize={20} fontWeight="500" color="$gray10" mt="$2">
                                SATS
                            </Text>
                        </XStack>
                        <Text fontSize="$4" color="$gray10" mt="$1">
                            Ready to Receive
                        </Text>
                    </YStack>
                </YStack>



                {/* Warning for untrusted mint */}
                {!isMintTrusted && (
                    <YStack mx="$4" mb="$6" bg="$orange3" p="$3" rounded="$3" gap="$2">
                        <XStack gap="$2" items="center">
                            <AlertTriangle size={18} color="$orange10" />
                            <Text color="$orange10" fontSize="$3" fontWeight="bold">
                                Untrusted Mint
                            </Text>
                        </XStack>
                        <Text color="$orange10" fontSize="$3">
                            You are about to add and trust this mint to receive funds.
                            {tokenInfo.preview ? ' Review the details below.' : ''}
                        </Text>
                    </YStack>
                )}


                <YStack mx="$4" bg="$gray2" rounded="$5" overflow="hidden">
                    <YGroup separator={<Separator borderColor="$borderColor" opacity={0.5} />}>
                        <DetailItem
                            label="Amount"
                            value={`${tokenInfo.amount} sats`}
                        />
                        <DetailItem
                            label="Fiat"
                            value={btcData?.price ? currencyService.formatValue(currencyService.convertSatsToCurrency(tokenInfo.amount, btcData.price), secondaryCurrency as CurrencyCode) : '...'}
                        />
                        <DetailItem
                            label="Proofs"
                            value={tokenInfo.proofCount.toString()}
                        />
                        {tokenInfo.p2pkNpub && (
                            <DetailItem
                                label="Locked To"
                                value={tokenInfo.p2pkNpub === useSettingsStore.getState().npub ? "You (Safe)" : `${tokenInfo.p2pkNpub.substring(0, 10)}...${tokenInfo.p2pkNpub.substring(tokenInfo.p2pkNpub.length - 6)}`}
                                isCopyable={tokenInfo.p2pkNpub !== useSettingsStore.getState().npub}
                                onCopy={() => handleCopy(tokenInfo.p2pkNpub!, "NPUB")}
                            />
                        )}
                        <DetailItem
                            label="Mint"
                            value={getMintDisplayName(tokenInfo.mint)}
                            isCopyable
                            onCopy={() => handleCopy(tokenInfo.mint, "Mint URL")}
                        />
                        {tokenInfo.preview?.description && (
                            <DetailItem label="Description" value={tokenInfo.preview.description} />
                        )}
                        {estimatedFee > 0 && (
                            <>
                                <DetailItem
                                    label="Fee"
                                    value={`-${estimatedFee} sats`}
                                />
                                <DetailItem
                                    label="You Receive"
                                    value={`${tokenInfo.amount - estimatedFee} sats`}
                                />
                            </>
                        )}
                    </YGroup>
                </YStack>

            </ScrollView>

            <YStack position="absolute" b="$4" l="$4" r="$4" gap="$2">
                <Button
                    bg="$gray3"
                    color="$color"
                    height={50}
                    rounded="$4"
                    disabled={isLoading}
                    icon={isSavingLater ? <Spinner size="small" color="$color" /> : <Clock size={18} color="$gray10" />}
                    fontWeight="700" fontSize="$5"
                    onPress={async () => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        setIsSavingLater(true);
                        try {
                            await onReceiveLater();
                        } finally {
                            setIsSavingLater(false);
                        }
                    }}
                    pressStyle={{ opacity: 0.9, scale: 0.98 }}
                >
                    {isSavingLater ? 'Saving...' : 'Receive Later'}
                </Button>





                <Button
                    bg={isMintTrusted ? "$green9" : "$orange9"}
                    color="white"
                    height={50}
                    rounded="$4"
                    disabled={isLoading}
                    icon={isLoading ? <Spinner size="small" color="white" /> : undefined}
                    fontWeight="700" fontSize="$5"
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                        onConfirm();
                    }}
                    pressStyle={{ opacity: 0.9, scale: 0.98 }}
                >

                    {isLoading ? 'Receiving...' : (isMintTrusted ? 'Receive' : 'Trust & Receive')}

                </Button>


            </YStack>
            <ProcessingSheet
                visible={!!isLoading}
                title="Receiving"
                amount={tokenInfo.amount}
                detail={`Receiving from ${getMintDisplayName(tokenInfo.mint)}`}
            />
        </YStack >
    );
}

function DetailItem({ label, value, isCopyable, onCopy }: { label: string, value: string, isCopyable?: boolean, onCopy?: () => void }) {
    return (
        <XStack justify="space-between" items="center" py="$3" px="$4">
            <Text fontSize="$3" color="$gray10" fontWeight="600">{label}</Text>
            <XStack gap="$2" items="center">
                <Text fontSize="$3" fontWeight="800" color="$color" numberOfLines={1} style={{ maxWidth: 200 }}>
                    {value}
                </Text>
                {isCopyable && (
                    <Button size="$2" chromeless icon={<Copy size={16} color="$gray10" />} onPress={onCopy} />
                )}
            </XStack>
        </XStack>
    );
}
