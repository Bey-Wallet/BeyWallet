import React, { useState, useMemo, useRef } from 'react';
import { YStack, XStack, Text, ScrollView, Button, View, Separator, Circle, ListItem, Avatar, Square, Input } from 'tamagui';
import { ChevronLeft, ChevronDown, RefreshCw, Check, Building2, Globe, ShieldCheck, ShieldAlert, Plus, Trash2, Copy, ExternalLink, ArrowRight, ChevronRight, AlertCircle } from '@tamagui/lucide-icons';
import { useRouter, Stack } from 'expo-router';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import QRCode from "react-native-qrcode-svg";
import { useWalletStore } from '~/store/walletStore';
import { RollingNumber } from '~/components/UI/RollingNumber';
import AppBottomSheet, { AppBottomSheetRef } from '~/components/UI/AppBottomSheet';
import { mintService } from '~/services/mintService';
import { useSettingsStore } from '~/store/settingsStore';
import { currencyService, CurrencyCode } from '~/services/currencyService';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { bitcoinService } from '~/services/bitcoinService';

export default function MintsModal() {
    const router = useRouter();
    const { mints, balances, refreshBalance, isInitializing, activeMintUrl, setActiveMint, untrustMint, removeMint, refreshMintList, trustMint } = useWalletStore();
    const insets = useSafeAreaInsets();
    const { secondaryCurrency } = useSettingsStore();

    const { data: btcData } = useQuery({
        queryKey: ['bitcoinPrice', secondaryCurrency],
        queryFn: () => bitcoinService.fetchPrice(secondaryCurrency),
        staleTime: 30000,
    });

    const [selectedMintForSheet, setSelectedMintForSheet] = useState<any>(null);
    const [amount, setAmount] = useState("1000");
    const [quote, setQuote] = useState<{ pr: string, quoteId: string } | null>(null);
    const [isRequesting, setIsRequesting] = useState(false);
    const [isChecking, setIsChecking] = useState(false);

    const sheetRef = useRef<AppBottomSheetRef>(null);
    const deleteOptionsSheetRef = useRef<AppBottomSheetRef>(null);

    const totalBalance = useMemo(() => {
        return Object.values(balances).reduce((a, b) => a + b, 0);
    }, [balances]);

    const fiatBalance = useMemo(() => {
        if (!btcData?.price) return 0;
        return currencyService.convertSatsToCurrency(totalBalance, btcData.price);
    }, [totalBalance, btcData?.price]);

    const handleRefresh = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        await refreshBalance();
    };

    const handleMintPress = (mint: any) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSelectedMintForSheet(mint);
        setQuote(null);
        sheetRef.current?.present();
    };

    const handleRequestMint = async () => {
        if (!selectedMintForSheet || !amount) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setIsRequesting(true);
        try {
            const res = await mintService.requestMintQuote(selectedMintForSheet.mintUrl, parseInt(amount));
            setQuote({ pr: res.request, quoteId: res.quote });
        } catch (err) {
            console.error(err);
        } finally {
            setIsRequesting(false);
        }
    };

    const handleCheckPayment = async () => {
        if (!quote) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setIsChecking(true);
        try {
            await mintService.checkAndMint(quote.quoteId);
            refreshBalance();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            sheetRef.current?.dismiss();
        } catch (err) {
            console.error(err);
        } finally {
            setIsChecking(false);
        }
    };

    const copyToClipboard = async () => {
        if (quote) {
            await Clipboard.setStringAsync(quote.pr);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
    };

    const [isProcessing, setIsProcessing] = useState(false);

    const handleUntrustOnly = async () => {
        if (!selectedMintForSheet || isProcessing) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setIsProcessing(true);
        try {
            await untrustMint(selectedMintForSheet.mintUrl);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            deleteOptionsSheetRef.current?.dismiss();
            sheetRef.current?.dismiss();
            refreshBalance();
        } catch (err) {
            console.error('Untrust failed:', err);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleUntrustAndDelete = async () => {
        if (!selectedMintForSheet || isProcessing) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        setIsProcessing(true);
        try {
            await removeMint(selectedMintForSheet.mintUrl);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            deleteOptionsSheetRef.current?.dismiss();
            sheetRef.current?.dismiss();
            refreshBalance();
        } catch (err) {
            console.error('Remove failed:', err);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleTrustAgain = async () => {
        if (!selectedMintForSheet || isProcessing) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setIsProcessing(true);
        try {
            await trustMint(selectedMintForSheet.mintUrl);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            sheetRef.current?.dismiss();
            refreshBalance();
        } catch (err) {
            console.error('Trust failed:', err);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <YStack flex={1} bg="$background">
            <Stack.Screen
                options={{
                    headerTitle: 'Mints',
                    headerLeft: () => (
                        <Button
                            circular
                            chromeless
                            icon={<ChevronLeft size={24} />}
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                router.back();
                            }}
                        />
                    ),
                    headerRight: () => (
                        <Button
                            circular
                            chromeless
                            icon={<RefreshCw size={20} className={isInitializing ? 'spin' : ''} />}
                            onPress={handleRefresh}
                        />
                    )
                }}
            />

            <ScrollView
                flex={1}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
            >
                <YStack px="$4" pt="$4" gap="$2">
                    <XStack>
                        <Button
                            size="$2.5"
                            theme="gray"
                            bg="$color5"
                            px="$3"
                            rounded="$12"
                            icon={<Plus size={14} />}
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                router.push('/(modals)/add-mint');
                            }}
                            pressStyle={{ scale: 0.97, opacity: 0.9 }}
                        >
                            <Text fontWeight="700" fontSize="$3">Add New Mint</Text>
                        </Button>
                    </XStack>

                    <YStack py="$2" gap="$2">

                        <XStack items="baseline" gap="$0" py="$2">

                            <RollingNumber
                                fontSize={30}
                                prefix='₿'
                                fontWeight="900"
                                color="$accent4"
                                showDecimals={false}
                                letterSpacing={-2}

                            >
                                {totalBalance}
                            </RollingNumber>
                        </XStack>
                        <RollingNumber
                            value={fiatBalance}
                            fontSize={16}
                            fontWeight="900"
                            color="$accent8"
                            decimalOpacity={0.4}
                            showDecimals={false}
                        >
                            {currencyService.formatValue(fiatBalance, secondaryCurrency as CurrencyCode)}
                        </RollingNumber>
                    </YStack>

                    <YStack pt="$4">
                        <XStack justify="space-between" themeInverse pb="$4" items="center">
                            <Text fontSize="$5" color="$color4" fontWeight="800">Connected Mints</Text>
                            <View bg="$gray2" px="$2" py="$1" rounded="$3">
                                <Text fontSize="$3" color="$color" fontWeight="800">{mints.length}</Text>
                            </View>
                        </XStack>

                        <YStack rounded="$5" theme="gray" bg="$gray2"
                            overflow="hidden">
                            {mints.length === 0 ? (
                                <YStack py="$10" items="center" justify="center" gap="$3" opacity={0.5} p="$3">
                                    <View p="$4" bg="$gray2" rounded="$10">
                                        <Globe size={32} color="$gray9" />
                                    </View>
                                    <YStack items="center">
                                        <Text fontWeight="700">No mints connected</Text>
                                        <Text fontSize="$3" color="$gray9" text="center" mt="$1">
                                            Trusted mints will appear here.
                                        </Text>
                                    </YStack>
                                </YStack>
                            ) : (
                                mints.map((mint, index) => {
                                    const balance = balances[mint.mintUrl] || 0;
                                    const isActive = mint.mintUrl === activeMintUrl;

                                    return (
                                        <React.Fragment key={mint.mintUrl}>
                                            <YStack
                                                onPress={() => handleMintPress(mint)}
                                                pressStyle={{ opacity: 0.7, scale: 0.98 }}
                                                py="$2"
                                                px="$2"
                                                pr="$3"

                                            >
                                                <XStack justify="space-between" items="center">
                                                    <XStack gap="$3" items="center">
                                                        <Avatar rounded="$4" size="$3" borderWidth={1} borderColor={isActive ? "$blue10" : "$borderColor"}>
                                                            <Avatar.Image src={mint.icon} />
                                                            <Avatar.Fallback backgroundColor="$gray2" alignItems="center" justifyContent="center">
                                                                <Building2 size={24} color="$gray10" />
                                                            </Avatar.Fallback>
                                                        </Avatar>
                                                        <YStack>
                                                            <XStack gap="$2" items="center" >
                                                                <Text fontWeight="800" fontSize="$3" numberOfLines={1} ellipsizeMode="tail" maxW={150} color={isActive ? "$blue10" : "$color"} >
                                                                    {mint.nickname || mint.name || 'Unnamed Mint'}
                                                                </Text>
                                                            </XStack>
                                                        </YStack>
                                                    </XStack>

                                                    <YStack items="flex-end">
                                                        <Text fontWeight="900" fontSize="$4" color={isActive ? "$blue10" : "$color"}>
                                                            ₿{balance.toLocaleString()}
                                                        </Text>
                                                    </YStack>
                                                </XStack>
                                            </YStack>
                                            {index < mints.length - 1 && <Separator borderColor="$color8" opacity={0.5} />}
                                        </React.Fragment>
                                    );
                                })
                            )}
                        </YStack>
                    </YStack>
                </YStack>
            </ScrollView>

            <AppBottomSheet ref={sheetRef} snapPoints={["85%"]}>
                <BottomSheetScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
                >
                    <YStack p="$4" gap="$5">
                        {/* Mint Profile Header */}
                        <XStack gap="$4" items="center">
                            <Avatar rounded="$6" size="$6" borderWidth={2} borderColor="$borderColor">
                                <Avatar.Image src={selectedMintForSheet?.icon} />
                                <Avatar.Fallback bg="$gray2" items="center" justify="center">
                                    <Building2 size={48} color="$gray10" />
                                </Avatar.Fallback>
                            </Avatar>
                            <YStack flex={1}>
                                <XStack justify="space-between" items="flex-start">
                                    <YStack flex={1}>
                                        <Text fontSize="$7" fontWeight="900">{selectedMintForSheet?.nickname || selectedMintForSheet?.name}</Text>
                                        <Text fontSize="$3" color="$gray10">{selectedMintForSheet?.mintUrl}</Text>
                                    </YStack>
                                    <Button
                                        circular
                                        size="$3"
                                        bg="$red2"
                                        onPress={() => deleteOptionsSheetRef.current?.present()}
                                        disabled={selectedMintForSheet ? (balances[selectedMintForSheet.mintUrl] || 0) > 0 : true}
                                        opacity={selectedMintForSheet && (balances[selectedMintForSheet.mintUrl] || 0) > 0 ? 0.3 : 1}
                                        icon={<Trash2 size={18} color="$red10" />}
                                    />
                                </XStack>
                                <XStack mt="$2" gap="$2" items="center">
                                    {selectedMintForSheet?.trusted ? (
                                        <XStack px="$2" py="$1" bg="$green2" rounded="$2" items="center" gap="$1">
                                            <ShieldCheck size={14} color="$green10" />
                                            <Text fontSize="$1" fontWeight="800" color="$green10">TRUSTED</Text>
                                        </XStack>
                                    ) : (
                                        <>
                                            <XStack px="$2" py="$1" bg="$orange2" rounded="$2" items="center" gap="$1">
                                                <ShieldAlert size={14} color="$orange10" />
                                                <Text fontSize="$1" fontWeight="800" color="$orange10">UNTRUSTED</Text>
                                            </XStack>
                                            <Button
                                                size="$2"
                                                theme="green"
                                                px="$2.5"
                                                rounded="$3"
                                                onPress={handleTrustAgain}
                                                disabled={isProcessing}
                                                icon={<ShieldCheck size={12} color="white" />}
                                            >
                                                <Text fontSize="$1" fontWeight="800" color="white">TRUST AGAIN</Text>
                                            </Button>
                                        </>
                                    )}
                                </XStack>
                            </YStack>
                        </XStack>

                        <Separator />

                        {/* Balance Section */}
                        <YStack gap="$2" items="center" bg="$gray2" p="$4" rounded="$6">
                            <Text fontSize="$4" color="$gray10" fontWeight="700">Spendable Balance</Text>
                            <XStack items="baseline" gap="$0">

                                <RollingNumber
                                    letterSpacing={-1}
                                    prefix='₿'
                                    fontSize={32}
                                    fontWeight="900"
                                    color="$accent4"
                                    showDecimals={false}
                                >
                                    {selectedMintForSheet ? (balances[selectedMintForSheet.mintUrl] || 0) : 0}
                                </RollingNumber>
                            </XStack>
                        </YStack>

                        {/* Deposit Section */}
                        <YStack gap="$4">
                            <Text fontSize="$6" fontWeight="800">Direct Deposit</Text>
                            {!quote ? (
                                <YStack gap="$3">
                                    <Text color="$gray10" fontSize="$3">Enter amount to generate a Lightning invoice for this mint.</Text>
                                    <Input
                                        size="$5"
                                        placeholder="Amount in SATS"
                                        value={amount}
                                        onChangeText={setAmount}
                                        keyboardType="numeric"
                                        fontWeight="700"
                                        text="center"
                                        fontSize="$6"
                                    />
                                    <Button
                                        theme="accent"
                                        size="$5"
                                        fontWeight="800"
                                        disabled={isRequesting || !amount}
                                        onPress={handleRequestMint}
                                        icon={isRequesting ? <RefreshCw className="spin" size={20} /> : <Plus size={20} />}
                                    >
                                        {isRequesting ? "Requesting Invoice..." : "Generate Invoice"}
                                    </Button>
                                </YStack>
                            ) : (
                                <YStack items="center" gap="$4">
                                    <View bg="white" p="$4" borderWidth={1} borderColor="$gray4" rounded="$5" >
                                        <QRCode value={quote.pr} size={320} />
                                    </View>

                                    <XStack gap="$2" width="100%">
                                        <Button flex={1} variant="outlined" size="$4" onPress={copyToClipboard} icon={<Copy size={16} />}>
                                            Copy
                                        </Button>
                                        <Button flex={1} variant="outlined" size="$4" onPress={() => setQuote(null)} icon={<RefreshCw size={16} />}>
                                            Retry
                                        </Button>
                                    </XStack>

                                    <Button
                                        theme="green"
                                        size="$5"
                                        width="100%"
                                        disabled={isChecking}
                                        onPress={handleCheckPayment}
                                        fontWeight="800"
                                    >
                                        {isChecking ? "Checking..." : "I've Paid"}
                                    </Button>

                                    <Text fontSize="$2" color="$gray10" text="center">
                                        Tokens will be added to your balance automatically once the invoice is paid.
                                    </Text>
                                </YStack>
                            )}
                        </YStack>

                        <YStack gap="$2" pb="$10">
                            <Button
                                theme="gray"
                                size="$4"
                                chromeless
                                onPress={() => {
                                    sheetRef.current?.dismiss();
                                    router.push({
                                        pathname: '/(modals)/mint-profile',
                                        params: { mintUrl: selectedMintForSheet.mintUrl }
                                    });
                                }}
                                iconAfter={<ChevronRight size={18} />}
                            >
                                View Detailed Profile
                            </Button>
                        </YStack>

                        {/* Danger Zone */}
                        {(selectedMintForSheet && (balances[selectedMintForSheet.mintUrl] || 0) === 0) && (
                            <YStack gap="$3" borderTopWidth={1} borderColor="$gray4" pt="$4" pb="$10">
                                <Text fontSize="$4" fontWeight="800" color="$red10">Danger Zone</Text>
                                <Button
                                    bg="$red2"
                                    color="$red10"
                                    size="$5"
                                    fontWeight="800"
                                    onPress={() => deleteOptionsSheetRef.current?.present()}
                                    icon={<Trash2 size={20} color="$red10" />}
                                >
                                    Untrust & Remove Mint
                                </Button>
                                <Text fontSize="$2" color="$gray9" text="center">
                                    Only mints with zero balance can be removed.
                                </Text>
                            </YStack>
                        )}
                    </YStack>
                </BottomSheetScrollView>
            </AppBottomSheet>

            <AppBottomSheet ref={deleteOptionsSheetRef}>
                <YStack p="$4" gap="$5">
                    <YStack gap="$2" items="center">
                        <View p="$4" bg="$red2" rounded="$10">
                            <Trash2 size={32} color="$red10" />
                        </View>
                        <Text fontSize="$6" fontWeight="800">Manage Mint Trust</Text>
                        <Text color="$gray10" text="center" px="$4">
                            How do you want to handle this mint? Untrusting will keep the history but hide the mint from new operations.
                        </Text>
                    </YStack>

                    <YStack gap="$3">
                        <Button
                            theme="orange"
                            variant="outlined"
                            size="$5"
                            fontWeight="800"
                            onPress={handleUntrustOnly}
                            icon={<ShieldAlert size={20} color="$orange10" />}
                            disabled={isProcessing}
                        >
                            Untrust Only
                        </Button>
                        <Button
                            theme="red"
                            size="$5"
                            fontWeight="800"
                            onPress={handleUntrustAndDelete}
                            icon={<Trash2 size={20} color="white" />}
                            disabled={isProcessing || (selectedMintForSheet && (balances[selectedMintForSheet.mintUrl] || 0) > 0)}
                        >
                            Untrust and Delete from Device
                        </Button>
                        <Button
                            chromeless
                            size="$5"
                            fontWeight="800"
                            onPress={() => deleteOptionsSheetRef.current?.dismiss()}
                            disabled={isProcessing}
                        >
                            Cancel
                        </Button>
                    </YStack>
                </YStack>
            </AppBottomSheet>

        </YStack>
    );
}
