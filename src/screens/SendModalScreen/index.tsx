import React, { useState, useCallback } from 'react'
import { useRouter, Stack } from 'expo-router'
import { useWalletStore } from '~/store/walletStore'
import { AmountStage } from './AmountStage'
import { P2PKAmountStage } from './P2PKAmountStage'
import { ResultStage } from './ResultStage'
import { SuccessStage } from './SuccessStage'
import { biometricService } from '~/services/biometricService'
import { walletService, mintManager } from '~/services/core'
import * as Haptics from 'expo-haptics'
import AppBottomSheet, { AppBottomSheetRef } from '~/components/UI/AppBottomSheet'
import { Text, YStack, XStack, Button, Separator, View } from 'tamagui'
import { useSettingsStore } from '~/store/settingsStore'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { bitcoinService } from '~/services/bitcoinService'
import { currencyService, SUPPORTED_CURRENCIES } from '~/services/currencyService'
import { Building2, ShieldCheck, Zap, ScanLine } from '@tamagui/lucide-icons'
import { Image } from 'tamagui'
import { nip19 } from 'nostr-tools'
import { eventService, proofService } from '~/services/core'
import SendMethodSelector, { SendMode } from '~/components/SendMethodSelector'

type SendStep = 'amount' | 'result' | 'success';

