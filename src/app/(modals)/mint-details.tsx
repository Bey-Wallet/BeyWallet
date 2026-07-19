import React, { useMemo, useState, useRef } from 'react';
import { YStack, XStack, Text, ScrollView, Button, View, Separator, Avatar, ListItem, YGroup, Spinner } from 'tamagui';
import { ChevronLeft, ChevronDown, ChevronUp, Landmark, ShieldCheck, ShieldAlert, Sprout, Share2, Building2, Globe, ExternalLink, ArrowUp, ArrowDown, ArrowUpDown, AlertTriangle, Trash, Trash2, RefreshCw } from '@tamagui/lucide-icons';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import AppBottomSheet, { AppBottomSheetRef } from '~/components/UI/AppBottomSheet';
import { Share as RNShare, Platform } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWalletStore } from '~/store/walletStore';
import { useSettingsStore } from '~/store/settingsStore';
import { currencyService, CurrencyCode } from '~/services/currencyService';
import { bitcoinService } from '~/services/bitcoinService';
import { initService, historyService } from '~/services/core';
import { mintRecommendationService } from '~/services/mintRecommendationService';
import { ListTable, ListTableRow } from '~/components/UI/ListTable';
import { HistoryItem } from '~/screens/HistoryScreen/components/HistoryItem';
import { RollingNumber } from '~/components/UI/RollingNumber';
import { useToastController } from '@tamagui/toast';
import { Image } from 'tamagui';
import * as WebBrowser from 'expo-web-browser';
import { SafeFlex } from '~/components/UI/Flex';

