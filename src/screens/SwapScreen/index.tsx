import React, { useState, useCallback, useEffect, useRef } from 'react';
import { InteractionManager } from 'react-native';
import { useRouter } from 'expo-router';
import { YStack, XStack, Text, Button, View, Separator, Spinner } from 'tamagui';
import { RefreshCw, ShieldCheck, Building2, Zap } from '@tamagui/lucide-icons';
import { Image } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useWalletStore } from '~/store/walletStore';
import { walletService, mintManager, quotesService } from '~/services/core';
import AppBottomSheet, { AppBottomSheetRef } from '~/components/UI/AppBottomSheet';

import { AmountStage } from './AmountStage';
import { ResultStage } from './ResultStage';

type SwapStep = 'amount' | 'result';

export default function SwapScreen() {
    const router = useRouter();
    const mints = useWalletStore(s => s.mints);
    const balances = useWalletStore(s => s.balances);
    const refreshBalance = useWalletStore(s => s.refreshBalance);

    const [step, setStep] = useState<SwapStep>('amount');
    const [amount, setAmount] = useState('0');

    // We auto-select the first mint with balance as source, or active
    const firstFunded = React.useMemo(() => {
        return mints.find(m => (balances[m.mintUrl] || 0) > 0)?.mintUrl || mints[0]?.mintUrl;
    }, [mints, balances]);

    const [sourceMintUrl, setSourceMintUrl] = useState<string>(firstFunded || '');
    const [targetMintUrl, setTargetMintUrl] = useState<string>(mints[0]?.mintUrl || '');

    const [status, setStatus] = useState<'success' | 'error' | 'cancelled'>('success');
    const [error, setError] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const confirmSheetRef = useRef<AppBottomSheetRef>(null);

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
                // Cross-mint swap via Lightning (Melt -> Mint)
                console.log(`[Swap] Cross-mint swapping ${amountNum} sats from ${sourceMintUrl} to ${targetMintUrl}`);

                // 1. Get Mint Invoice
                const mintQuote = await quotesService.createMintQuote(targetMintUrl, amountNum);

                // 2. Prepare Melt
                const meltOp = await quotesService.prepareMelt(sourceMintUrl, mintQuote.invoice);

                // 3. Execute Melt
                await quotesService.executeMelt(meltOp.id);

                // 4. Try immediately redeeming mint
                try {
                    await quotesService.redeemMintQuote(targetMintUrl, mintQuote.quoteId);
                } catch (e: any) {
                    console.log('[Swap] Manual redeem failed, watcher might catch it:', e.message);
                }
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
        confirmSheetRef.current?.dismiss();
    };

    const handleNext = () => {
        if (step === 'amount') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            confirmSheetRef.current?.present();
        }
    };

    const handleClose = () => {
        router.back();
        InteractionManager.runAfterInteractions(() => refreshBalance());
    };

    return (
        <YStack flex={1} bg="$background" p="$4">
            {step === 'amount' && (
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
            )}

            {step === 'result' && (
                <ResultStage
                    status={status}
                    amount={amount}
                    sourceMintUrl={sourceMintUrl}
                    targetMintUrl={targetMintUrl}
                    error={error}
                    onClose={handleClose}
                />
            )}

            <AppBottomSheet ref={confirmSheetRef}>
                <YStack p="$4" pt="$2" gap="$5">
                    <YStack items="center" gap="$2" pt="$2">
                        <Text fontSize="$6" fontWeight="800">Review Swap</Text>
                    </YStack>

                    <YStack rounded="$5" bg="$gray2" overflow="hidden">
                        <XStack justify="space-between" items="center" px="$4" py="$3">
                            <Text color="$gray10" fontWeight="600">Amount</Text>
                            <YStack items="flex-end">
                                <Text fontWeight="800" fontSize="$6">₿{amount} sats</Text>
                            </YStack>
                        </XStack>

                        <Separator borderColor="$borderColor" opacity={0.5} />

                        <XStack justify="space-between" items="center" px="$4" py="$3">
                            <XStack gap="$2" items="center">
                                <Building2 size={18} color="$gray10" />
                                <Text color="$gray10" fontWeight="600">From</Text>
                            </XStack>
                            <Text fontWeight="800" fontSize="$5" numberOfLines={1} style={{ maxWidth: 180 }}>
                                {sourceMint?.nickname || sourceMint?.name || 'Unknown Mint'}
                            </Text>
                        </XStack>

                        <Separator borderColor="$borderColor" opacity={0.5} />

                        <XStack justify="space-between" items="center" px="$4" py="$3">
                            <XStack gap="$2" items="center">
                                <Building2 size={18} color="$gray10" />
                                <Text color="$gray10" fontWeight="600">To</Text>
                            </XStack>
                            <Text fontWeight="800" fontSize="$5" numberOfLines={1} style={{ maxWidth: 180 }}>
                                {targetMint?.nickname || targetMint?.name || 'Unknown Mint'}
                            </Text>
                        </XStack>

                    </YStack>

                    <YStack gap="$3" pt="$2">
                        <Button
                            theme="accent"
                            size="$5"
                            fontWeight="800"
                            disabled={isProcessing}
                            icon={isProcessing ? <Spinner size="small" color="$color" /> : undefined}
                            onPress={handleConfirmSubmit}
                        >
                            {isProcessing ? 'Swapping...' : 'Confirm Swap'}
                        </Button>
                        <Button
                            chromeless
                            size="$4"
                            onPress={() => confirmSheetRef.current?.dismiss()}
                        >
                            Cancel
                        </Button>
                    </YStack>
                </YStack>
            </AppBottomSheet>
        </YStack>
    );
}
