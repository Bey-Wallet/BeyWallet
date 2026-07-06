import React, { useState, useEffect, useMemo, useRef } from "react";
import { YStack, XStack, Text, H1, Input, Button, Separator, ScrollView, View, Spinner } from "tamagui";
import { Clipboard as ClipboardIcon, ScanLine, AlertCircle, ShieldCheck, Landmark, Check } from "@tamagui/lucide-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useWalletStore } from "~/store/walletStore";
import { quotesService } from "~/services/core";
import { useToastController } from "@tamagui/toast";
import { onchainNetwork } from "~/utils/onchain";

export function OnchainMeltFlow() {
    const router = useRouter();
    const toast = useToastController();

    const balance = useWalletStore(s => s.balance);
    const activeMintUrl = useWalletStore(s => s.activeMintUrl);
    const refreshBalance = useWalletStore(s => s.refreshBalance);
    const scannerResult = useWalletStore(s => s.scannerResult);
    const setScannerResult = useWalletStore(s => s.setScannerResult);

    const [step, setStep] = useState<'input' | 'confirm' | 'paying' | 'success' | 'error'>('input');
    const [address, setAddress] = useState('');
    const [amount, setAmount] = useState('');
    const [isPasting, setIsPasting] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Quote details
    const [meltQuote, setMeltQuote] = useState<any>(null);

    // Watch for scanned QR codes
    useEffect(() => {
        if (scannerResult) {
            let cleaned = scannerResult.trim();
            if (cleaned.toLowerCase().startsWith("bitcoin:")) {
                // Parse bitcoin URI e.g. bitcoin:address?amount=0.001
                const parsed = cleaned.replace(/^bitcoin:/i, "");
                const addressPart = parsed.split("?")[0];
                setAddress(addressPart);
                
                // Extract amount if present
                const amountMatch = parsed.match(/amount=([0-9.]+)/i);
                if (amountMatch && amountMatch[1]) {
                    const btc = parseFloat(amountMatch[1]);
                    const sats = Math.round(btc * 100000000);
                    setAmount(sats.toString());
                }
            } else {
                setAddress(cleaned);
            }
            setScannerResult(null);
        }
    }, [scannerResult, setScannerResult]);

    // Handle pasting from clipboard
    const handlePaste = async () => {
        setIsPasting(true);
        try {
            let text = await Clipboard.getStringAsync();
            text = text.trim();
            if (text.toLowerCase().startsWith("bitcoin:")) {
                const parsed = text.replace(/^bitcoin:/i, "");
                const addressPart = parsed.split("?")[0];
                setAddress(addressPart);
                
                const amountMatch = parsed.match(/amount=([0-9.]+)/i);
                if (amountMatch && amountMatch[1]) {
                    const btc = parseFloat(amountMatch[1]);
                    const sats = Math.round(btc * 100000000);
                    setAmount(sats.toString());
                }
            } else {
                setAddress(text);
            }
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            toast.show("Pasted!", { message: "Address pasted from clipboard" });
        } catch (e) {
            console.warn("[OnchainMeltFlow] Clipboard read failed:", e);
        } finally {
            setIsPasting(false);
        }
    };

    // Address verification helper
    const isValidAddress = useMemo(() => {
        const cleaned = address.trim();
        if (!cleaned) return false;
        // Simple regex check for standard mainnet/testnet bitcoin addresses
        return (
            /^(1|3|bc1|tb1|m|n|2)[a-km-zA-HJ-NP-Z1-9]{25,90}$/i.test(cleaned)
        );
    }, [address]);

    const amountSats = parseInt(amount, 10) || 0;
    const isOverBalance = amountSats > balance;
    const canContinue = isValidAddress && amountSats > 0 && !isOverBalance;

    // Handle quote creation
    const handleGetQuote = async () => {
        if (!activeMintUrl || !canContinue) return;
        setErrorMsg(null);
        setStep('paying'); // temporarily show spinner during quote creation

        try {
            const quote = await quotesService.createOnchainMeltQuote(activeMintUrl, address.trim(), amountSats);
            setMeltQuote(quote);
            setStep('confirm');
        } catch (err: any) {
            console.error('[OnchainMeltFlow] Melt quote failed:', err);
            setErrorMsg(err.message || 'Failed to estimate transaction fees');
            setStep('input');
        }
    };

    // Confirm and melt payments
    const handlePayMelt = async () => {
        if (!activeMintUrl || !meltQuote) return;
        setErrorMsg(null);
        setStep('paying');

        try {
            await quotesService.payOnchainMeltQuote(activeMintUrl, meltQuote);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            
            // Log outgoing transaction in history
            try {
                const repo = quotesService.getRepo ? quotesService.getRepo() : initService.getRepo();
                await repo.historyRepository.addHistoryEntry({
                    mintUrl: activeMintUrl,
                    unit: 'sat',
                    createdAt: Date.now(),
                    type: 'melt',
                    amount: amountSats,
                    quoteId: meltQuote.quote,
                    state: 'paid',
                    metadata: {
                        via: 'onchain',
                        address: address.trim(),
                        fee: meltQuote.fee_reserve
                    }
                });
            } catch (histErr) {
                console.warn('[OnchainMeltFlow] History injection failed (non-fatal):', histErr);
            }

            setStep('success');
            refreshBalance();
        } catch (err: any) {
            console.error('[OnchainMeltFlow] Payment execution failed:', err);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            setErrorMsg(err.message || 'Failed to send payment');
            setStep('error');
        }
    };

    // Render loading/processing state
    if (step === 'paying') {
        return (
            <YStack flex={1} justify="center" items="center" gap="$4" bg="$background" p="$6">
                <Spinner size="large" color="$accent10" />
                <Paragraph color="$gray10">Processing your transaction...</Paragraph>
            </YStack>
        );
    }

    // Render error state
    if (step === 'error') {
        return (
            <YStack flex={1} justify="center" items="center" gap="$4" bg="$background" p="$6">
                <Text fontSize={18} fontWeight="bold" color="$red10">Transaction Failed</Text>
                <Paragraph textAlign="center" color="$gray10">{errorMsg}</Paragraph>
                <Button theme="accent" size="$5" rounded="$5" width="100%" onPress={() => setStep('input')} mt="$4">
                    Try Again
                </Button>
            </YStack>
        );
    }

    // Render success state
    if (step === 'success') {
        return (
            <YStack flex={1} justify="center" items="center" gap="$6" bg="$background" p="$6">
                <View bg="$green4" p="$4" rounded="$10">
                    <ShieldCheck size={64} color="$green10" />
                </View>
                <YStack items="center" gap="$2">
                    <Text fontSize={24} fontWeight="bold" color="$color">Payment Sent!</Text>
                    <Paragraph textAlign="center" color="$gray10" maxW={300}>
                        {amountSats} satoshis are on their way to the target Bitcoin address.
                    </Paragraph>
                </YStack>
                <Button theme="accent" size="$5" rounded="$5" width="100%" onPress={() => router.back()}>
                    Done
                </Button>
            </YStack>
        );
    }

    // Render confirmation state
    if (step === 'confirm' && meltQuote) {
        const total = meltQuote.amount + meltQuote.fee_reserve;
        return (
            <YStack flex={1} bg="$background" justify="space-between" p="$4">
                <YStack gap="$6" pt="$4">
                    <YStack items="center" gap="$1">
                        <Text fontSize="$4" color="$gray11">You are sending</Text>
                        <H1 fontSize={44} fontWeight="800" color="$color">{meltQuote.amount} sats</H1>
                    </YStack>

                    <YStack bg="$gray3" p="$4" rounded="$5" gap="$3">
                        <XStack justify="space-between" items="center">
                            <Text color="$gray11">Address</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxWidth: "60%" }}>
                                <Text fontWeight="600" fontFamily="$mono">{address}</Text>
                            </ScrollView>
                        </XStack>
                        <XStack justify="space-between" items="center">
                            <Text color="$gray11">Network</Text>
                            <Text fontWeight="600" color="$accent10">{onchainNetwork(address) === 'mutinynet' ? 'Mutinynet' : 'Bitcoin'}</Text>
                        </XStack>
                        <Separator />
                        <XStack justify="space-between" items="center">
                            <Text color="$gray11">On-chain Network Fee</Text>
                            <Text fontWeight="600">{meltQuote.fee_reserve} sats</Text>
                        </XStack>
                        <Separator />
                        <XStack justify="space-between" items="center">
                            <Text fontWeight="bold" color="$color">Total Cost</Text>
                            <Text fontWeight="bold" fontSize={18} color="$accent10">{total} sats</Text>
                        </XStack>
                    </YStack>
                </YStack>

                <YStack gap="$2" pb="$4">
                    <Button theme="accent" size="$5" rounded="$5" onPress={handlePayMelt}>
                        Confirm & Pay
                    </Button>
                    <Button size="$5" bg="$gray4" rounded="$5" onPress={() => setStep('input')}>
                        Cancel
                    </Button>
                </YStack>
            </YStack>
        );
    }

    // Render input form state
    return (
        <YStack flex={1} bg="$background" justify="space-between" p="$4">
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 } as any}>
                <YStack gap="$5" pt="$2">
                    <YStack gap="$2">
                        <Text fontWeight="600" fontSize="$4">Bitcoin Address</Text>
                        <XStack gap="$2">
                            <Input
                                flex={1}
                                size="$4"
                                placeholder="Paste or scan BTC address..."
                                value={address}
                                onChangeText={setAddress}
                                rounded="$4"
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                            <Button
                                size="$4"
                                icon={<ClipboardIcon size={20} />}
                                onPress={handlePaste}
                                disabled={isPasting}
                            />
                            <Button
                                size="$4"
                                icon={<ScanLine size={20} />}
                                onPress={() => {
                                    router.push({
                                        pathname: "/(modals)/scanner",
                                        params: { returnTo: "/(modals)/melt" }
                                    });
                                }}
                            />
                        </XStack>
                    </YStack>

                    <YStack gap="$2">
                        <Text fontWeight="600" fontSize="$4">Amount (Satoshis)</Text>
                        <Input
                            size="$4"
                            keyboardType="numeric"
                            placeholder="Enter amount in sats..."
                            value={amount}
                            onChangeText={setAmount}
                            rounded="$4"
                        />
                        <XStack justify="space-between" items="center">
                            <Text fontSize="$2" color="$gray10">Balance: {balance} sats</Text>
                            {isOverBalance && (
                                <Text fontSize="$2" color="$red10" fontWeight="600">
                                    Insufficient balance
                                </Text>
                            )}
                        </XStack>
                    </YStack>

                    {errorMsg && (
                        <XStack bg="$red3" p="$3" rounded="$4" items="center" gap="$2">
                            <AlertCircle size={20} color="$red10" />
                            <Text flex={1} fontSize="$3" color="$red10">{errorMsg}</Text>
                        </XStack>
                    )}
                </YStack>
            </ScrollView>

            <YStack gap="$2" pb="$4">
                <Button
                    theme="accent"
                    size="$5"
                    rounded="$5"
                    disabled={!canContinue}
                    opacity={canContinue ? 1 : 0.6}
                    onPress={handleGetQuote}
                >
                    Continue
                </Button>
                <Button
                    size="$5"
                    bg="$gray4"
                    rounded="$5"
                    onPress={() => router.back()}
                >
                    Cancel
                </Button>
            </YStack>
        </YStack>
    );
}
