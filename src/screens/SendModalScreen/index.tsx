import React, { useState, useCallback } from 'react'
import { InteractionManager, Switch } from 'react-native'
import { useRouter, Stack, useLocalSearchParams } from 'expo-router'
import { useWalletStore } from '~/store/walletStore'
import { AmountStage } from './AmountStage'
import { P2PKAmountStage } from './P2PKAmountStage'
import { NostrSendStage } from './NostrSendStage'
import { ResultStage } from './ResultStage'
import { SuccessStage } from './SuccessStage'
import { PaymentRequestStage, type ParsedPaymentRequest } from './PaymentRequestStage'
import { ScanAndPayStage } from './ScanAndPayStage'
import { biometricService } from '~/services/biometricService'
import { walletService, mintManager, nostrService } from '~/services/core'
import { seedService } from '~/services/seedService'
import { ProcessingSheet } from '~/components/UI/ProcessingSheet'
import * as Haptics from 'expo-haptics'
import AppBottomSheet, { AppBottomSheetRef } from '~/components/UI/AppBottomSheet'
import { Text, YStack, XStack, Button, Separator, View } from 'tamagui'
import { useSettingsStore } from '~/store/settingsStore'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { bitcoinService } from '~/services/bitcoinService'
import { currencyService, SUPPORTED_CURRENCIES } from '~/services/currencyService'
import { Building2, ShieldCheck, Zap, ScanLine, Lock } from '@tamagui/lucide-icons'
import { Image } from 'tamagui'
import { nip19 } from 'nostr-tools'
import { eventService, proofService } from '~/services/core'
import SendMethodSelector, { SendMode } from '~/components/SendMethodSelector'
import { PaymentRequest, PaymentRequestTransportType } from '@cashu/cashu-ts'
import Blockies from '~/components/UI/Blockies'

type SendStep = 'amount' | 'result' | 'success' | 'payment_request';