export function SendModalScreen() {
    const [step, setStep] = useState<SendStep>('amount')
    const [amount, setAmount] = useState('0')
    const [status, setStatus] = useState<'success' | 'error'>('success')
    const [error, setError] = useState<string | null>(null)
    const [encodedToken, setEncodedToken] = useState<string | null>(null)
    const [operationId, setOperationId] = useState<string | null>(null)
    const [isProcessing, setIsProcessing] = useState(false)
    const [sendMode, setSendMode] = useState<SendMode>('standard')
    const [receiverPubkey, setReceiverPubkey] = useState('')
    const router = useRouter()
    const queryClient = useQueryClient();

    const { balance, activeMintUrl, refreshBalance, mints } = useWalletStore()
    const { secondaryCurrency } = useSettingsStore()
    const confirmSheetRef = React.useRef<AppBottomSheetRef>(null)
    const [estimatedFee, setEstimatedFee] = React.useState(0)

    // Fetch fee when active mint changes
    React.useEffect(() => {
        if (activeMintUrl) {
            mintManager.getFeePpk(activeMintUrl).then(feePpk => {
                // Estimate fee assuming ~4 input proofs (typical swap)
                const fee = feePpk > 0 ? Math.ceil(4 * feePpk / 1000) : 0;
                setEstimatedFee(fee);
            }).catch(() => setEstimatedFee(0));
        }
    }, [activeMintUrl])

    // Monitor for claim success when in 'result' stage
    React.useEffect(() => {
        if (step !== 'result' || !encodedToken || !operationId) return;

        console.log('[SendModalScreen] Starting automated state monitoring for:', operationId);

        let isDetected = false;

        const handleSuccess = async (source: string) => {
            if (isDetected) return;

            // Double confirmation for events: check proof states before transitioning
            if (source === 'event') {
                try {
                    console.log(`[SendModalScreen] 🛡️ Verifying event success for:`, operationId);
                    const states = await proofService.checkProofStates(encodedToken);
                    const allSpent = states.length > 0 && states.every((s: any) => s.state === 'SPENT');
                    if (!allSpent) {
                        console.warn('[SendModalScreen] ⚠️ Event claimed but proofs still UNSPENT. Ignoring premature event.');
                        return;
                    }
                } catch (err) {
                    console.error('[SendModalScreen] Verification check failed:', err);
                    return;
                }
            }

            isDetected = true;
            console.log(`[SendModalScreen] ✅ SUCCESS CONFIRMED via ${source} for:`, operationId);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            // Transition to success stage
            setStep('success');

            // Invalidate queries
            queryClient.invalidateQueries({ queryKey: ['history'] });
            queryClient.invalidateQueries({ queryKey: ['transaction', operationId] });
        };

        // Listen for history updates
        const unsubHistory = eventService.on('history:updated', (payload: any) => {
            console.log('[SendModalScreen] 📜 History update:', {
                currentOpId: operationId,
                payloadId: payload.id,
                payloadState: payload.state,
                fullPayload: payload
            });
            if (payload.id === operationId && payload.state === 'claimed') {
                handleSuccess('event');
            }
        });

        // Fallback: poll proof state
        const interval = setInterval(async () => {
            try {
                const states = await proofService.checkProofStates(encodedToken);
                const spentCount = states.filter((s: any) => s.state === 'SPENT').length;
                console.log(`[SendModalScreen] 🔍 Polling check [${operationId}]: ${spentCount}/${states.length} proofs SPENT`);

                if (states.length > 0 && spentCount === states.length) {
                    handleSuccess('polling');
                }
            } catch (err) {
                console.warn('[SendModalScreen] Polling check failed:', err);
            }
        }, 8000);

        return () => {
            unsubHistory();
            clearInterval(interval);
        };
    }, [step, encodedToken, operationId]);

    const { data: btcData } = useQuery({
        queryKey: ['bitcoinPrice', secondaryCurrency],
        queryFn: () => bitcoinService.fetchPrice(secondaryCurrency),
        staleTime: 30000,
    });

    const activeMint = React.useMemo(() => {
        if (!activeMintUrl) return null;
        return mints.find(m => m.mintUrl.replace(/\/$/, '') === activeMintUrl.replace(/\/$/, ''));
    }, [mints, activeMintUrl]);

    const mintName = activeMint?.nickname || activeMint?.name || activeMintUrl?.replace(/^https?:\/\//, '').replace(/\/$/, '') || "Unknown Mint";

    const fiatValue = React.useMemo(() => {
        if (!btcData?.price) return '...';
        const sats = parseInt(amount, 10) || 0;
        const cur = SUPPORTED_CURRENCIES.find(c => c.code === secondaryCurrency);
        const symbol = cur?.symbol || '$';
        const val = currencyService.convertSatsToCurrency(sats, btcData.price);
        return `${symbol}${val.toFixed(2)}`;
    }, [amount, btcData?.price, secondaryCurrency]);

    const handleSend = useCallback(async () => {
        if (!activeMintUrl) {
            setError('No active mint selected');
            return;
        }

        const amountSats = parseInt(amount, 10);
        if (isNaN(amountSats) || amountSats <= 0) {
            setError('Invalid amount');
            return;
        }

        if (amountSats > balance) {
            setError('Insufficient balance');
            return;
        }

        setIsProcessing(true);
        setError(null);

        try {
            // Send and get encoded token for sharing
            let result;

            if (sendMode === 'p2pk') {
                let targetPubkey = receiverPubkey.trim();

                // Decode npub to hex if necessary
                if (targetPubkey.startsWith('npub')) {
                    try {
                        const decoded = nip19.decode(targetPubkey);
                        if (decoded.type === 'npub') {
                            targetPubkey = decoded.data as string;
                        } else {
                            throw new Error('Invalid npub provided');
                        }
                    } catch (e: any) {
                        throw new Error('Failed to decode npub: ' + e.message);
                    }
                }

                result = await walletService.sendP2PK(activeMintUrl, amountSats, targetPubkey);
                setEncodedToken(result.encoded);
                setOperationId(result.id);
            } else {
                result = await walletService.send(activeMintUrl, amountSats);
                setEncodedToken(result.token);
                setOperationId(result.id);
            }

            setStatus('success');
            refreshBalance();
            console.log('[SendModalScreen] Send successful. OpId:', result.id, 'Token length:', (result.encoded || result.token || '').length);
            setStep('result');
        } catch (err: any) {
            console.error('[SendModal] Failed to send:', err);
            setError(err.message || 'Failed to create token');
            setStatus('error');
            setStep('result');
        } finally {
            setIsProcessing(false);
        }
    }, [activeMintUrl, amount, balance, refreshBalance]);

    const handleAuthenticate = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        confirmSheetRef.current?.dismiss();

        try {
            // Authenticate first
            const success = await biometricService.authenticateAsync(`Authorize creating ₿${amount} ecash`)

            if (success) {
                await handleSend();
            } else {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
            }
        } catch (error: any) {
            console.error('[SendModal] Authentication error:', error);
            setError(error.message || 'Authentication failed');
            setStatus('error');
            setStep('result');
        }
    }

    const handleNext = () => {
        if (step === 'amount') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            confirmSheetRef.current?.present();
        }
    }

    const handleClose = () => {
        refreshBalance();
        router.back();
    }

    return (
        <YStack flex={1} bg="$background" p="$4">
            <Stack.Screen
                options={{
                    headerTitle: () => (
                        <SendMethodSelector
                            mode={sendMode}
                            onSelect={setSendMode}
                            isLoading={isProcessing}
                        />
                    ),
                }}
            />
            {step === 'amount' && (
                <YStack flex={1}>
                    {sendMode === 'standard' && (
                        <AmountStage
                            amount={amount}
                            setAmount={setAmount}
                            onContinue={handleNext}
                            balance={balance}
                            isLoading={isProcessing}
                            error={error}
                        />
                    )}
                    {sendMode === 'p2pk' && (
                        <P2PKAmountStage
                            amount={amount}
                            setAmount={setAmount}
                            receiverPubkey={receiverPubkey}
                            setReceiverPubkey={setReceiverPubkey}
                            onContinue={handleNext}
                            balance={balance}
                            isLoading={isProcessing}
                            error={error}
                        />
                    )}
                    {(sendMode === 'scan' || sendMode === 'nostr') && (
                        <YStack flex={1} items="center" justify="center" gap="$4" opacity={0.5}>
                            <ScanLine size={48} color="$gray8" />
                            <YStack items="center" gap="$1">
                                <Text fontSize="$5" fontWeight="700" color="$gray9">
                                    {sendMode === 'scan' ? 'Scan & Pay' : 'Nostr'}
                                </Text>
                                <Text fontSize="$3" color="$gray9">
                                    Coming soon
                                </Text>
                            </YStack>
                        </YStack>
                    )}
                </YStack>
            )}

            {step === 'result' && (
                <ResultStage
                    status={status}
                    amount={amount}
                    token={encodedToken}
                    mintUrl={activeMintUrl || ''}
                    operationId={operationId || undefined}
                    fee={estimatedFee}
                    error={error}
                    onClose={handleClose}
                />
            )}

            {step === 'success' && (
                <SuccessStage
                    amount={amount}
                    mintUrl={activeMintUrl || ''}
                    fee={estimatedFee}
                    onClose={handleClose}
                />
            )}

            <AppBottomSheet ref={confirmSheetRef}>
                <YStack p="$4" pt="$2" gap="$5">
                    <YStack items="center" gap="$2" pt="$2">
                        <Text fontSize="$6" fontWeight="800">Review Transaction</Text>
                    </YStack>

                    <YStack rounded="$5" bg="$gray2" overflow="hidden">
                        <XStack justify="space-between" items="center" px="$4" py="$3">
                            <Text color="$gray10" fontWeight="600">Amount</Text>
                            <YStack items="flex-end">
                                <Text fontWeight="800" fontSize="$6">₿{amount} sats</Text>
                                <Text color="$gray10" fontSize="$3">{fiatValue}</Text>
                            </YStack>
                        </XStack>

                        <Separator borderColor="$borderColor" opacity={0.5} />

                        <XStack justify="space-between" items="center" px="$4" py="$3">
                            <XStack gap="$2" items="center">
                                <ShieldCheck size={18} color="$gray10" />
                                <Text color="$gray10" fontWeight="600">Fee</Text>
                            </XStack>
                            <Text fontWeight="800" fontSize="$5" color={estimatedFee > 0 ? "$orange10" : "$green10"}>
                                {estimatedFee > 0 ? `~${estimatedFee} sats` : '0 sats'}
                            </Text>
                        </XStack>

                        <Separator borderColor="$borderColor" opacity={0.5} />

                        <XStack justify="space-between" items="center" px="$4" py="$3">
                            <XStack gap="$2" items="center">
                                <Building2 size={18} color="$gray10" />
                                <Text color="$gray10" fontWeight="600">Mint</Text>
                            </XStack>
                            <XStack gap="$2" items="center">
                                {activeMint?.icon && (
                                    <View rounded="$10" overflow="hidden" width={20} height={20}>
                                        <Image source={{ uri: activeMint.icon }} width={20} height={20} />
                                    </View>
                                )}
                                <Text fontWeight="800" fontSize="$5" numberOfLines={1} style={{ maxWidth: 180 }}>{mintName}</Text>
                            </XStack>
                        </XStack>

                        <Separator borderColor="$borderColor" opacity={0.5} />

                        <XStack justify="space-between" items="center" px="$4" py="$3">
                            <XStack gap="$2" items="center">
                                <Zap size={18} color="$gray10" />
                                <Text color="$gray10" fontWeight="600">Version</Text>
                            </XStack>
                            <XStack bg="$gray5" px="$2" py="$1" rounded="$2">
                                <Text color="$gray10" fontSize="$2" fontWeight="800">V4 (Default)</Text>
                            </XStack>
                        </XStack>
                    </YStack>

                    <YStack gap="$3" pt="$2">
                        <Button
                            theme="accent"
                            size="$5"
                            fontWeight="800"
                            onPress={handleAuthenticate}
                        >
                            Confirm & Send
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
    )
}
