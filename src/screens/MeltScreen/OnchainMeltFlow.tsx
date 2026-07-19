import React, { useState, useEffect, useMemo, useRef } from "react";
import { YStack, XStack, Text, H1, Input, Button, Separator, ScrollView, View, Spinner, Avatar, YGroup } from "tamagui";
import { Clipboard as ClipboardIcon, ScanLine, AlertCircle, Landmark, Check, Zap, ArrowUpDown, Coins, Info, ShieldCheck, CheckCircle2, XCircle, Bitcoin, ChevronDown, Sprout } from "@tamagui/lucide-icons";
import * as Clipboard from "expo-clipboard";
import { networkService } from "~/services/networkService";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useWalletStore } from "~/store/walletStore";
import { quotesService, initService } from "~/services/core";
import { useToastController } from "@tamagui/toast";
import { onchainNetwork } from "~/utils/onchain";
import { ListTable, ListTableRow } from "~/components/UI/ListTable";
import { useQuery } from "@tanstack/react-query";
import { bitcoinService } from "~/services/bitcoinService";
import { currencyService, CurrencyCode, SUPPORTED_CURRENCIES } from "~/services/currencyService";
import { useSettingsStore } from "~/store/settingsStore";
import { NumericKeypad } from "~/components/UI/NumericKeypad";
import { MintSelectorSheet } from "~/components/HomeMintSelector";
import { AppBottomSheetRef } from "~/components/UI/AppBottomSheet";
import { DestinationInputRow } from "~/components/UI/DestinationInputRow";
import { MintBalanceRow } from "~/components/UI/MintBalanceRow";
import { BouncyAmount } from "~/components/UI/BouncyAmount";

