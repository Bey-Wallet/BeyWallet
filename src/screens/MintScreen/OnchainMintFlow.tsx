import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { YStack, XStack, Text, Button, View, Paragraph, Separator, ScrollView, Spinner } from "tamagui";
import { Copy, Check, Clock, ShieldCheck, RefreshCw, X, Bitcoin, XCircle } from "@tamagui/lucide-icons";
import QRCode from "react-native-qrcode-svg";
import * as Clipboard from 'expo-clipboard';
import { networkService } from '~/services/networkService';
import * as Haptics from 'expo-haptics';
import { useToastController } from '@tamagui/toast';
import { useRouter } from 'expo-router';
import { useWalletStore } from "~/store/walletStore";
import { quotesService, initService } from "~/services/core";
import { onchainNetworkDisplay } from "~/utils/onchain";
import { ListTable, ListTableRow } from "~/components/UI/ListTable";
import { useQuery } from "@tanstack/react-query";
import { bitcoinService } from "~/services/bitcoinService";
import { currencyService, CurrencyCode } from "~/services/currencyService";
import { useSettingsStore } from "~/store/settingsStore";

export function OnchainMintFlow() {
    const router = useRouter();
    const toast = useToastController();
    const activeMintUrl = useWalletStore(s => s.activeMintUrl);
    const refreshBalance = useWalletStore(s => s.refreshBalance);
    const { mints } = useWalletStore();
    const { primaryCurrency, secondaryCurrency } = useSettingsStore();

    const [step, setStep] = useState<'loading' | 'deposit' | 'success' | 'error'>('loading');
    const [quoteData, setQuoteData] = useState<{ quote: string; request: string; privKey: string; pubKey: string } | null>(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [copied, setCopied] = useState(false);
    
    // Payment status tracking
    const [isChecking, setIsChecking] = useState(false);
    const [amountPaid, setAmountPaid] = useState(0);
    const [amountIssued, setAmountIssued] = useState(0);
    const [txState, setTxState] = useState('UNPAID');

    const { data: btcData } = useQuery({
        queryKey: ['bitcoinPrice', secondaryCurrency],
        queryFn: () => bitcoinService.fetchPrice(secondaryCurrency),
        staleTime: 30000,
    });

    const activeMint = useMemo(() => {
        if (!activeMintUrl) return null;
        return mints.find((m) => m.mintUrl.replace(/\/$/, "") === activeMintUrl.replace(/\/$/, ""));
    }, [mints, activeMintUrl]);

    const mintDisplayName = useMemo(() => {
        if (!activeMintUrl) return "Selected Mint";
        if (activeMint?.nickname) return activeMint.nickname;
        if (activeMint?.name) return activeMint.name;
        return activeMintUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
    }, [activeMint, activeMintUrl]);

    // Create the quote on mount
    useEffect(() => {
        if (!activeMintUrl) {
            setErrorMsg('No active mint selected');
            setStep('error');
            return;
        }

        let isMounted = true;

        const initFlow = async () => {
            const offline = await networkService.isOffline();
            if (offline) {
                if (isMounted) {
                    setErrorMsg('You are offline. Please check your internet connection.');
                    setStep('error');
                }
                return;
            }

            try {
                const data = await quotesService.createOnchainMintQuote(activeMintUrl);
                if (isMounted) {
                    setQuoteData(data);
                    setStep('deposit');

                    // Save quote details to local history database
                    try {
                        const repo = initService.getRepo();
                        await (repo.historyRepository as any).addHistoryEntry({
                            mintUrl: activeMintUrl,
                            unit: 'sat',
                            createdAt: Date.now(),
                            type: 'mint',
                            amount: 0, // initially 0
                            quoteId: data.quote,
                            state: 'pending',
                            paymentRequest: data.request, // BTC address as paymentRequest
                            metadata: {
                                via: 'onchain',
                                privKey: data.privKey,
                                pubKey: data.pubKey,
                                address: data.request
                            }
                        });
                        console.log('[OnchainMintFlow] Saved on-chain quote in local database history:', data.quote);
                    } catch (dbErr) {
                        console.warn('[OnchainMintFlow] Failed to save on-chain quote to history:', dbErr);
                    }
                }
            } catch (err: any) {
                if (isMounted) {
                    console.error('[OnchainMintFlow] Failed to create quote:', err);
                    setErrorMsg(err.message || 'Failed to request deposit address');
                    setStep('error');
                }
            }
        };

        initFlow();

        return () => {
            isMounted = false;
        };
    }, [activeMintUrl]);

    // Handle copying Bitcoin address
    const handleCopy = async () => {
        if (!quoteData) return;
        await Clipboard.setStringAsync(quoteData.request);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setCopied(true);
        toast.show('Copied!', { message: 'Address copied to clipboard' });
        setTimeout(() => setCopied(false), 2000);
    };

    // Manual check and redeem handler
    const handleCheckPayment = useCallback(async (showToast = true) => {
        if (!activeMintUrl || !quoteData || isChecking) return;

        setIsChecking(true);
        try {
            console.log('[OnchainMintFlow] Checking deposit status for:', quoteData.quote);
            const status = await quotesService.checkOnchainMintQuote(activeMintUrl, quoteData.quote);
            setAmountPaid(status.amount_paid);
            setAmountIssued(status.amount_issued);
            setTxState(status.state);

            const delta = status.amount_paid - status.amount_issued;
            if (delta > 0) {
                console.log('[OnchainMintFlow] Payment detected, redeeming...', delta, 'sats');
                await quotesService.redeemOnchainMintQuote(activeMintUrl, quoteData.quote, quoteData.privKey);
                
                // Update history entry state in DB
                try {
                    const repo = initService.getRepo();
                    await (repo.historyRepository as any).updateHistoryMintEntry(activeMintUrl, quoteData.quote, 'paid', status.amount_paid);
                } catch (dbErr) {
                    console.warn('[OnchainMintFlow] Failed to update history state to paid:', dbErr);
                }

                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setStep('success');
                refreshBalance();
            } else {
                if (showToast) {
                    toast.show('Checking status', { message: 'No new payments detected yet.' });
                }
            }
        } catch (err: any) {
            console.error('[OnchainMintFlow] Check payment error:', err);
            if (showToast) {
                toast.show('Error checking payment', { message: err.message || 'Failed to check status' });
            }
        } finally {
            setIsChecking(false);
        }
    }, [activeMintUrl, quoteData, isChecking, refreshBalance, toast]);

    // Periodically poll for payment status
    useEffect(() => {
        if (step !== 'deposit' || !quoteData) return;
    
        const interval = setInterval(() => {
            handleCheckPayment(false);
        }, 10000);
    
        return () => clearInterval(interval);
    }, [step, quoteData, handleCheckPayment]);

    // Render loading state
    if (step === 'loading') {
        return (
            <YStack flex={1} justify="center" items="center" gap="$4" bg="$background" p="$6">
                <Spinner size="large" color="$accent10" />
                <Paragraph color="$gray10">Generating on-chain deposit address...</Paragraph>
            </YStack>
        );
    }

    // Render error state
    if (step === 'error') {
        return (
            <YStack flex={1} justify="space-between" bg="$background" >
                <YStack flex={1} justify="center" items="center" gap="$4" p="$4">
                    <XCircle size={80} color="$red10" />
                    <Text color="$red10" fontSize="$6" fontWeight="700" text="center">Deposit Address Failed</Text>
                    <Text color="$gray10" fontSize="$4" text="center" px="$4">{errorMsg || 'Could not request a deposit address.'}</Text>
                </YStack>
                <Button theme="accent" size="$5" height={55} rounded="$4" fontWeight="800" onPress={() => router.back()}>
                    Go Back
                </Button>
            </YStack>
        );
    }

    // Render success state
    if (step === 'success') {
        const fiatValue = btcData?.price
            ? currencyService.formatValue(
                currencyService.convertSatsToCurrency(amountPaid, btcData.price),
                secondaryCurrency as CurrencyCode
            )
            : '...';

        return (
            <YStack flex={1} justify="space-between" bg="$background">
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, paddingBottom: 120 } as any} >
                    <YStack gap="$4" width="100%">
                        {/* Oswald Typography Amount Display */}
                        <YStack gap="$3" py="$6" items="center" justify="center">
                            <Text fontSize={52} fontFamily="$oswald" fontWeight="700" color="$green10" lineHeight={54}>
                                +{currencyService.formatSats(amountPaid)}
                            </Text>
                            <Text color="$accent5" fontWeight="600" fontSize={16}>
                                ≈ {fiatValue} {secondaryCurrency}
                            </Text>
                        </YStack>

                        {/* Centered green badge */}
                        <XStack
                            self="center"
                            items="center"
                            gap="$2"
                            bg="$green9"
                            px="$4"
                            py="$3"
                            rounded="$10"
                        >
                            <Check size={16} color="white" />
                            <Text
                                fontSize="$3"
                                fontWeight="700"
                                color="white"
                            >
                                Deposit Received
                            </Text>
                        </XStack>

                        {/* Description Text */}
                        <YStack px="$4" py="$2">
                            <Text color="$gray10" fontSize="$4" text="center" lineHeight={20}>
                                Your Bitcoin deposit has been recognized and minted as ecash.
                            </Text>
                        </YStack>

                        {/* Details Table */}
                        <YStack bg="$gray2" rounded="$5" overflow="hidden" mb="$6" separator={<Separator borderColor="$borderColor" opacity={0.4} />}>
                            <XStack justify="space-between" items="center" py="$3" px="$4">
                                <Text fontSize="$3" color="$gray10" fontWeight="600">Status</Text>
                                <Text fontSize="$3" fontWeight="800" color="$green10">PAID</Text>
                            </XStack>
                            <XStack justify="space-between" items="center" py="$3" px="$4">
                                <Text fontSize="$3" color="$gray10" fontWeight="600">Net Amount</Text>
                                <Text fontSize="$3" fontWeight="800" color="$color">{currencyService.formatSats(amountPaid)}</Text>
                            </XStack>
                            <XStack justify="space-between" items="center" py="$3" px="$4">
                                <Text fontSize="$3" color="$gray10" fontWeight="600">Mint</Text>
                                <Text fontSize="$3" fontWeight="800" color="$color">{mintDisplayName}</Text>
                            </XStack>
                            <XStack justify="space-between" items="center" py="$3" px="$4">
                                <Text fontSize="$3" color="$gray10" fontWeight="600">Date</Text>
                                <Text fontSize="$3" fontWeight="800" color="$color">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                            </XStack>
                        </YStack>
                    </YStack>
                </ScrollView>
                <YStack py="$4"  bg="$background">
                    <Button theme="accent" size="$5" height={55} rounded="$4" fontWeight="800" onPress={() => router.back()}>
                        Awesome
                    </Button>
                </YStack>
            </YStack>
        );
    }

    // Render deposit state (displays Bitcoin address and QR code)
    return (
        <YStack flex={1} bg="$background" justify="space-between">
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 } as any}>
                <YStack items="center" gap="$4" mb="$4">
                  
                    {quoteData && (
                        <View bg="white" p="$3" borderColor="$borderColor" borderWidth={1} rounded="$5">
                            <QRCode
                                value={quoteData.request}
                                size={320}
                                backgroundColor="white"
                                color="black"
                                quietZone={10}
                            />
                        </View>
                    )}

                    <XStack
                        bg="$gray4"
                        p="$3"
                        rounded="$5"
                        items="center"
                        justify="space-between"
                        gap="$2"
                        width="100%"
                        onPress={handleCopy}
                        pressStyle={{ opacity: 0.8 }}
                    >
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
                            <Text fontSize="$3" color="$color" fontFamily="$mono">
                                {quoteData?.request}
                            </Text>
                        </ScrollView>
                        <Button
                            size="$3"
                            bg="$gray5"
                            circular
                            icon={copied ? <Check size={18} color="$green10" /> : <Copy size={18} color="$color" />}
                            onPress={handleCopy}
                        />
                    </XStack>
                </YStack>

                <ListTable>
                    <ListTableRow label="Network" value={quoteData ? onchainNetworkDisplay(quoteData.request) : 'Bitcoin'} valueColor="$orange10" />
                    <ListTableRow 
                        label="Checking Status" 
                        value="Every 10s" 
                        iconAfter={isChecking ? <Spinner size="small" color="$accent10" /> : <Clock size={14} color="$gray10" />}
                    />
                </ListTable>
            </ScrollView>

            <XStack  bg="$background" gap="$2">
                <Button
                    size="$5"
                    flex={1}
                    bg="$gray3"
                    color="$color"
                    height={55}
                    rounded="$4"
                    fontWeight="800"
                    onPress={() => router.back()}
                >
                    Close
                </Button>
                <Button
                    theme="accent"
                    size="$5"
                    flex={1}
                    height={55}
                    rounded="$4"
                    fontWeight="800"
                    icon={isChecking ? <Spinner size="small" /> : <RefreshCw size={20} />}
                    onPress={() => handleCheckPayment(true)}
                    disabled={isChecking}
                >
                    Check
                </Button>
            </XStack>
        </YStack>
    );
}