export default function MintDetailsModal() {
    const router = useRouter();
    const toast = useToastController();
    const queryClient = useQueryClient();
    const insets = useSafeAreaInsets();
    const { mintUrl } = useLocalSearchParams<{ mintUrl: string }>();
    const { mints, balances, setActiveMint, activeMintUrl, removeMint, restoreFromSeed, isRestoring, restoringMintUrl } = useWalletStore();
    const { primaryCurrency, secondaryCurrency, showBitcoinSymbol } = useSettingsStore();
    const [isAboutExpanded, setIsAboutExpanded] = useState(false);
    const removeMintSheetRef = useRef<AppBottomSheetRef>(null);

    const handleRemoveMint = async () => {
        try {
            removeMintSheetRef.current?.dismiss();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            await removeMint(mintUrl || '');
            toast.show('Mint Removed', {
                message: 'The mint has been successfully removed.',
            });
            router.back();
        } catch (e: any) {
            console.error('Failed to remove mint:', e);
            toast.show('Error', {
                message: e.message || 'Failed to remove mint.',
            });
        }
    };

    const handleRestoreProofs = async () => {
        if (!mintUrl) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        try {
            toast.show('Restoring...', { message: 'Checking for unspent proofs on this mint...' });
            await restoreFromSeed(mintUrl);
            toast.show('Restore Complete', { message: 'Finished checking for proofs.' });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            queryClient.invalidateQueries({ queryKey: ['history'] });
        } catch (e: any) {
            console.error('[MintDetails] Restore failed:', e);
            toast.show('Restore Failed', { message: e.message || 'Error occurred during restore.' });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
    };

    const { data: btcData } = useQuery({
        queryKey: ['bitcoinPrice', secondaryCurrency],
        queryFn: () => bitcoinService.fetchPrice(secondaryCurrency),
        staleTime: 30000,
    });

    const { data: info } = useQuery({
        queryKey: ['mint-metadata', mintUrl],
        queryFn: () => mintRecommendationService.fetchMintMetadata(mintUrl || ''),
        enabled: !!mintUrl,
        staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    });

    const { data: history = [] } = useQuery({
        queryKey: ['history'],
        queryFn: async () => {
            if (!initService.isInitialized()) return [];
            return historyService.getHistory(200, 0);
        },
        enabled: initService.isInitialized(),
    });

    // Auditor queries
    const { data: auditorMint } = useQuery({
        queryKey: ['auditor-mint', mintUrl],
        queryFn: async () => {
            try {
                const response = await fetch(`https://api.audit.8333.space/mints/url?url=${encodeURIComponent(mintUrl || '')}`);
                if (response.ok) {
                    return await response.json();
                }
            } catch (e) {
                console.error('Error fetching auditor mint info:', e);
            }
            return null;
        },
        enabled: !!mintUrl,
        staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    });

    const { data: auditorSwaps = [] } = useQuery({
        queryKey: ['auditor-swaps', auditorMint?.id],
        queryFn: async () => {
            if (!auditorMint?.id) return [];
            try {
                const response = await fetch(`https://api.audit.8333.space/swaps/mint/${auditorMint.id}?skip=0&limit=30`);
                if (response.ok) {
                    return await response.json();
                }
            } catch (e) {
                console.error('Error fetching auditor swaps:', e);
            }
            return [];
        },
        enabled: !!auditorMint?.id,
        staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    });

    const { successRate, averageTime, riskLabel, uptimeColor, sortedSwaps } = useMemo(() => {
        if (!auditorMint || !auditorSwaps || auditorSwaps.length === 0) {
            return {
                successRate: null,
                averageTime: null,
                riskLabel: 'Not Audited',
                uptimeColor: '$gray10',
                sortedSwaps: [],
            };
        }

        const successfulSwaps = auditorSwaps.filter((s: any) => s.state === 'OK');
        const rate = Math.round((successfulSwaps.length / auditorSwaps.length) * 100);

        const successfulSwapsWithTime = successfulSwaps.filter((s: any) => s.time_taken);
        const avgTime = successfulSwapsWithTime.length > 0
            ? successfulSwapsWithTime.reduce((sum: number, s: any) => sum + s.time_taken, 0) / successfulSwapsWithTime.length
            : null;

        let risk = 'Low Risk';
        let color = '$green10';
        if (rate >= 99.0) {
            risk = 'Low Risk';
            color = '$green10';
        } else if (rate >= 95.0) {
            risk = 'Medium Risk';
            color = '$orange10';
        } else {
            risk = 'High Risk';
            color = '$red10';
        }

        const sorted = [...auditorSwaps].sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

        return {
            successRate: rate,
            averageTime: avgTime,
            riskLabel: risk,
            uptimeColor: color,
            sortedSwaps: sorted,
        };
    }, [auditorMint, auditorSwaps]);

    const uptimeBars = useMemo(() => {
        const totalBars = 30;
        const bars: React.ReactNode[] = [];

        // If not audited, show all neutral gray bars
        if (!auditorMint || sortedSwaps.length === 0) {
            return Array.from({ length: totalBars }).map((_, idx) => (
                <View
                    key={idx}
                    flex={1}
                    height={12}
                    bg="$gray5"
                    rounded={2}
                    opacity={0.4}
                />
            ));
        }

        // Pad with placeholders on the left if we have fewer than 30 swaps
        const paddingCount = Math.max(0, totalBars - sortedSwaps.length);
        for (let i = 0; i < paddingCount; i++) {
            bars.push(
                <View
                    key={`pad-${i}`}
                    flex={1}
                    height={12}
                    bg="$gray5"
                    rounded={2}
                    opacity={0.4}
                />
            );
        }

        // Add real swap bars (Green for OK, Red for any error status)
        sortedSwaps.forEach((swap: any) => {
            const isOk = swap.state === 'OK';
            const barColor = isOk ? '$green9' : '$red9';

            bars.push(
                <View
                    key={`swap-${swap.id}`}
                    flex={1}
                    height={12}
                    bg={barColor}
                    rounded={2}
                    opacity={0.85}
                />
            );
        });

        return bars;
    }, [auditorMint, sortedSwaps]);

    const normalizedTargetUrl = useMemo(() => mintUrl?.replace(/\/$/, '') || '', [mintUrl]);

    const walletMint = useMemo(() => {
        return mints.find(m => m.mintUrl.replace(/\/$/, '') === normalizedTargetUrl);
    }, [mints, normalizedTargetUrl]);

    const balance = useMemo(() => {
        if (!mintUrl) return 0;
        return balances[mintUrl] || 0;
    }, [balances, mintUrl]);

    const fiatBalance = useMemo(() => {
        if (!btcData?.price) return 0;
        return currencyService.convertSatsToCurrency(balance, btcData.price);
    }, [balance, btcData?.price]);

    const mintHistory = useMemo(() => {
        return history.filter(
            (e: any) => e.mintUrl.replace(/\/$/, '') === normalizedTargetUrl
        );
    }, [history, normalizedTargetUrl]);

    if (!mintUrl || !walletMint) {
        return (
            <YStack flex={1} justify="center" items="center" p="$4" bg="$background">
                <Text color="$color" fontSize="$5" fontWeight="600">Mint not found</Text>
                <Button mt="$4" onPress={() => router.back()}>Go Back</Button>
            </YStack>
        );
    }

    const name = walletMint.nickname || walletMint.name || info?.name || (() => {
        try { return new URL(mintUrl).hostname }
        catch (e) { return mintUrl }
    })();

    const description = info?.description || info?.description_long;
    const motd = info?.motd;
    const version = info?.version;
    const nuts = info?.nuts || {};
    const iconToUse = walletMint.icon || info?.icon_url || info?.picture || info?.icon;
    const isTrusted = walletMint.trusted ?? false;
    const isActive = activeMintUrl?.replace(/\/$/, '') === normalizedTargetUrl;

    const hostname = (() => {
        try { return new URL(mintUrl).hostname }
        catch (e) { return mintUrl }
    })();

    const handleCopy = async (text: string, label: string) => {
        await Clipboard.setStringAsync(text);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        toast.show('Copied', {
            message: `${label} copied to clipboard`,
        });
    };

    const handleShare = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        try {
            await RNShare.share({ message: mintUrl });
        } catch (error) {
            handleCopy(mintUrl, 'Mint URL');
        }
    };

    const handleOpenLink = async (url: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        try {
            await WebBrowser.openBrowserAsync(url);
        } catch (e) {
            toast.show('Error', { message: 'Could not open link' });
        }
    };

    const handleDeposit = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setActiveMint(mintUrl);
        router.push('/(modals)/mint');
    };

    const handleWithdraw = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setActiveMint(mintUrl);
        router.push('/(modals)/melt');
    };

    const handleSwap = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setActiveMint(mintUrl);
        router.push('/(modals)/swap');
    };

    const handleTransactionPress = (id: string, type: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push({ pathname: '/(modals)/txn-details', params: { id } });
    };

    return (
        <YStack flex={1} bg="$background">
            <Stack.Screen
                options={{
                    headerTitle: () => (
                        <YStack items="center" justify="center">
                            <Text fontSize="$4" fontWeight="800" color="$color">
                                {name}
                            </Text>
                            <Text fontSize="$1" color="$gray10" numberOfLines={1} style={{ maxWidth: 200 }}>
                                {hostname}
                            </Text>
                        </YStack>
                    ),
                    headerLeft: () => (
                        <Button
                            circular
                            size="$3"
                            bg="$gray3"
                            pressStyle={{ scale: 0.95, bg: '$gray4' }}
                            icon={<ChevronLeft size={20} color="$color" />}
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                router.back();
                            }}
                        />
                    ),
                    headerRight: () => (
                        <Button
                            circular
                            size="$3"
                            bg="$gray3"
                            pressStyle={{ scale: 0.95, bg: '$gray4' }}
                            icon={<Share2 size={18} color="$color" />}
                            onPress={handleShare}
                        />
                    ),
                }}
            />
