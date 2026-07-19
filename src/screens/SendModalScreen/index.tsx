import React, { useState, useCallback } from 'react'
import { InteractionManager, Switch, Alert } from 'react-native'
import { useRouter, Stack, useLocalSearchParams } from 'expo-router'
import { useWalletStore } from '~/store/walletStore'
import { AmountStage } from './AmountStage'
import { ConfirmStage } from './ConfirmStage'
import { P2PKAmountStage } from './P2PKAmountStage'
import { NostrSendStage } from './NostrSendStage'
import { ResultStage } from './ResultStage'
import { SuccessStage } from './SuccessStage'
import { PaymentRequestStage, type ParsedPaymentRequest } from './PaymentRequestStage'
import { ScanAndPayStage } from './ScanAndPayStage'
import { walletService, mintManager, nostrService, historyService, initService } from '~/services/core'
import { seedService } from '~/services/seedService'
import { ProcessingSheet } from '~/components/UI/ProcessingSheet'
import * as Haptics from 'expo-haptics'
import { Text, YStack, XStack, Button, Separator, View, H2, H4 } from 'tamagui'
import { useSettingsStore } from '~/store/settingsStore'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { bitcoinService } from '~/services/bitcoinService'
import { currencyService, SUPPORTED_CURRENCIES } from '~/services/currencyService'
import { Building2, ShieldCheck, Zap, ScanLine, Lock, Clock, CloudOff, Cloud } from '@tamagui/lucide-icons'
import * as Network from 'expo-network'
import { useToastController } from '@tamagui/toast'
import { Image } from 'tamagui'
import { nip19 } from 'nostr-tools'
import { eventService, proofService } from '~/services/core'
import SendMethodSelector, { SendMode } from '~/components/SendMethodSelector'
import { PaymentRequest, PaymentRequestTransportType } from '@cashu/cashu-ts'
import Blockies from '~/components/UI/Blockies'
import { OfflineOptimizationSheet, type OfflineOptimizationSheetRef } from '~/components/OfflineOptimizationSheet'

type SendStep = 'amount' | 'confirm' | 'result' | 'success' | 'payment_request';

