import React, { useState, useCallback, useEffect, useRef } from 'react';
import { InteractionManager } from 'react-native';
import { useRouter } from 'expo-router';
import { YStack, XStack, Text, Button, View, Separator, Spinner, ScrollView, YGroup, Avatar } from 'tamagui';
import { RefreshCw, ShieldCheck, Landmark, Zap, ArrowUpDown, Sprout } from '@tamagui/lucide-icons';
import { Image } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useWalletStore } from '~/store/walletStore';
import { walletService, mintManager, quotesService } from '~/services/core';
import { currencyService } from '~/services/currencyService';
import { useSettingsStore } from '~/store/settingsStore';
import { useQuery } from '@tanstack/react-query';
import { bitcoinService } from '~/services/bitcoinService';

import { AmountStage } from './AmountStage';
import { ResultStage } from './ResultStage';

type SwapStep = 'amount' | 'confirm' | 'result';

export default function SwapScreen() {
    const router = useRouter();
    const mints = useWalletStore(s => s.mints);
    const balances = useWalletStore(s => s.balances);
    const refreshBalance = useWalletStore(s => s.refreshBalance);

    const [step, setStep] = useState<SwapStep>('amount');
    const [amount, setAmount] = useState('0');

    const activeMintUrl = useWalletStore(s => s.activeMintUrl);

    // We auto-select the first mint with balance as source, or active
    const firstFunded = React.useMemo(() => {
        return activeMintUrl || mints.find(m => (balances[m.mintUrl] || 0) > 0)?.mintUrl || mints[0]?.mintUrl;
    }, [activeMintUrl, mints, balances]);

    const defaultTarget = React.useMemo(() => {
        return mints.find(m => m.mintUrl !== firstFunded)?.mintUrl || mints[0]?.mintUrl || '';
    }, [mints, firstFunded]);

    const [sourceMintUrl, setSourceMintUrl] = useState<string>(firstFunded || '');
    const [targetMintUrl, setTargetMintUrl] = useState<string>(defaultTarget || '');

    const [status, setStatus] = useState<'success' | 'error' | 'cancelled'>('success');
    const [error, setError] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const { secondaryCurrency, showBitcoinSymbol } = useSettingsStore();

    const { data: btcData } = useQuery({
        queryKey: ['bitcoinPrice', secondaryCurrency],
        queryFn: () => bitcoinService.fetchPrice(secondaryCurrency),
        staleTime: 30000,
    });

    const fiatValue = React.useMemo(() => {
        if (!btcData?.price) return '0.00';
        const sats = Number(amount) || 0;
        const fiat = currencyService.convertSatsToCurrency(sats, btcData.price);
        return fiat.toFixed(2);
    }, [amount, btcData?.price]);

    const amountNum = parseInt(amount, 10) || 0;
    const sourceBalance = sourceMintUrl ? (balances[sourceMintUrl] || 0) : 0;

    // Derived selected Mint objects
    const sourceMint = mints.find(m => m.mintUrl === sourceMintUrl);
    const targetMint = mints.find(m => m.mintUrl === targetMintUrl);

    const handleSwap = useCallback(async () => {
        if (!sourceMintUrl || !targetMintUrl) {
            setError('Please select both source and target mints');
            return;
        }

        if (amountNum <= 0) {
            setError('Invalid amount');
            return;
        }

        if (amountNum > sourceBalance) {
            setError('Insufficient balance in source mint');
            return;
        }

        setIsProcessing(true);
        setError(null);

        try {
            if (sourceMintUrl === targetMintUrl) {
                // Same-mint swap: simple refresh
                console.log(`[Swap] Single-mint swapping ${amountNum} sats on ${sourceMintUrl}`);
                const token = await walletService.send(sourceMintUrl, amountNum);
                await walletService.receive(token.token as any);
            } else {
                // Cross-mint swap via NUT-19 (Direct Atomic Swap or Optimized Route)
                console.log(`[Swap] Executing NUT-19 cross-mint swap (${amountNum} sats) from ${sourceMintUrl} to ${targetMintUrl}`);
                await quotesService.swapMintToMint(sourceMintUrl, targetMintUrl, amountNum);
            }

            // Record transaction history entry for NUT-19 atomic swap
            try {
                const repo = initService.getRepo();
                if (repo?.historyRepository) {
                    await (repo.historyRepository as any).addHistoryEntry({
                        mintUrl: sourceMintUrl,
                        type: 'swap',
                        unit: 'sat',
                        amount: amountNum,
                        createdAt: Date.now(),
                        state: 'completed',
                        metadata: {
                            via: 'swap',
                            protocol: 'NUT-19',
                            sourceMintUrl,
                            targetMintUrl,
                            sourceMintName: sourceMint?.name || sourceMintUrl.replace(/^https?:\/\//, '').split('/')[0],
                            targetMintName: targetMint?.name || targetMintUrl.replace(/^https?:\/\//, '').split('/')[0],
                        }
                    });
                }
            } catch (histErr) {
                console.warn('[Swap] Failed to record history entry:', histErr);
            }

            setStatus('success');
            refreshBalance(); // fire-and-forget — don't block UI
            setStep('result');
        } catch (err: any) {
            console.error('[Swap] Failed:', err);
            setError(err.message || 'Swap failed');
            setStatus('error');
            setStep('result');
        } finally {
            setIsProcessing(false);
        }
    }, [sourceMintUrl, targetMintUrl, amountNum, sourceBalance, refreshBalance]);

    const handleConfirmSubmit = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        await handleSwap();
    };

    const handleNext = () => {
        if (step === 'amount') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setStep('confirm');
        }
    };

    const handleClose = () => {
        router.back();
        InteractionManager.runAfterInteractions(() => refreshBalance());
    };

    return (
        <YStack flex={1} bg="$background">
            {step === 'amount' && (
                <YStack flex={1} px="$4">
                    <AmountStage
                        amount={amount}
                        setAmount={setAmount}
                        sourceMintUrl={sourceMintUrl}
                        setSourceMintUrl={setSourceMintUrl}
                        targetMintUrl={targetMintUrl}
                        setTargetMintUrl={setTargetMintUrl}
                        onContinue={handleNext}
                        isLoading={isProcessing}
                        error={error}
                    />
                </YStack>
            )}

            {step === 'confirm' && (
                <YStack flex={1}>
                    <ScrollView contentContainerStyle={{ paddingBottom: 180 } as any} showsVerticalScrollIndicator={false}>
                        <YStack gap="$4">
                            {/* Middle Amount Display */}
                            <YStack gap="$3" py="$6" items="center" justify="center">
                                <Text fontSize={52} fontFamily="$oswald" fontWeight="700" color="$accent3" lineHeight={54}>
                                    {showBitcoinSymbol ? `₿${amountNum.toLocaleString()}` : `${amountNum.toLocaleString()} SATS`}
                                </Text>
                                <Text color="$accent5" fontWeight="600" fontSize={16}>
                                    ≈ {currencyService.formatValue(Number(fiatValue), secondaryCurrency as CurrencyCode)} {secondaryCurrency}
                                </Text>
                            </YStack>

                            {/* Badge */}
                            <XStack
                                self="center"
                                items="center"
                                gap="$2"
                                bg="$accent9"
                                px="$4"
                                py="$3"
                                rounded="$10"
                            >
                                <ArrowUpDown size={16} color="white" />
                                <Text
                                    fontSize="$3"
                                    fontWeight="700"
                                    color="white"
                                >
                                    Ecash Mint Swap
                                </Text>
                            </XStack>

                            {/* Details List */}
                            <YStack bg="$gray2" rounded="$5" overflow="hidden" mb="$3" mx="$4">
                                <View p="$3" px="$4">
                                    <Text fontSize="$3" fontWeight="700" color="$gray12">Details</Text>
                                </View>
                                <Separator borderColor="$borderColor" opacity={0.3} />
                                <YGroup separator={<Separator borderColor="$borderColor" opacity={0.5} />}>
                                    <DetailItem
                                        label="From Mint"
                                        value={sourceMint?.nickname || sourceMint?.name || sourceMintUrl.replace(/^https?:\/\//, '').split('/')[0]}
                                        icon={
                                            <Avatar rounded="$3" size="$1.5">
                                                <Avatar.Image src={sourceMint?.icon} />
                                                <Avatar.Fallback bg="$green3" items="center" justify="center">
                                                    <Sprout size={12} color="$green10" />
                                                </Avatar.Fallback>
                                            </Avatar>
                                        }
                                    />
                                    <DetailItem
                                        label="To Mint"
                                        value={targetMint?.nickname || targetMint?.name || targetMintUrl.replace(/^https?:\/\//, '').split('/')[0]}
                                        icon={
                                            <Avatar rounded="$3" size="$1.5">
                                                <Avatar.Image src={targetMint?.icon} />
                                                <Avatar.Fallback bg="$green3" items="center" justify="center">
                                                    <Sprout size={12} color="$green10" />
                                                </Avatar.Fallback>
                                            </Avatar>
                                        }
                                    />
                                    <DetailItem
                                        label="Method"
                                        value="Mint-to-Mint Swap"
                                        icon={<ArrowUpDown size={16} color="$yellow10" />}
                                    />
                                    <DetailItem
                                        label="Estimated Fee"
                                        value="0 SATS (Free)"
                                        valueColor="$green11"
                                        icon={<ShieldCheck size={16} color="$green11" />}
                                    />
                                </YGroup>
                            </YStack>
                        </YStack>
                    </ScrollView>

                    {/* Fixed Action Buttons */}
                    <XStack position="absolute" b="$4" l="$4" r="$4" gap="$2">
                        <Button
                            bg="$gray3"
                            color="$color"
                            size="$5"
                            flex={1}
                            height={55}
                            rounded="$4"
                            fontWeight="800"
                            disabled={isProcessing}
                            onPress={() => setStep('amount')}
                        >
                            Go Back
                        </Button>
                        <Button
                            theme="accent"
                            size="$5"
                            flex={1}
                            height={55}
                            rounded="$4"
                            fontWeight="800"
                            onPress={handleConfirmSubmit}
                            disabled={isProcessing}
                            icon={isProcessing ? <Spinner size="small" color="white" /> : undefined}
                        >
                            {isProcessing ? 'Swapping...' : 'Confirm Swap'}
                        </Button>
                    </XStack>
                </YStack>
            )}

            {step === 'result' && (
                <YStack flex={1} p="$4">
                    <ResultStage
                        status={status}
                        amount={amount}
                        sourceMintUrl={sourceMintUrl}
                        targetMintUrl={targetMintUrl}
                        error={error}
                        onClose={handleClose}
                    />
                </YStack>
            )}
        </YStack>
    );
}

function DetailItem({ label, value, icon, valueColor }: { label: string, value: string, icon?: React.ReactNode, valueColor?: string }) {
    return (
        <XStack justify="space-between" items="center" py="$3" px="$4">
            <Text fontSize="$3" color="$gray10" fontWeight="600">{label}</Text>
            <XStack gap="$2" items="center">
                {icon}
                <Text fontSize="$3" fontWeight="800" color={valueColor || "$color"} numberOfLines={1} style={{ maxWidth: 220 }}>
                    {value}
                </Text>
            </XStack>
        </XStack>
    );
}
