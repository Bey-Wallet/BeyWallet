import { YStack } from "tamagui";
import { useRouter, Stack, useLocalSearchParams } from "expo-router";
import { useState, useEffect, useCallback } from "react";
import { InteractionManager } from "react-native";
import { AmountStage } from "./AmountStage";
import { ConfirmStage } from "./ConfirmStage";
import { PaymentStage } from "./PaymentStage";
import { ResultStage } from "./ResultStage";
import { OnchainMintFlow } from "./OnchainMintFlow";
import { useWalletStore } from "../../store/walletStore";
import { eventService, quotesService, initService } from "../../services/core";
import { networkService } from "../../services/networkService";

type MintStep = 'amount' | 'confirm' | 'payment' | 'result';
type MintResultStatus = 'success' | 'error' | 'cancelled';

interface MintQuoteData {
    quoteId: string;
    invoice: string;
    expiry?: number;
}

export default function MintScreen() {
    const router = useRouter();
    const { mode } = useLocalSearchParams<{ mode?: string }>();
    const activeMintUrl = useWalletStore(s => s.activeMintUrl);
    const refreshBalance = useWalletStore(s => s.refreshBalance);

    if (mode === 'onchain') {
        return (
            <YStack flex={1} bg="$background" px="$4">
                <Stack.Screen options={{ headerTitle: 'On-Chain Recieve' }} />
                <OnchainMintFlow />
            </YStack>
        );
    }

    const [step, setStep] = useState<MintStep>('amount');
    const [amount, setAmount] = useState("0");
    const [status, setStatus] = useState<MintResultStatus>('success');
    const [quoteData, setQuoteData] = useState<MintQuoteData | null>(null);
    const [isCreatingQuote, setIsCreatingQuote] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Listen for mint quote redeemed event
    useEffect(() => {
        if (!quoteData) return;

        const handleRedeemed = (payload: any) => {
            console.log('[MintScreen] Mint quote redeemed event:', payload);
            if (payload.quoteId === quoteData.quoteId) {
                setStatus('success');
                setStep('result');
                refreshBalance();
            }
        };

        const unsub = eventService.on('mint-quote:redeemed', handleRedeemed);
        return () => {
            unsub();
        };
    }, [quoteData, refreshBalance]);

    const handleCreateQuote = useCallback(async () => {
        if (!activeMintUrl) {
            setError('No active mint selected');
            return;
        }

        const offline = await networkService.isOffline();
        if (offline) {
            setError('You are offline. Please check your internet connection.');
            setStatus('error');
            setStep('result');
            return;
        }

        setIsCreatingQuote(true);
        setError(null);

        try {
            const amountSats = parseInt(amount, 10);
            if (isNaN(amountSats) || amountSats <= 0) {
                throw new Error('Invalid amount');
            }

            const quote = await quotesService.createMintQuote(activeMintUrl, amountSats);

            setQuoteData({
                quoteId: quote.quote,
                invoice: quote.request,
                expiry: quote.expiry,
            });
            setStep('payment');
        } catch (err: any) {
            console.error('[MintScreen] Failed to create mint quote:', err);
            setError(err.message || 'Failed to create invoice');
            setStatus('error');
            setStep('result');
        } finally {
            setIsCreatingQuote(false);
        }
    }, [activeMintUrl, amount]);

    const handleNext = () => {
        if (step === 'amount') setStep('confirm');
        else if (step === 'confirm') {
            handleCreateQuote();
        }
    };

    const handleBack = () => {
        if (step === 'confirm') setStep('amount');
        else router.back();
    };

    const handleCancel = async () => {
        setStatus('cancelled');
        setStep('result');
        if (quoteData && activeMintUrl) {
            try {
                const repo = initService.getRepo();
                if (repo?.historyRepository) {
                    await (repo.historyRepository as any).updateHistoryMintEntry(activeMintUrl, quoteData.quoteId, 'failed');
                    console.log('[MintScreen] Marked cancelled mint quote in history as failed:', quoteData.quoteId);
                }
            } catch (e) {
                console.warn('[MintScreen] Failed to mark cancelled mint quote in history:', e);
            }
        }
    };

    const handlePaid = async () => {
        if (quoteData && activeMintUrl) {
            try {
                await quotesService.redeemMintQuote(activeMintUrl, quoteData.quoteId);
                setStatus('success');
                refreshBalance();
                setStep('result');
            } catch (err: any) {
                console.log('[MintScreen] Manual redeem attempt failed:', err.message);
                throw err;
            }
        }
    };

    const handleClose = () => {
        router.back();
        InteractionManager.runAfterInteractions(() => refreshBalance());
    };

    return (
        <YStack flex={1} bg="$background" px="$4">
            <Stack.Screen options={{ headerTitle: 'Mint Cash' }} />
            {step === 'amount' && (
                <AmountStage
                    amount={amount}
                    setAmount={setAmount}
                    onContinue={handleNext}
                />
            )}

            {step === 'confirm' && (
                <ConfirmStage
                    amount={amount}
                    mintUrl={activeMintUrl || ''}
                    isLoading={isCreatingQuote}
                    onConfirm={handleNext}
                    onBack={handleBack}
                />
            )}

            {step === 'payment' && quoteData && (
                <PaymentStage
                    amount={amount}
                    invoice={quoteData.invoice}
                    quoteId={quoteData.quoteId}
                    mintUrl={activeMintUrl || ''}
                    expiry={quoteData.expiry}
                    onPaid={handlePaid}
                    onCancel={handleCancel}
                />
            )}

            {step === 'result' && (
                <ResultStage
                    status={status}
                    amount={amount}
                    mintUrl={activeMintUrl || undefined}
                    error={error}
                    onClose={handleClose}
                />
            )}
        </YStack>
    );
}