/** Parse a NUT-18 creqA/creqB string into our UI model */
function parsePaymentRequest(raw: string): ParsedPaymentRequest | null {
    try {
        let cleaned = raw.trim();
        const lower = cleaned.toLowerCase();

        // Extract payment request if it's a URL
        if (lower.includes('/r#') || lower.includes('/r/#') || lower.includes('/r/')) {
            const markers = ['/r/#', '/r#', '/r/'];
            for (const marker of markers) {
                const idx = lower.indexOf(marker);
                if (idx !== -1) {
                    cleaned = cleaned.slice(idx + marker.length);
                    break;
                }
            }
        }

        const pr = PaymentRequest.fromEncodedRequest(cleaned);
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
            raw: cleaned,
            id: pr.id ?? undefined,
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
    const toast = useToastController()
    const [step, setStep] = useState<SendStep>('amount')
    const [amount, setAmount] = useState('0')
    const [status, setStatus] = useState<'success' | 'error'>('success')
    const [error, setError] = useState<string | null>(null)
    const [encodedToken, setEncodedToken] = useState<string | null>(null)
    const rawTokenRef = React.useRef<string | null>(null)
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
    const [expiryEnabled, setExpiryEnabled] = useState(true)
    const [expiryHours, setExpiryHours] = useState(168) // Default to 7 days (168 hours)
    const [expiresAt, setExpiresAt] = useState<number | undefined>(undefined)
    const [isHardwareOffline, setIsHardwareOffline] = useState(false)
    const [forceOffline, setForceOffline] = useState(false)
    const [selectedOfflineProofs, setSelectedOfflineProofs] = useState<any[] | null>(null)
    const isOffline = isHardwareOffline || forceOffline
    const optimizationSheetRef = React.useRef<OfflineOptimizationSheetRef>(null)

    const handleOfflineOptimizationConfirm = useCallback((optimizedAmount: number, proofs: any[]) => {
        console.log('[SendModalScreen] Offline optimization confirmed amount:', optimizedAmount, 'proofs:', proofs.length);
        setAmount(String(optimizedAmount));
        setSelectedOfflineProofs(proofs);
        setStep('confirm');
    }, []);

    React.useEffect(() => {
        const checkNetwork = async () => {
            try {
                const state = await Network.getNetworkStateAsync();
                setIsHardwareOffline(!state.isConnected || state.isInternetReachable === false);
            } catch (e) {
                setIsHardwareOffline(false);
            }
        };
        checkNetwork();
        const interval = setInterval(checkNetwork, 4000);
        return () => clearInterval(interval);
    }, []);

    const router = useRouter()
    const queryClient = useQueryClient();

    // ── Read params from contact-details or deep link ─────────────────────
    const params = useLocalSearchParams<{ paymentRequest?: string; to?: string; username?: string; mode?: string; inboxItemId?: string }>();

    // Auto-select Nostr mode + pre-fill recipient when coming from contact-details
    React.useEffect(() => {
        const checkOfflineMode = async () => {
            try {
                const state = await Network.getNetworkStateAsync();
                const offline = !state.isConnected || !state.isInternetReachable;
                if (offline && (params.mode === 'nostr' || params.mode === 'scan')) {
                    Alert.alert('You are offline', `${params.mode === 'nostr' ? 'Nostr Send' : 'Scan & Pay'} is not available offline. Switched to Standard Mode.`);
                    setSendMode('standard');
                    return;
                }
            } catch (e) {
                console.warn('[SendModalScreen] Network check error:', e);
            }

            if (params.mode === 'nostr' && params.to) {
                setSendMode('nostr');
                setNostrRecipientNpub(params.to as string);
                setNostrRecipientUsername(params.username ? `${params.username}@bey.cash` : '');
            } else if (params.mode) {
                setSendMode(params.mode as SendMode);
            }
        };
        checkOfflineMode();
    }, [params.mode, params.to, params.username, isHardwareOffline]);

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
                    const tokenToPoll = rawTokenRef.current;
                    if (!tokenToPoll) return;
                    const states = await proofService.checkProofStates(tokenToPoll);
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
                const tokenToPoll = rawTokenRef.current;
                if (!tokenToPoll) return;
                const states = await proofService.checkProofStates(tokenToPoll);
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

            if (isOffline) {
                let selected = selectedOfflineProofs;
                if (!selected || selected.length === 0) {
                    const repo = initService.getRepo();
                    const availableProofs = await repo.proofRepository.getAvailableProofs(activeMintUrl);
                    const { findExactSubset } = require('~/utils/offlineSendUtils');
                    selected = findExactSubset(amountSats, availableProofs);
                }
                if (!selected || selected.length === 0) {
                    throw new Error(`Cannot form exactly ${amountSats} sats from offline proofs`);
                }
                result = await walletService.sendOffline(activeMintUrl, amountSats, selected);
                rawTokenRef.current = result.encoded;
                setEncodedToken(result.encoded);
                setOperationId(result.id);
            } else if (sendMode === 'p2pk') {
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
                rawTokenRef.current = result.encoded;
                setEncodedToken(result.encoded);
                setOperationId(result.id);
            } else {
                result = await walletService.send(activeMintUrl, amountSats);
                rawTokenRef.current = result.token;
                setEncodedToken(result.token);
                setOperationId(result.id);
            }

            setStatus('success');
            refreshBalance();
            console.log('[SendModalScreen] Send successful. OpId:', result.id, 'Token length:', (result.encoded || result.token || '').length);

            const computedExpiry = expiryEnabled ? Date.now() + expiryHours * 60 * 60 * 1000 : undefined;
            setExpiresAt(computedExpiry);

            // Tag this as a locally-created ecash token (not sent via Nostr)
            historyService.tagHistoryVia(
                activeMintUrl,
                'send',
                'ecash_create',
                computedExpiry ? {
                    expiresAt: computedExpiry,
                    expiryHours: expiryHours,
                } : undefined,
                result.id,
            ).catch(() => { });

            setStep('result');
        } catch (err: any) {
            console.error('[SendModal] Failed to send:', err);
            setError(err.message || 'Failed to create token');
            setStatus('error');
            setStep('result');
        } finally {
            setIsProcessing(false);
        }
    }, [activeMintUrl, amount, balance, refreshBalance, expiryEnabled, expiryHours, sendMode, receiverPubkey, isOffline, selectedOfflineProofs]);

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
            rawTokenRef.current = result.encoded;

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

            const computedExpiry = expiryEnabled ? Date.now() + expiryHours * 60 * 60 * 1000 : undefined;
            setExpiresAt(computedExpiry);

            // Tag as Nostr send with recipient username
            historyService.tagHistoryVia(
                activeMintUrl,
                'send',
                'nostr',
                {
                    nostrPubkey: nostrRecipientNpub,
                    ...(nostrRecipientUsername ? { nostrUsername: nostrRecipientUsername.replace('@bey.cash', '') } : {}),
                    ...(computedExpiry ? {
                        expiresAt: computedExpiry,
                        expiryHours: expiryHours,
                    } : {}),
                },
                result.id,
            ).catch(() => { });

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
    }, [activeMintUrl, amount, balance, nostrRecipientNpub, useP2PK, refreshBalance, expiryEnabled, expiryHours, nostrRecipientUsername]);

    const handleExecuteSend = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        try {
            if (sendMode === 'nostr') {
                if (isOffline) {
                    setError('You are offline. Cannot send via Nostr.');
                    setStatus('error');
                    setStep('result');
                    return;
                }
                await handleNostrSend();
            } else {
                await handleSend();
            }
        } catch (error: any) {
            console.error('[SendModal] Execution error:', error);
            setError(error.message || 'Send failed');
            setStatus('error');
            setStep('result');
        }
    };

    const handleNext = () => {
        if (step === 'amount') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            if (isOffline) {
                optimizationSheetRef.current?.present();
            } else {
                setSelectedOfflineProofs(null);
                setStep('confirm');
            }
        }
    };

    const handleClose = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/(tabs)');
        }
        // Refresh balance AFTER navigation animation settles — prevents freeze
        InteractionManager.runAfterInteractions(() => refreshBalance());
    };

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
    };

    const headerTitle = React.useMemo(() => {
        if (step === 'confirm') return 'Confirm Send';
        if (step === 'result') return status === 'success' ? 'Success' : 'Error';
        if (step === 'success') return 'Success';
        if (sendMode === 'p2pk') return 'P2PK Send';
        if (sendMode === 'nostr') return 'Nostr Send';
        if (sendMode === 'scan') return 'Scan & Pay';
        return 'Send Ecash';
    }, [step, status, sendMode]);

    return (
        <YStack flex={1} bg="$background" px="$4">
            <Stack.Screen
                options={{
                    headerTitle: () => (
                        <H4 fontWeight="bold">{headerTitle}</H4>
                    )

                    ,
                    headerRight: () => (
                        <Button
                            size="$3"
                            circular
                            
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                const nextForceOffline = !forceOffline;
                                setForceOffline(nextForceOffline);
                                if (nextForceOffline) {
                                    toast.show('Offline Mode Enabled', {
                                        message: 'Using local ecash proofs for sends.',
                                    });
                                } else {
                                    toast.show('Online Mode Enabled', {
                                        message: 'Reconnected for standard online payments.',
                                    });
                                }
                            }}
                            disabled={isHardwareOffline}
                            disabledStyle={{ opacity: 0.8 }}
                            pressStyle={{ scale: 0.95 }}

                        >
                            <XStack items="center">
                                {isOffline ? (
                                    <>
                                        <CloudOff color="$red10" />

                                    </>
                                ) : (
                                    <>
                                        <Cloud color="$color" />

                                    </>
                                )}
                            </XStack>
                        </Button>
                    )
                }}
            />
            {step === 'payment_request' && activeParsedRequest && (
                <PaymentRequestStage
                    request={activeParsedRequest}
                    inboxItemId={params.inboxItemId}
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
                    {(() => {
                        console.log('[SendModalScreen] Rendering step: amount, sendMode:', sendMode, 'isOffline:', isOffline);
                        return null;
                    })()}
                    {sendMode === 'standard' && (
                        <AmountStage
                            amount={amount}
                            setAmount={setAmount}
                            onContinue={handleNext}
                            balance={balance}
                            isLoading={isProcessing}
                            error={error}
                            isOffline={isOffline}
                            onSelectedProofsChange={setSelectedOfflineProofs}
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
                            isOffline={isOffline}
                            onSelectedProofsChange={setSelectedOfflineProofs}
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
                    expiresAt={expiresAt}
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

            {step === 'confirm' && (
                <ConfirmStage
                    amount={amount}
                    mintUrl={activeMintUrl || ''}
                    estimatedFee={estimatedFee}
                    sendMode={sendMode}
                    useP2PK={useP2PK}
                    setUseP2PK={setUseP2PK}
                    expiryEnabled={expiryEnabled}
                    setExpiryEnabled={setExpiryEnabled}
                    nostrRecipientNpub={nostrRecipientNpub}
                    nostrRecipientUsername={nostrRecipientUsername}
                    receiverPubkey={receiverPubkey}
                    isLoading={isProcessing || nostrSending}
                    onConfirm={handleExecuteSend}
                    onBack={() => setStep('amount')}
                />
            )}

            {/* ProcessingSheet for Nostr sending */}
            <ProcessingSheet
                visible={nostrSending}
                status="processing"
                variant="nostr"
                title="Sending via Nostr"
                amount={parseInt(amount, 10) || 0}
                detail={`Sending to ${nostrRecipientUsername || nostrRecipientNpub.slice(0, 10) + '…'}`}
            />

            {/* ProcessingSheet for standard send */}
            <ProcessingSheet
                visible={isProcessing && !isOffline && !nostrSending}
                title="Processing"
                amount={parseInt(amount, 10) || 0}
                detail="Creating ecash tokens..."
            />

            {/* Offline Optimization Selector */}
            <OfflineOptimizationSheet
                ref={optimizationSheetRef}
                targetAmount={parseInt(amount, 10) || 0}
                activeMintUrl={activeMintUrl}
                onConfirm={handleOfflineOptimizationConfirm}
            />
        </YStack>
    )
}