/** Parse a NUT-18 creqA/creqB string into our UI model */
function parsePaymentRequest(raw: string): ParsedPaymentRequest | null {
    try {
        const pr = PaymentRequest.fromEncodedRequest(raw);
        // Extract Nostr transport target (npub)
        let nostrTarget: string | undefined;
        if (pr.transport) {
            const nostrTr = pr.transport.find(
                (t: any) => t.type === PaymentRequestTransportType.NOSTR ||
                             t.type === 'nostr' ||
                             String(t.type) === '1'
            );
            if (nostrTr) nostrTarget = nostrTr.target;
        }
        return {
            raw,
            amount: pr.amount ?? undefined,
            unit: pr.unit ?? 'sat',
            description: pr.description ?? undefined,
            mints: pr.mints ?? [],
            nostrTarget,
        };
    } catch (e) {
        console.error('[SendModal] Failed to parse payment request:', e);
        return null;
    }
}

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
    const [scanInput, setScanInput] = useState('')
    const [manualParsedRequest, setManualParsedRequest] = useState<ParsedPaymentRequest | null>(null)
    // Nostr-specific state
    const [nostrRecipientNpub, setNostrRecipientNpub] = useState('')
    const [nostrRecipientUsername, setNostrRecipientUsername] = useState('')
    const [useP2PK, setUseP2PK] = useState(true) // Default ON for Nostr sends
    const [nostrSending, setNostrSending] = useState(false)
    const router = useRouter()
    const queryClient = useQueryClient();

    // ── Read params from contact-details or deep link ─────────────────────
    const params = useLocalSearchParams<{ paymentRequest?: string; to?: string; username?: string; mode?: string }>();

    // Auto-select Nostr mode + pre-fill recipient when coming from contact-details
    React.useEffect(() => {
        if (params.mode === 'nostr' && params.to) {
            setSendMode('nostr');
            setNostrRecipientNpub(params.to as string);
            setNostrRecipientUsername(params.username ? `${params.username}@bey.cash` : '');
        }
    }, [params.mode, params.to, params.username]);

    const parsedRequest = React.useMemo<ParsedPaymentRequest | null>(() => {
        if (!params.paymentRequest) return null;
        return parsePaymentRequest(params.paymentRequest as string);
    }, [params.paymentRequest]);

    const activeParsedRequest = parsedRequest || manualParsedRequest;

    // Auto-switch to payment_request step if we got a creqA param
    React.useEffect(() => {
        if (activeParsedRequest) {
            console.log('[SendModal] Auto-switching to payment_request stage:', activeParsedRequest);
            setStep('payment_request');
        }
    }, [activeParsedRequest]);

    const balance = useWalletStore(s => s.balance)
    const activeMintUrl = useWalletStore(s => s.activeMintUrl)
    const refreshBalance = useWalletStore(s => s.refreshBalance)
    const mints = useWalletStore(s => s.mints)
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

            // Double confirmation for events only — polling already verified the chain state directly
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

            setStep('success');
            queryClient.invalidateQueries({ queryKey: ['history'] });
            queryClient.invalidateQueries({ queryKey: ['transaction', operationId] });
        };

        // Listen for history:updated events from the SDK
        const unsubHistory = eventService.on('history:updated', (payload: any) => {
            if (payload.id === operationId && payload.state === 'claimed') {
                handleSuccess('event');
            }
        });

        // Poll proof state — first check is immediate, then every 2.5s
        const pollOnce = async () => {
            if (isDetected) return;
            try {
                const states = await proofService.checkProofStates(encodedToken);
                const spentCount = states.filter((s: any) => s.state === 'SPENT').length;
                console.log(`[SendModalScreen] 🔍 Poll [${operationId}]: ${spentCount}/${states.length} SPENT`);
                if (states.length > 0 && spentCount === states.length) {
                    handleSuccess('polling');
                }
            } catch (err) {
                console.warn('[SendModalScreen] Polling check failed:', err);
            }
        };

        // Kick off immediately, then repeat every 2.5s
        pollOnce();
        const interval = setInterval(pollOnce, 2500);

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

                // Decode npub/nprofile to hex if necessary
                if (targetPubkey.startsWith('npub') || targetPubkey.startsWith('nprofile')) {
                    try {
                        const decoded = nip19.decode(targetPubkey);
                        if (decoded.type === 'npub') {
                            targetPubkey = decoded.data as string;
                        } else if (decoded.type === 'nprofile') {
                            targetPubkey = (decoded.data as any).pubkey as string;
                        } else {
                            throw new Error('Unsupported bech32 prefix');
                        }
                    } catch (e: any) {
                        throw new Error('Failed to decode Nostr identifier: ' + e.message);
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

    // ── Nostr Send Handler ───────────────────────────────────────────────
    const handleNostrSend = useCallback(async () => {
        if (!activeMintUrl || !nostrRecipientNpub) {
            setError('Missing mint or recipient');
            return;
        }

        const amountSats = parseInt(amount, 10);
        if (isNaN(amountSats) || amountSats <= 0 || amountSats > balance) {
            setError(amountSats > balance ? 'Insufficient balance' : 'Invalid amount');
            return;
        }

        setNostrSending(true);
        setError(null);

        try {
            // Step 1: Create the ecash token
            let result;
            if (useP2PK) {
                result = await walletService.sendP2PK(activeMintUrl, amountSats, nostrRecipientNpub);
            } else {
                const stdResult = await walletService.send(activeMintUrl, amountSats);
                result = { encoded: stdResult.token, token: null as any, id: stdResult.id };
            }

            // Step 2: Send via Nostr DM
            const mnemonic = await seedService.getMnemonic();
            if (!mnemonic) throw new Error('No mnemonic found');
            const keys = await seedService.getNostrKeys(mnemonic);
            
            const sent = await nostrService.sendViaNostr(
                result.encoded,
                nostrRecipientNpub,
                keys.privkey
            );

            if (!sent) throw new Error('Failed to publish to any relay');

            // Save contact if we have a username
            if (nostrRecipientUsername) {
                import('~/store/contactsStore').then(({ useContactsStore }) => {
                    useContactsStore.getState().addContact({
                        npub: nostrRecipientNpub,
                        username: nostrRecipientUsername.replace('@bey.cash', '') // store without domain or keep it? The store usually keeps bare username or full NIP-05. Let's just keep the raw one we have, but if we auto-appended @bey.cash on line 89, let's remove it or keep it. Actually, `contact-details` passes `username`.
                    });
                });
            }

            setEncodedToken(result.encoded);
            setOperationId(result.id);
            setStatus('success');
            refreshBalance();
            queryClient.invalidateQueries({ queryKey: ['history'] });
            setStep('success');

            console.log(`[SendModal] ✅ Nostr send complete: ${amountSats} sats to ${nostrRecipientNpub.slice(0, 10)}…`);
        } catch (err: any) {
            console.error('[SendModal] Nostr send failed:', err);
            setError(err.message || 'Failed to send via Nostr');
            setStatus('error');
            setStep('result');
        } finally {
            setNostrSending(false);
        }
    }, [activeMintUrl, amount, balance, nostrRecipientNpub, useP2PK, refreshBalance]);

    const handleAuthenticate = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        confirmSheetRef.current?.dismiss();

        try {
            const success = await biometricService.authenticateAsync(`Authorize creating ₿${amount} ecash`)

            if (success) {
                if (sendMode === 'nostr') {
                    await handleNostrSend();
                } else {
                    await handleSend();
                }
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
        router.back();
        // Refresh balance AFTER navigation animation settles — prevents freeze
        InteractionManager.runAfterInteractions(() => refreshBalance());
    }

    const handleScanContinue = (forcedInput?: string) => {
        const input = (typeof forcedInput === 'string' ? forcedInput : scanInput).trim();
        if (!input) return;
        setError(null);

        // Auto-redirect to receive if it looks like a token
        const isPaymentRequest = input.toLowerCase().startsWith('creqa') || input.toLowerCase().startsWith('creqb');
        
        if (!isPaymentRequest) {
            // Treat as token and redirect to receive
            router.replace({
                pathname: '/(modals)/receive',
                params: { scannedToken: input },
            });
            return;
        }

        const parsed = parsePaymentRequest(input);
        if (parsed) {
            setManualParsedRequest(parsed);
            // step is auto-switched by useEffect
        } else {
            setError('Invalid payment request format');
            setStatus('error');
            setStep('result');
        }
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
            {step === 'payment_request' && activeParsedRequest && (
                <PaymentRequestStage
                    request={activeParsedRequest}
                    onSuccess={(paidAmount, opId) => {
                        setAmount(String(paidAmount));
                        setOperationId(opId);
                        queryClient.invalidateQueries({ queryKey: ['history'] });
                        queryClient.invalidateQueries({ queryKey: ['balance'] });
                        refreshBalance();
                        setStep('success');
                    }}
                    onError={(msg) => {
                        setError(msg);
                        setStatus('error');
                        setStep('result');
                    }}
                    onCancel={handleClose}
                />
            )}

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
                    {sendMode === 'scan' && (
                        <ScanAndPayStage
                            input={scanInput}
                            setInput={setScanInput}
                            isLoading={isProcessing}
                            error={error}
                            onContinue={handleScanContinue}
                        />
                    )}
                    {sendMode === 'nostr' && (
                        <NostrSendStage
                            amount={amount}
                            setAmount={setAmount}
                            recipientNpub={nostrRecipientNpub}
                            recipientUsername={nostrRecipientUsername}
                            setRecipientNpub={setNostrRecipientNpub}
                            setRecipientUsername={setNostrRecipientUsername}
                            onContinue={handleNext}
                            balance={balance}
                            isLoading={isProcessing || nostrSending}
                            error={error}
                        />
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

                        {sendMode === 'nostr' ? (
                            <>
                                <XStack justify="space-between" items="center" px="$4" py="$3">
                                    <XStack gap="$2" items="center">
                                        <Lock size={18} color="$gray10" />
                                        <Text color="$gray10" fontWeight="600">P2PK Lock</Text>
                                    </XStack>
                                    <XStack gap="$2" items="center">
                                        <Text fontSize="$2" color={useP2PK ? '$green10' : '$gray10'} fontWeight="700">
                                            {useP2PK ? 'Secured' : 'Off'}
                                        </Text>
                                        <Switch
                                            value={useP2PK}
                                            onValueChange={setUseP2PK}
                                            trackColor={{ false: '#444', true: '#34C759' }}
                                            thumbColor="white"
                                        />
                                    </XStack>
                                </XStack>
                                <Separator borderColor="$borderColor" opacity={0.5} />
                                {nostrRecipientNpub ? (
                                    <XStack justify="space-between" items="center" px="$4" py="$3">
                                        <XStack gap="$2" items="center">
                                            <Zap size={18} color="$purple10" />
                                            <Text color="$gray10" fontWeight="600">To</Text>
                                        </XStack>
                                        <XStack gap="$2" items="center">
                                            <Blockies seed={nostrRecipientNpub} size={6} scale={2} style={{ borderRadius: 2 }} />
                                            <Text fontWeight="800" fontSize="$4" numberOfLines={1} style={{ maxWidth: 150 }}>
                                                {nostrRecipientUsername || `${nostrRecipientNpub.slice(0, 8)}...`}
                                            </Text>
                                        </XStack>
                                    </XStack>
                                ) : null}
                            </>
                        ) : (
                            <XStack justify="space-between" items="center" px="$4" py="$3">
                                <XStack gap="$2" items="center">
                                    <Zap size={18} color="$gray10" />
                                    <Text color="$gray10" fontWeight="600">Version</Text>
                                </XStack>
                                <XStack bg="$gray5" px="$2" py="$1" rounded="$2">
                                    <Text color="$gray10" fontSize="$2" fontWeight="800">V4 (Default)</Text>
                                </XStack>
                            </XStack>
                        )}
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

            {/* ProcessingSheet for Nostr sending */}
            <ProcessingSheet
                visible={nostrSending}
                status="processing"
                variant="nostr"
                title="Sending via Nostr"
                amount={parseInt(amount, 10) || 0}
                detail={`Sending to ${nostrRecipientUsername || nostrRecipientNpub.slice(0, 10) + '…'}`}
            />
        </YStack>
    )
}