<SafeFlex fill>
            <ScrollView
                flex={1}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: insets.bottom + 90 }}
            >
                <YStack px="$4" gap="$5">
                    {/* Balance and Avatar Row */}
                    <XStack justify="space-between" items="center" py="$4">
                        <YStack gap="$2">
                            <XStack items="baseline" gap="$1">
                                {primaryCurrency === 'SATS' ? (
                                    <Text fontSize={36} fontWeight="900" color="$color">
                                        {showBitcoinSymbol ? '₿' : ''}{balance.toLocaleString()}{showBitcoinSymbol ? '' : ' SATS'}
                                    </Text>
                                ) : (
                                    <Text fontSize={36} fontWeight="900" color="$color">
                                        {currencyService.formatValue(fiatBalance, secondaryCurrency as CurrencyCode)}
                                    </Text>
                                )}
                            </XStack>
                            <Text fontSize="$6" color="$gray12" fontWeight="600">
                                {primaryCurrency === 'SATS'
                                    ? currencyService.formatValue(fiatBalance, secondaryCurrency as CurrencyCode)
                                    : (showBitcoinSymbol ? `₿${balance.toLocaleString()}` : `${balance.toLocaleString()} sats`)}
                            </Text>

                            {/* Trust badges */}
                            <XStack mt="$2" gap="$2" items="center" >
                                {isTrusted ? (
                                    <Button size='$2' theme="green" disabled fontWeight={800}>
                                        Trusted
                                    </Button>
                                ) : (
                                    <Button size='$2' theme="red" disabled fontWeight={800}>
                                        Untrusted
                                    </Button>
                                )}
                                {isActive && (
                                    <Button size='$2' bg="blue" color="white" disabled fontWeight={800}>
                                        Active
                                    </Button>
                                )}
                            </XStack>
                        </YStack>

                        <Image
                            source={{ uri: iconToUse }}
                            style={{
                                width: 100,
                                height: 100,
                                borderRadius: 20,

                            }}
                        />

                    </XStack>

                    {/* Action Columns Row */}
                    <XStack py="$4" justify="space-around" bg="$gray2" rounded="$5" mt="$2">
                        <YStack items="center" gap="$2" onPress={handleDeposit} pressStyle={{ opacity: 0.7 }} flex={1}>
                            <ArrowUp size={24} color="$color" />
                            <Text fontSize="$3" fontWeight="600" color="$color">Deposit</Text>
                        </YStack>
                        <Separator vertical borderColor="$borderColor" opacity={0.5} />
                        <YStack items="center" gap="$2" onPress={handleWithdraw} pressStyle={{ opacity: 0.7 }} flex={1}>
                            <ArrowDown size={24} color="$color" />
                            <Text fontSize="$3" fontWeight="600" color="$color">Withdraw</Text>
                        </YStack>
                        <Separator vertical borderColor="$borderColor" opacity={0.5} />
                        <YStack items="center" gap="$2" onPress={handleSwap} pressStyle={{ opacity: 0.7 }} flex={1}>
                            <ArrowUpDown size={24} color="$color" />
                            <Text fontSize="$3" fontWeight="600" color="$color">Swap</Text>
                        </YStack>
                    </XStack>



                    {/* Collapsible About Section */}
                    <YStack gap="$2">
                        <Button
                            size="$4"
                            bg="$gray3"
                            pressStyle={{ bg: '$gray4' }}
                            onPress={() => setIsAboutExpanded(!isAboutExpanded)}
                            iconAfter={isAboutExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                            justify="space-between"
                            px="$4"
                            rounded="$5"
                        >
                            <Text fontSize="$4" fontWeight="800" color="$color">About Mint</Text>
                        </Button>

                        {isAboutExpanded && (
                            <YStack gap="$4" pt="$2">
                                {description && (
                                    <YStack gap="$1" px="$2">
                                        <Text fontSize="$3" color="$gray10" fontWeight="600">Description</Text>
                                        <Text color="$color" fontSize="$4" lineHeight={20}>{description}</Text>
                                    </YStack>
                                )}

                                {motd && (
                                    <YStack bg="$color5" rounded="$4" p="$3" mx="$2">
                                        <Text fontWeight="bold" color="$color" fontSize="$3">Announcement</Text>
                                        <Text color="$color" mt="$1" fontSize="$3">{motd}</Text>
                                    </YStack>
                                )}

                                <ListTable>
                                    <ListTableRow
                                        label="URL"
                                        value={
                                            <XStack items="center" gap="$1" onPress={() => handleOpenLink(mintUrl)}>
                                                <Text color="#0056b3" fontWeight="700" fontSize="$4" style={{ textDecorationLine: 'underline' }}>
                                                    {hostname}
                                                </Text>
                                                <ExternalLink size={12} color="#0056b3" />
                                            </XStack>
                                        }
                                        isCopyable
                                        copyValue={mintUrl}
                                    />
                                    {version && <ListTableRow label="Version" value={version} />}
                                    <ListTableRow
                                        label="Supported NUTs"
                                        value={Object.keys(nuts).length}
                                        rightContent={
                                            <View bg="$gray4" px="$2" py="$1" rounded="$2">
                                                <Text fontSize="$2" fontWeight="800" color="$color">NUTs</Text>
                                            </View>
                                        }
                                    />
                                    <YStack py="$3" px="$4" gap="$2">
                                        <XStack justify="space-between" items="center">
                                            <Text fontSize="$4" color="$gray10" fontWeight="600">Uptime</Text>
                                            <Text fontSize="$4" fontWeight="700" color={uptimeColor}>
                                                {successRate !== null ? `${successRate}% (${riskLabel})` : 'Not Audited'}
                                            </Text>
                                        </XStack>
                                        <XStack gap="$1" items="center" width="100%" pt="$1">
                                            {uptimeBars}
                                        </XStack>
                                    </YStack>
                                    <ListTableRow
                                        label="Success Rate"
                                        value={successRate !== null ? `${successRate}%` : 'Not Audited'}
                                    />
                                    {averageTime !== null && (
                                        <ListTableRow
                                            label="Avg Response Time"
                                            value={`${(averageTime / 1000).toFixed(2)}s`}
                                        />
                                    )}
                                    {auditorMint && auditorMint.balance !== undefined && (
                                        <ListTableRow
                                            label="Auditor Balance"
                                            value={showBitcoinSymbol ? `₿${auditorMint.balance.toLocaleString()}` : `${auditorMint.balance.toLocaleString()} sats`}
                                        />
                                    )}
                                    {auditorMint && auditorMint.sum_donations !== undefined && (
                                        <ListTableRow
                                            label="Auditor Donations"
                                            value={showBitcoinSymbol ? `₿${auditorMint.sum_donations.toLocaleString()}` : `${auditorMint.sum_donations.toLocaleString()} sats`}
                                        />
                                    )}
                                </ListTable>
                            </YStack>
                        )}
                    </YStack>

                    {/* Transaction History Section */}
                    <YStack gap="$3">
                        <Text fontSize="$5" color="$color" fontWeight="800" px="$1">Mint Transactions</Text>
                        {mintHistory.length === 0 ? (
                            <YStack py="$8" items="center" justify="center" opacity={0.5}>
                                <Text fontWeight="600" color="$gray10">No transactions for this mint</Text>
                            </YStack>
                        ) : (
                            <YGroup rounded="$5" bg="$gray3" overflow="hidden" separator={<Separator borderColor="$borderColor" opacity={0.5} />}>
                                {mintHistory.map((entry, idx) => {
                                    const total = mintHistory.length;
                                    const position = total === 1 ? 'only'
                                        : idx === 0 ? 'first'
                                            : idx === total - 1 ? 'last'
                                                : 'middle';

                                    const isFirst = position === 'first' || position === 'only';
                                    const isLast = position === 'last' || position === 'only';

                                    return (
                                        <YGroup.Item key={entry.id}>
                                            <View
                                                style={{
                                                    backgroundColor: '$gray3',
                                                    borderTopLeftRadius: isFirst ? 10 : 0,
                                                    borderTopRightRadius: isFirst ? 10 : 0,
                                                    borderBottomLeftRadius: isLast ? 10 : 0,
                                                    borderBottomRightRadius: isLast ? 10 : 0,
                                                    overflow: 'hidden',
                                                }}
                                            >
                                                <HistoryItem
                                                    id={entry.id}
                                                    type={entry.type}
                                                    amount={entry.amount}
                                                    createdAt={entry.createdAt}
                                                    status={entry.state || 'success'}
                                                    metadata={entry.metadata}
                                                    onPress={handleTransactionPress}
                                                />
                                            </View>
                                        </YGroup.Item>
                                    );
                                })}
                            </YGroup>
                        )}
                    </YStack>
                </YStack>
            </ScrollView>


            {/* Floating Action Buttons */}
            <XStack
                px="$4"
                pb={"$2"}
                pt="$3"
                bg="$background"
                borderTopWidth={1}
                borderColor="$borderColor"
                gap="$2.5"
            >
                <Button
                    flex={1}
                    size="$5"
                  variant='outlined'
                    onPress={handleRestoreProofs}
                    disabled={isRestoring}
                    fontWeight="800"
                    icon={isRestoring && restoringMintUrl === mintUrl ? <Spinner size="small" color="$accent10" /> : <RefreshCw size={18} />}
                >
                    {isRestoring && restoringMintUrl === mintUrl ? "Restoring..." : "Restore"}
                </Button>

                <Button
                    flex={1}
                    size="$5"
                    theme="red"
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        removeMintSheetRef.current?.present();
                    }}
                    fontWeight="800"
                    icon={<Trash2 strokeWidth={2.5} />}
                >
                    Remove
                </Button>
            </XStack>
            {/* Remove Mint Confirmation Bottom Sheet */}
            <AppBottomSheet ref={removeMintSheetRef} snapPoints={balance > 0 ? ['60%'] : ['40%']}>
                <YStack p="$4" gap="$4">
                    <View bg="$red3" p="$4" rounded="$4" borderWidth={1} borderColor="$red8">
                        <XStack gap="$3">
                            <AlertTriangle color="$red10" size={24} />
                            <YStack flex={1}>
                                <Text color="$red10" fontWeight="700" fontSize="$5">
                                    Remove Mint
                                </Text>
                                <Text color="$red10" fontSize="$3" mt="$1">
                                    Are you sure you want to remove this mint? This action will remove the mint configuration from your wallet.
                                </Text>
                            </YStack>
                        </XStack>
                    </View>

                    {balance > 0 && (
                        <View bg="$orange3" p="$4" rounded="$4" borderWidth={1} borderColor="$orange8">
                            <XStack gap="$3">
                                <AlertTriangle color="$orange10" size={24} />
                                <YStack flex={1}>
                                    <Text color="$orange10" fontWeight="700" fontSize="$5">
                                        Active Balance Warning
                                    </Text>
                                    <Text color="$orange10" fontSize="$3" mt="$1">
                                        You currently have a balance of <Text fontWeight="800">{showBitcoinSymbol ? `₿${balance.toLocaleString()}` : `${balance.toLocaleString()} sats`}</Text> in this mint. If you remove it, you will lose access to these funds!
                                    </Text>
                                </YStack>
                            </XStack>
                        </View>
                    )}

                    <YStack gap="$3" mt="$2">
                        <Button
                            size="$5"
                            bg="$red9"
                            color="white"
                            fontWeight="700"
                            rounded="$4"
                            onPress={handleRemoveMint}
                            pressStyle={{ scale: 0.98, bg: '$red10' }}
                        >
                            Confirm Remove
                        </Button>
                        <Button
                            size="$5"
                            theme="gray"
                            fontWeight="700"
                            rounded="$4"
                            onPress={() => removeMintSheetRef.current?.dismiss()}
                        >
                            Cancel
                        </Button>
                    </YStack>
                </YStack>
            </AppBottomSheet>
                            </SafeFlex>
        </YStack>
    );
}