export function OnchainMeltFlow() {
    const router = useRouter();
    const toast = useToastController();

    const balance = useWalletStore(s => s.balance);
    const activeMintUrl = useWalletStore(s => s.activeMintUrl);
    const refreshBalance = useWalletStore(s => s.refreshBalance);
    const scannerResult = useWalletStore(s => s.scannerResult);
    const setScannerResult = useWalletStore(s => s.setScannerResult);
    const { mints, refreshMintList, isInitializing, isRefreshing } = useWalletStore();
    const { primaryCurrency, secondaryCurrency, showBitcoinSymbol } = useSettingsStore();

    const sheetRef = useRef<AppBottomSheetRef>(null);

    const [step, setStep] = useState<'input' | 'confirm' | 'paying' | 'success' | 'error'>('input');
    const [address, setAddress] = useState('');
    const [amount, setAmount] = useState('0');
    const [inputMode, setInputMode] = useState<'SATS' | 'FIAT'>(primaryCurrency);
    const [localInputValue, setLocalInputValue] = useState('0');
    const [isPasting, setIsPasting] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [supportsOnchain, setSupportsOnchain] = useState<boolean | null>(null);
    const [isCheckingSupport, setIsCheckingSupport] = useState(false);

    // Quote details
    const [meltQuote, setMeltQuote] = useState<any>(null);
    const [selectedFeeIndex, setSelectedFeeIndex] = useState<number>(0);

    const isLoadingMint = isInitializing || isRefreshing;

    const { data: btcData } = useQuery({
        queryKey: ['bitcoinPrice', secondaryCurrency],
        queryFn: () => bitcoinService.fetchPrice(secondaryCurrency),
        staleTime: 30000,
    });

    const currencySymbol = useMemo(() => {
        return SUPPORTED_CURRENCIES.find(c => c.code === secondaryCurrency)?.symbol || '$';
    }, [secondaryCurrency]);

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

    // Check if the selected mint supports NUT-30 onchain withdrawals
    useEffect(() => {
        if (!activeMintUrl) return;
        setIsCheckingSupport(true);
        setSupportsOnchain(null);
        
        fetch(`${activeMintUrl.replace(/\/$/, '')}/v1/info`)
            .then(res => res.json())
            .then(info => {
                const nuts = info.nuts || {};
                
                // 1. Check NUT-30 explicitly
                const nut30 = nuts['30'] || nuts[30];
                let supported = !!(nut30 && (nut30.supported || (Array.isArray(nut30.methods) && nut30.methods.length > 0)));
                
                // 2. Fallback to check NUT-04/NUT-05 method lists (typical of CDK mints like testnut)
                if (!supported) {
                    const nut4 = nuts['4'] || nuts[4];
                    const nut5 = nuts['5'] || nuts[5];
                    const hasOnchainMint = Array.isArray(nut4?.methods) && nut4.methods.some((m: any) => m.method === 'onchain');
                    const hasOnchainMelt = Array.isArray(nut5?.methods) && nut5.methods.some((m: any) => m.method === 'onchain');
                    supported = hasOnchainMint && hasOnchainMelt;
                }
                
                setSupportsOnchain(supported);
            })
            .catch(err => {
                console.warn('[OnchainMeltFlow] Mint info check failed:', err);
                // Default to true to be non-blocking on minor connections
                setSupportsOnchain(true);
            })
            .finally(() => {
                setIsCheckingSupport(false);
            });
    }, [activeMintUrl]);

    // Value derived for the non-active mode
    const conversionValue = useMemo(() => {
        if (!btcData?.price) return '0';
        if (inputMode === 'SATS') {
            const sats = Number(amount) || 0;
            return currencyService.formatValue(
                currencyService.convertSatsToCurrency(sats, btcData.price),
                secondaryCurrency as CurrencyCode
            );
        } else {
            const sats = Number(amount) || 0;
            return currencyService.formatSats(sats);
        }
    }, [amount, btcData?.price, inputMode, secondaryCurrency]);

    useEffect(() => {
        if (inputMode === 'SATS') {
            setLocalInputValue(amount);
        }
    }, [amount, inputMode]);

    const onKeypadChange = (rawVal: string) => {
        let val = rawVal;
        if (val === '.') {
            val = '0.';
        }

        if (inputMode === 'SATS') {
            val = val.replace(/\./g, '');
        } else {
            const parts = val.split('.');
            if (parts.length > 2) {
                val = parts[0] + '.' + parts.slice(1).join('');
            }
            if (parts.length === 2 && parts[1].length > 2) {
                val = parts[0] + '.' + parts[1].slice(0, 2);
            }
        }

        if (val.length > 1 && val.startsWith('0') && !val.startsWith('0.')) {
            val = val.replace(/^0+/, '');
            if (val === '') val = '0';
        }

        const maxLen = 11;
        if (val.length > maxLen) {
            val = val.slice(0, maxLen);
        }

        setLocalInputValue(val);

        if (inputMode === 'SATS') {
            setAmount(val);
        } else {
            if (btcData?.price) {
                const sats = currencyService.convertCurrencyToSats(Number(val) || 0, btcData.price);
                setAmount(String(sats));
            }
        }
    };

    const toggleMode = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        if (inputMode === 'SATS') {
            if (btcData?.price) {
                const sats = Number(amount) || 0;
                const fiat = currencyService.convertSatsToCurrency(sats, btcData.price);
                setLocalInputValue(fiat > 0 ? fiat.toFixed(2) : '0');
            }
            setInputMode('FIAT');
        } else {
            setLocalInputValue(amount);
            setInputMode('SATS');
        }
    };

    const handlePreset = (presetSats: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setAmount(presetSats);
        if (inputMode === 'SATS') {
            setLocalInputValue(presetSats);
        } else if (btcData?.price) {
            const fiat = currencyService.convertSatsToCurrency(Number(presetSats), btcData.price);
            setLocalInputValue(fiat > 0 ? fiat.toFixed(2) : '0');
        }
    };

    const handleMax = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const balString = String(balance);
        setAmount(balString);
        if (inputMode === 'SATS') {
            setLocalInputValue(balString);
        } else if (btcData?.price) {
            const fiat = currencyService.convertSatsToCurrency(balance, btcData.price);
            setLocalInputValue(fiat > 0 ? fiat.toFixed(2) : '0');
        }
    };

    const formattedDisplayValue = useMemo(() => {
        if (!localInputValue || localInputValue === '0') return '0';
        if (inputMode === 'SATS') {
            const num = Number(localInputValue);
            if (!isNaN(num)) {
                return num.toLocaleString('en-US');
            }
        } else {
            const parts = localInputValue.split('.');
            const integerPart = Number(parts[0]);
            if (!isNaN(integerPart)) {
                const formattedInt = integerPart.toLocaleString('en-US');
                return parts.length > 1 ? `${formattedInt}.${parts[1]}` : formattedInt;
            }
        }
        return localInputValue;
    }, [localInputValue, inputMode]);

    // Dynamic font size based on string length to scale seamlessly
    const dynamicFontSize = useMemo(() => {
        const len = formattedDisplayValue.length;
        if (len <= 6) return 44;
        if (len <= 8) return 38;
        if (len <= 10) return 32;
        if (len <= 13) return 26;
        return 20;
    }, [formattedDisplayValue]);

    // Watch for scanned QR codes
    useEffect(() => {
        if (scannerResult) {
            let cleaned = scannerResult.trim();
            if (cleaned.toLowerCase().startsWith("bitcoin:")) {
                const parsed = cleaned.replace(/^bitcoin:/i, "");
                const addressPart = parsed.split("?")[0];
                setAddress(addressPart);
                
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
        const regex = /^(1|3|bc1|tb1|bcrt1|m|n|2)[a-zA-Z0-9]{25,95}$/i;
        return regex.test(cleaned);
    }, [address]);

    const amountSats = parseInt(amount, 10) || 0;
    const isOverBalance = amountSats > balance;
    const canContinue = isValidAddress && amountSats > 0 && !isOverBalance && supportsOnchain !== false;

    // Handle quote creation
    const handleGetQuote = async () => {
        if (!activeMintUrl || !canContinue) return;

        const offline = await networkService.isOffline();
        if (offline) {
            setErrorMsg('You are offline. Please check your internet connection.');
            return;
        }

        setErrorMsg(null);
        setStep('paying');

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

        const offline = await networkService.isOffline();
        if (offline) {
            setErrorMsg('You are offline. Please check your internet connection.');
            return;
        }

        setErrorMsg(null);
        setStep('paying');

        try {
            const response = await quotesService.payOnchainMeltQuote(activeMintUrl, meltQuote, selectedFeeIndex);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            
            // Log outgoing transaction in history
            try {
                const repo = initService.getRepo();
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
                <Text color="$gray10" fontSize="$4" fontWeight="600">Processing your transaction...</Text>
            </YStack>
        );
    }

    // Render error state
    if (step === 'error') {
        return (
            <YStack flex={1} justify="space-between" bg="$background" >
                <YStack flex={1} justify="center" items="center" gap="$4" p="$4">
                    <XCircle size={80} color="$red10" />
                    <Text color="$red10" fontSize="$6" fontWeight="700" text="center">Transaction Failed</Text>
                    <Text color="$gray10" fontSize="$4" text="center" px="$4">{errorMsg || 'An error occurred during payment.'}</Text>
                </YStack>
                <Button theme="accent" size="$5" height={55} rounded="$4" fontWeight="800" onPress={() => setStep('input')}>
                    Try Again
                </Button>
            </YStack>
        );
    }

    // Render success state
    if (step === 'success') {
        const fiatValue = btcData?.price
            ? currencyService.formatValue(
                currencyService.convertSatsToCurrency(amountSats, btcData.price),
                secondaryCurrency as CurrencyCode
            )
            : '...';

        return (
            <YStack flex={1} justify="space-between" bg="$background">
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, paddingBottom: 120 } as any} >
                    <YStack gap="$4" width="100%">
                        {/* Oswald Typography Amount Display */}
                        <YStack gap="$3" py="$6" items="center" justify="center">
                            <Text fontSize={52} fontFamily="$oswald" fontWeight="700" color="$orange10" lineHeight={54}>
                                -{currencyService.formatSats(amountSats)}
                            </Text>
                            <Text color="$accent5" fontWeight="600" fontSize={16}>
                                ≈ {fiatValue} {secondaryCurrency}
                            </Text>
                        </YStack>

                        {/* Centered orange/pending badge */}
                        <XStack
                            self="center"
                            items="center"
                            gap="$2"
                            bg="$orange9"
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
                                Payment Broadcasted
                            </Text>
                        </XStack>

                        {/* Description Text */}
                        <YStack px="$4" py="$2">
                            <Text color="$gray10" fontSize="$4" text="center" lineHeight={20}>
                                Transaction successfully broadcast to the network.
                            </Text>
                        </YStack>

                        {/* Details Table */}
                        <YStack bg="$gray2" rounded="$5" overflow="hidden" mb="$6" separator={<Separator borderColor="$borderColor" opacity={0.4} />}>
                            <XStack justify="space-between" items="center" py="$3" px="$4">
                                <Text fontSize="$3" color="$gray10" fontWeight="600">Status</Text>
                                <Text fontSize="$3" fontWeight="800" color="$orange10">PENDING</Text>
                            </XStack>
                            <XStack justify="space-between" items="center" py="$3" px="$4">
                                <Text fontSize="$3" color="$gray10" fontWeight="600">Destination</Text>
                                <Text fontSize="$3" fontWeight="800" color="$color">{`${address.substring(0, 10)}...${address.substring(address.length - 8)}`}</Text>
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
                <YStack py="$4" bg="$background">
                    <Button theme="accent" size="$5" height={55} rounded="$4" fontWeight="800" onPress={() => router.back()}>
                        Awesome
                    </Button>
                </YStack>
            </YStack>
        );
    }

    // Render confirmation state
    if (step === 'confirm' && meltQuote) {
        const selectedOption = meltQuote.fee_options?.find((o: any) => o.fee_index === selectedFeeIndex) || meltQuote.fee_options?.[0];
        const selectedFeeReserve = selectedOption ? selectedOption.fee_reserve : (meltQuote.fee_reserve ?? 0);
        const total = meltQuote.amount + selectedFeeReserve;
        const shortAddress = `${address.substring(0, 10)}...${address.substring(address.length - 8)}`;

        const fiatAmount = btcData?.price
            ? currencyService.convertSatsToCurrency(meltQuote.amount, btcData.price)
            : 0;
        const formattedFiat = btcData?.price
            ? currencyService.formatValue(fiatAmount, secondaryCurrency as CurrencyCode)
            : '0.00';

        const totalFiat = btcData?.price
            ? currencyService.convertSatsToCurrency(total, btcData.price)
            : 0;
        const formattedTotalFiat = btcData?.price
            ? currencyService.formatValue(totalFiat, secondaryCurrency as CurrencyCode)
            : '0.00';

        const dynamicFontSize = meltQuote.amount.toString().length > 6 ? 32 : 40;

        return (
            <YStack flex={1} bg="$background">
                <ScrollView contentContainerStyle={{ paddingBottom: 180 } as any} showsVerticalScrollIndicator={false}>
                    <YStack gap="$4" pt="$2">
                        {/* Middle Amount Display */}
                        <YStack gap="$3" py="$6" items="center" justify="center">
                            <Text fontSize={52} fontFamily="$oswald" fontWeight="700" color="$accent3" lineHeight={54}>
                                -{currencyService.formatSats(meltQuote.amount)}
                            </Text>
                            <Text color="$accent5" fontWeight="600" fontSize={16}>
                                ≈ {formattedFiat} {secondaryCurrency}
                            </Text>
                        </YStack>

                        {/* Send Method Badge */}
                        <XStack
                            self="center"
                            items="center"
                            gap="$2"
                            bg="$orange9"
                            px="$4"
                            py="$3"
                            rounded="$10"
                        >
                            <Landmark size={16} color="white" />
                            <Text
                                fontSize="$3"
                                fontWeight="700"
                                color="white"
                            >
                                On-Chain Bitcoin Send
                            </Text>
                        </XStack>

                        {/* Fee Option Selection Selector */}
                        {meltQuote.fee_options && meltQuote.fee_options.length > 0 && (
                            <YStack gap="$2" >
                                <Text fontSize="$3" color="$gray10" fontWeight="700" px="$1">Choose confirmation speed</Text>
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

                        {/* Details List */}
                        <YStack bg="$gray2" rounded="$5" overflow="hidden" mb="$3" >
                            <View p="$3" px="$4">
                                <Text fontSize="$3" fontWeight="700" color="$gray12">Details</Text>
                            </View>
                            <Separator borderColor="$borderColor" opacity={0.3} />
                            <YGroup separator={<Separator borderColor="$borderColor" opacity={0.5} />}>
                                <DetailItem
                                    label="Mint"
                                    value={mintDisplayName}
                                    icon={
                                        <Avatar rounded="$3" size="$1.5">
                                            <Avatar.Image src={activeMint?.icon} />
                                            <Avatar.Fallback bg="$green3" items="center" justify="center">
                                                <Sprout size={12} color="$green10" />
                                            </Avatar.Fallback>
                                        </Avatar>
                                    }
                                />
                                <DetailItem
                                    label="Destination"
                                    value={shortAddress}
                                    icon={<Landmark size={16} color="$yellow10" />}
                                />
                                <DetailItem
                                    label="Network Fee"
                                    value={`${selectedFeeReserve} sats`}
                                    valueColor="$orange10"
                                    icon={<ShieldCheck size={16} color="$orange10" />}
                                />
                                <DetailItem
                                    label="Total Cost"
                                    value={`${total.toLocaleString()} sats (≈ ${formattedTotalFiat})`}
                                    valueColor="$accent10"
                                    icon={<ShieldCheck size={16} color="$accent10" />}
                                />
                            </YGroup>
                        </YStack>
                    </YStack>
                </ScrollView>

                {/* Confirm and Pay Actions */}
                <YStack position="absolute" b="$4" l="$1" r="$1" gap="$2">
                    <Button theme="accent" size="$5" height={55} rounded="$4" fontWeight="800" onPress={handlePayMelt}>
                        Confirm & Send
                    </Button>
                    <Button size="$5" bg="$gray3" color="$color" height={55} rounded="$4" fontWeight="800" onPress={() => setStep('input')}>
                        Go Back
                    </Button>
                </YStack>
            </YStack>
        );
    }

    // Render input form state (AmountStage look-alike with address field)
    return (
        <YStack flex={1} justify="space-between" bg="$background">
           
                <YStack items="center" gap="$1.5" width="100%">
                    
                    {/* Mint Selector & Balance Row */}
                     <MintBalanceRow
                    activeMint={activeMint}
                    activeMintUrl={activeMintUrl || undefined}
                    displayName={mintDisplayName}
                    balance={balance}
                    isLoadingMint={isLoadingMint}
                    isSelector={true}
                    onPress={() => {
                        refreshMintList();
                        sheetRef.current?.present();
                    }}
                    showMax={true}
                    onMaxPress={handleMax}
                    maxDisabled={balance === 0}
                />

                    {/* Card Box Container (Amount Display) */}
                    <YStack
                        width="100%"
                        bg="$gray3"
                        rounded="$6"
                        p="$4"
                        py="$5"
                        items="center"
                        gap="$3"
                    >
                        <YStack items="center" justify="center" py="$4" gap="$2" width="100%">
                            <Text color="$gray10" fontSize="$3" fontWeight="500">
                                Enter Amount
                            </Text>

                        <BouncyAmount
                            value={formattedDisplayValue}
                            fontSize={dynamicFontSize}
                            prefix={inputMode === 'SATS' ? (showBitcoinSymbol ? '₿' : '') : currencySymbol}
                            suffix={inputMode === 'SATS' && !showBitcoinSymbol ? ' SATS' : ''}
                        />

                            <Button
                                size="$3"
                                rounded="$10"
                                bg="$gray4"
                                pressStyle={{ scale: 0.96, bg: "$gray5" }}
                                onPress={toggleMode}
                                iconAfter={<ArrowUpDown size={14} color="$accent10" strokeWidth={2.5} />}
                            >
                                <Text fontSize="$3" fontWeight="600" color="$accent10">
                                    {conversionValue}
                                </Text>
                            </Button>
                        </YStack>
                    </YStack>

                    {/* Destination Address Row (moved below Amount Card) */}
                    <DestinationInputRow
                        value={address}
                        onChangeText={handleAddressChange}
                        placeholder="Enter target BTC address..."
                        onPaste={handlePaste}
                        onScan={() => {
                            router.push({
                                pathname: "/(modals)/scanner",
                                params: { returnTo: "/(modals)/melt" }
                            });
                        }}
                        defaultIcon={<Bitcoin size="$1.5" strokeWidth={2.5} color="$accent5" />}
                        isPasting={isPasting}
                        isError={address.trim().length > 0 && !isValidAddress}
                    />

                    {/* Warnings and Alerts */}
                    <YStack width="100%" gap="$2" mt="$1">
                        {isOverBalance && (
                            <XStack bg="$red3" p="$3" rounded="$4" items="center" gap="$2" width="100%">
                                <AlertCircle size={20} color="$red10" />
                                <Text flex={1} fontSize="$3" color="$red10" fontWeight="600">
                                    Insufficient balance in selected mint.
                                </Text>
                            </XStack>
                        )}

                        {supportsOnchain === false && (
                            <XStack bg="$red3" p="$3" rounded="$4" items="center" gap="$2" width="100%">
                                <AlertCircle size={20} color="$red10" />
                                <Text flex={1} fontSize="$3" color="$red10" fontWeight="600">
                                    This mint does not support on-chain cash withdrawal (NUT-30).
                                </Text>
                            </XStack>
                        )}

                        {errorMsg && (
                            <XStack bg="$red3" p="$3" rounded="$4" items="center" gap="$2" width="100%">
                                <AlertCircle size={20} color="$red10" />
                                <Text flex={1} fontSize="$3" color="$red10">{errorMsg}</Text>
                            </XStack>
                        )}
                    </YStack>

                  
                

                </YStack>
                        <NumericKeypad
                            showAmountDisplay={false}
                            value={localInputValue}
                            onValueChange={onKeypadChange}
                            onConfirm={handleGetQuote}
                            confirmLabel="Continue"
                            disabled={!canContinue}
                        />
           

            <MintSelectorSheet ref={sheetRef} />
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
