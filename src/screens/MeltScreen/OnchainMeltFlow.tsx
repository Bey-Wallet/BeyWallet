import React, { useState, useEffect, useMemo, useRef } from "react";
import { YStack, XStack, Text, H1, Input, Button, Separator, ScrollView, View, Spinner } from "tamagui";
import { Clipboard as ClipboardIcon, ScanLine, AlertCircle, ShieldCheck, Landmark, Check, Zap, ArrowUpDown, Coins, Info } from "@tamagui/lucide-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useWalletStore } from "~/store/walletStore";
import { quotesService, initService } from "~/services/core";
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
    const [selectedFeeIndex, setSelectedFeeIndex] = useState<number>(0);

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

    // Automatically clean and parse pasted Bitcoin URIs
    const handleAddressChange = (text: string) => {
        let cleaned = text.trim();
        if (cleaned.toLowerCase().startsWith("bitcoin:")) {
            const parsed = cleaned.replace(/^bitcoin:/i, "");
            cleaned = parsed.split("?")[0];
            
            // Extract amount if present
            const amountMatch = parsed.match(/amount=([0-9.]+)/i);
            if (amountMatch && amountMatch[1]) {
                const btc = parseFloat(amountMatch[1]);
                const sats = Math.round(btc * 100000000);
                setAmount(sats.toString());
            }
        }
        setAddress(cleaned);
    };

    // Address verification helper
    const isValidAddress = useMemo(() => {
        const cleaned = address.trim();
        if (!cleaned) return false;
        // Support standard base58 and bech32/bech32m addresses (which contain 0 and go up to 90+ chars)
        const regex = /^(1|3|bc1|tb1|bcrt1|m|n|2)[a-zA-Z0-9]{25,95}$/i;
        const matched = regex.test(cleaned);
        return matched;
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
            if (quote.fee_options?.length) {
                setSelectedFeeIndex(quote.fee_options[0].fee_index);
            }
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
            const response = await quotesService.payOnchainMeltQuote(activeMintUrl, meltQuote, selectedFeeIndex);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            
            // Log outgoing transaction in history
            try {
                const repo = quotesService.getRepo ? quotesService.getRepo() : initService.getRepo();
                const selectedOption = meltQuote.fee_options?.find((o: any) => o.fee_index === selectedFeeIndex) || meltQuote.fee_options?.[0];
                const selectedFeeReserve = selectedOption ? selectedOption.fee_reserve : (meltQuote.fee_reserve ?? 0);

                const changeOutputsSerialized = response.changeOutputs?.map((h: any) => ({
                    secret: Array.from(h.secret).map((b: any) => b.toString(16).padStart(2, '0')).join(''),
                    blindingFactor: h.blindingFactor.toString(),
                    blindedMessage: h.blindedMessage
                })) ?? [];

                await repo.historyRepository.addHistoryEntry({
                    mintUrl: activeMintUrl,
                    unit: 'sat',
                    createdAt: Date.now(),
                    type: 'melt',
                    amount: amountSats,
                    quoteId: meltQuote.quote,
                    state: 'pending',
                    metadata: {
                        via: 'onchain',
                        address: address.trim(),
                        fee: selectedFeeReserve,
                        inputs: response.selectedInputs?.map((p: any) => ({ secret: p.secret, amount: p.amount, id: p.id, C: p.C })),
                        changeOutputs: changeOutputsSerialized
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
                <Text color="$gray10">Processing your transaction...</Text>
            </YStack>
        );
    }

    // Render error state
    if (step === 'error') {
        return (
            <YStack flex={1} justify="center" items="center" gap="$4" bg="$background" p="$6">
                <Text fontSize={18} fontWeight="bold" color="$red10">Transaction Failed</Text>
                <Text text="center" color="$gray10">{errorMsg}</Text>
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
                    <Text text="center" color="$gray10" maxW={300}>
                        {amountSats} satoshis are on their way to the target Bitcoin address.
                    </Text>
                </YStack>
                <Button theme="accent" size="$5" rounded="$5" width="100%" onPress={() => router.back()}>
                    Done
                </Button>
            </YStack>
        );
    }

    // Render confirmation state
    if (step === 'confirm' && meltQuote) {
        const selectedOption = meltQuote.fee_options?.find((o: any) => o.fee_index === selectedFeeIndex) || meltQuote.fee_options?.[0];
        const selectedFeeReserve = selectedOption ? selectedOption.fee_reserve : (meltQuote.fee_reserve ?? 0);
        const total = meltQuote.amount + selectedFeeReserve;
        const shortMintUrl = activeMintUrl?.replace(/^https?:\/\//, '');

        return (
            <YStack flex={1} bg="$background" justify="space-between" p="$4">
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 } as any}>
                    <YStack gap="$5" pt="$3">
                        {/* Header Amount */}
                        <YStack items="center" gap="$1" py="$3">
                            <H1 fontSize={40} fontWeight="800" color="$color">Pay {meltQuote.amount} sats</H1>
                            <Text fontSize="$3" color="$gray11" fontWeight="600">On-Chain Bitcoin Payout</Text>
                        </YStack>

                        {/* Fee Option Selection Selector */}
                        {meltQuote.fee_options && meltQuote.fee_options.length > 0 && (
                            <YStack gap="$2">
                                <Text fontSize="$3" color="$gray11" fontWeight="600" px="$1">Choose confirmation speed</Text>
                                <YStack gap="$2">
                                    {meltQuote.fee_options.map((option: any) => {
                                        const isSelected = option.fee_index === selectedFeeIndex;
                                        return (
                                            <XStack
                                                key={option.fee_index}
                                                borderWidth={2}
                                                borderColor={isSelected ? "$accent10" : "$gray5"}
                                                p="$3"
                                                rounded="$4"
                                                justify="space-between"
                                                items="center"
                                                onPress={() => setSelectedFeeIndex(option.fee_index)}
                                                pressStyle={{ opacity: 0.85 }}
                                            >
                                                <YStack>
                                                    <Text fontWeight="700" fontSize="$4" color="$color">
                                                        {option.estimated_blocks} {option.estimated_blocks === 1 ? 'block' : 'blocks'}
                                                    </Text>
                                                    <Text fontSize="$2" color="$gray10">Estimated confirmation</Text>
                                                </YStack>
                                                <XStack gap="$3" items="center">
                                                    <YStack items="flex-end">
                                                        <Text fontWeight="700" fontSize="$4" color="$color">
                                                            {option.fee_reserve} sats
                                                        </Text>
                                                        <Text fontSize="$2" color="$gray10">fee reserve</Text>
                                                    </YStack>
                                                    <View
                                                        width={22}
                                                        height={22}
                                                        rounded="$11"
                                                        borderWidth={2}
                                                        borderColor={isSelected ? "$accent10" : "$gray8"}
                                                        items="center"
                                                        justify="center"
                                                    >
                                                        {isSelected && (
                                                            <View width={10} height={10} rounded="$5" bg="$accent10" />
                                                        )}
                                                    </View>
                                                </XStack>
                                            </XStack>
                                        );
                                    })}
                                </YStack>
                            </YStack>
                        )}

                        {/* Details List table */}
                        <YStack gap="$4" bg="$gray3" p="$4" rounded="$5" mt="$2">
                            {/* Amount Row */}
                            <XStack justify="space-between" items="center">
                                <XStack gap="$2" items="center">
                                    <Zap size={18} color="$yellow10" />
                                    <Text fontWeight="600" color="$gray11">Amount</Text>
                                </XStack>
                                <Text fontWeight="700" color="$color">{meltQuote.amount} sats</Text>
                            </XStack>

                            {/* Fee Reserve Row */}
                            <XStack justify="space-between" items="center">
                                <XStack gap="$2" items="center">
                                    <ArrowUpDown size={18} color="$purple10" />
                                    <Text fontWeight="600" color="$gray11">Fee Reserve</Text>
                                </XStack>
                                <Text fontWeight="700" color="$color">{selectedFeeReserve} sats</Text>
                            </XStack>

                            {/* Unit Row */}
                            <XStack justify="space-between" items="center">
                                <XStack gap="$2" items="center">
                                    <Coins size={18} color="$green10" />
                                    <Text fontWeight="600" color="$gray11">Unit</Text>
                                </XStack>
                                <Text fontWeight="700" color="$color">SAT</Text>
                            </XStack>

                            {/* State Row */}
                            <XStack justify="space-between" items="center">
                                <XStack gap="$2" items="center">
                                    <Info size={18} color="$gray10" />
                                    <Text fontWeight="600" color="$gray11">State</Text>
                                </XStack>
                                <Text fontWeight="700" color="$red10">Unpaid</Text>
                            </XStack>

                            {/* Mint Row */}
                            <XStack justify="space-between" items="center">
                                <XStack gap="$2" items="center">
                                    <Landmark size={18} color="$orange10" />
                                    <Text fontWeight="600" color="$gray11">Mint</Text>
                                </XStack>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxWidth: "60%" }}>
                                    <Text fontWeight="700" color="$color">{shortMintUrl}</Text>
                                </ScrollView>
                            </XStack>

                            <Separator my="$1" />

                            {/* Total Cost Row */}
                            <XStack justify="space-between" items="center">
                                <Text fontWeight="bold" fontSize="$5" color="$color">Total Cost</Text>
                                <Text fontWeight="bold" fontSize={20} color="$accent10">{total} sats</Text>
                            </XStack>
                        </YStack>
                    </YStack>
                </ScrollView>

                {/* Confirm and Pay Actions */}
                <YStack gap="$2" pt="$3" pb="$4">
                    <Button theme="accent" size="$5" rounded="$5" fontWeight="bold" onPress={handlePayMelt}>
                        PAY
                    </Button>
                    <Button size="$5" bg="$gray4" rounded="$5" fontWeight="bold" onPress={() => setStep('input')}>
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
                                onChangeText={handleAddressChange}
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
