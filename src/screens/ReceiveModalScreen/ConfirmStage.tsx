import React from 'react';
import { YStack, XStack, Text, Button, View, Separator, Circle, ScrollView, YGroup, Theme, useTheme } from 'tamagui';
import { ArrowDownLeft, Check, ShieldCheck, AlertTriangle, Copy, Building2, DollarSign, Clock, Loader, ChevronDown, ChevronUp } from '@tamagui/lucide-icons';
import { Spinner } from '../../components/UI/Spinner';
import { ProcessingSheet } from '../../components/UI/ProcessingSheet';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { useToastController } from '@tamagui/toast';
import { useWalletStore } from '../../store/walletStore';
import { mintManager, proofService } from '../../services/core';
import { useSettingsStore } from '../../store/settingsStore';
import { useQuery } from '@tanstack/react-query';
import { bitcoinService } from '../../services/bitcoinService';
import { currencyService, CurrencyCode } from '../../services/currencyService';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { PrimaryBalance } from 'temp/Sovran/features/wallet';

interface TokenInfo {
    mint: string;
    amount: number;
    proofCount: number;
    preview?: {
        name?: string;
        description?: string;
    };
    p2pkNpub?: string;
}

interface ConfirmStageProps {
    token: string;
    tokenInfo: TokenInfo;
    isLoading?: boolean;
    onConfirm: () => void;
    onReceiveLater: () => void;
    onBack: () => void;
}

export function ConfirmStage({ token, tokenInfo, isLoading, onConfirm, onReceiveLater, onBack }: ConfirmStageProps) {
    const theme = useTheme();
    const { mints } = useWalletStore();
    const { secondaryCurrency } = useSettingsStore();
    const toast = useToastController();
    const [isSavingLater, setIsSavingLater] = React.useState(false);
    const [estimatedFee, setEstimatedFee] = React.useState(0);
    const [showDetails, setShowDetails] = React.useState(false);

    // ── Shimmer animation for card reflection ──
    const shimmerX = useSharedValue(-250);
    React.useEffect(() => {
        shimmerX.value = withRepeat(
            withTiming(350, { duration: 2400, easing: Easing.linear }),
            -1,
            false
        );
    }, []);

    const animatedShimmerStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: shimmerX.value }, { rotate: '25deg' }],
    }));

    // ── Proof state verification (NUT-07) ────────────────────────────
    type ProofStatus = 'checking' | 'valid' | 'spent' | 'unknown';
    const [proofStatus, setProofStatus] = React.useState<ProofStatus>('checking');

    React.useEffect(() => {
        let cancelled = false;
        setProofStatus('checking');
        (async () => {
            try {
                const states = await proofService.checkProofStates(token);
                if (cancelled) return;
                if (!states || states.length === 0) {
                    setProofStatus('unknown');
                    return;
                }
                const anySpent = states.some((s: any) => s.state === 'SPENT');
                setProofStatus(anySpent ? 'spent' : 'valid');
            } catch {
                if (!cancelled) setProofStatus('unknown');
            }
        })();
        return () => { cancelled = true; };
    }, [token]);
    // ─────────────────────────────────────────────────────────────────

    const [expiresAt, setExpiresAt] = React.useState<number | undefined>(undefined);
    const [timeLeftStr, setTimeLeftStr] = React.useState<string | null>(null);

    React.useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const { decodeToken } = require('../../services/core/tokenUtils');
                const decoded = decodeToken(token);
                const secrets = (decoded.proofs || []).map((p: any) => p.secret);
                if (secrets.length > 0) {
                    const { expiryService } = require('../../services/core/expiryService');
                    const expiryInfo = await expiryService.getExpiryBySecrets(secrets);
                    if (!cancelled && expiryInfo) {
                        setExpiresAt(expiryInfo.expiresAt);
                    }
                }
            } catch (e) {
                console.warn('[ConfirmStage] Failed to check local token expiry:', e);
            }
        })();
        return () => { cancelled = true; };
    }, [token]);

    React.useEffect(() => {
        if (!expiresAt) {
            setTimeLeftStr(null);
            return;
        }

        const updateTime = () => {
            const diff = expiresAt - Date.now();
            if (diff <= 0) {
                setTimeLeftStr('Expired');
            } else {
                const hours = Math.floor(diff / (60 * 60 * 1000));
                const mins = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
                const secs = Math.floor((diff % (60 * 1000)) / 1000);

                if (hours > 0) {
                    setTimeLeftStr(`${hours}h ${mins}m left`);
                } else if (mins > 0) {
                    setTimeLeftStr(`${mins}m ${secs}s left`);
                } else {
                    setTimeLeftStr(`${secs}s left`);
                }
            }
        };

        updateTime();
        const interval = setInterval(updateTime, 1000);
        return () => clearInterval(interval);
    }, [expiresAt]);

    const { data: btcData } = useQuery({
        queryKey: ['bitcoinPrice', secondaryCurrency],
        queryFn: () => bitcoinService.fetchPrice(secondaryCurrency),
        staleTime: 30000,
    });

    // Fetch fee for this mint
    React.useEffect(() => {
        if (tokenInfo.mint) {
            mintManager.getFeePpk(tokenInfo.mint).then(feePpk => {
                const fee = feePpk > 0 ? Math.ceil(tokenInfo.proofCount * feePpk / 1000) : 0;
                setEstimatedFee(fee);
            }).catch(() => setEstimatedFee(0));
        }
    }, [tokenInfo.mint, tokenInfo.proofCount]);

    // Check if mint is trusted
    const normalizeUrl = (url: string) => url.replace(/\/$/, '').toLowerCase();
    const isMintTrusted = mints.some(m =>
        normalizeUrl(m.mintUrl) === normalizeUrl(tokenInfo.mint) && m.trusted
    );

    // Get mint display name
    const getMintDisplayName = (url: string) => {
        if (tokenInfo.preview?.name) return tokenInfo.preview.name;
        const storedMint = mints.find(m => normalizeUrl(m.mintUrl) === normalizeUrl(url));
        if (storedMint?.name) return storedMint.name;
        try {
            return new URL(url).hostname;
        } catch {
            return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
        }
    };

    const handleCopy = async (text: string, label: string) => {
        await Clipboard.setStringAsync(text);
        toast.show('Copied!', { message: `${label} copied to clipboard` });
        Haptics.selectionAsync();
    };


    return (
        <YStack flex={1} bg="$background">
            <ScrollView contentContainerStyle={{ paddingBottom: 250 } as any} showsVerticalScrollIndicator={false}>
                <YStack p="$4" gap="$2">
                    {/* Sleek Dark Cashu Token Preview Card */}
                    <Theme >
                        <View rounded="$5" bg="$gray3" borderWidth={0} borderColor="$borderColor" p="$5" justify="space-between" overflow="hidden" position="relative">
                            {/* Background glow & animated shimmer reflection */}

                            {/* Wrapped Monospace Token Text */}
                            <Text
                                fontFamily="$mono"
                                fontSize={11}
                                color="$gray9"
                                lineHeight={16}
                                numberOfLines={12}

                                onPress={() => handleCopy(token, 'Token')}
                                pressStyle={{ opacity: 0.6 }}
                                style={{ wordBreak: 'break-all', cursor: 'pointer' } as any}
                            >
                                {token}
                            </Text>

                            {/* Linear Gradient & Opacity Overflow Fade */}
                            <View position="absolute" l={0} r={0} b={0} height={140} pointerEvents="none" z={5}>
                                <LinearGradient
                                    colors={['transparent', theme.gray1?.val, theme.gray1?.val]}
                                    style={{ flex: 1 }}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 0, y: 1 }}
                                />
                            </View>

                            {/* Bottom Row */}
                            <XStack justify="space-between" items="flex-end" mt="$-1" z={10} width="100%">
                                <YStack gap="$1" flex={1} mr="$3" shrink={1}>
                                    <Text color="$accent3" fontWeight="600" fontSize={15}>
                                        {btcData?.price ? currencyService.formatValue(currencyService.convertSatsToCurrency(tokenInfo.amount, btcData.price), secondaryCurrency as CurrencyCode) : '$0.00'}
                                    </Text>
                                    <XStack items="flex-start" gap="$1.5">
                                        <Text color="$accent5" fontSize={13} fontWeight="600" numberOfLines={2} flex={1}>
                                        {getMintDisplayName(tokenInfo.mint)}
                                        </Text>
                                    </XStack>
                                </YStack>

                                <Text  fontSize={46} fontWeight="700" color="$accent3" lineHeight={48} shrink={0} letterSpacing={-1.5} text="right">
                                    {tokenInfo.amount.toLocaleString()}
                                </Text>
                            </XStack>
                        </View>
                    </Theme>


                    {/* Warning for untrusted mint */}
                    {!isMintTrusted && (
                        <YStack bg="$orange3" p="$3" px="$4" rounded="$4" gap="$1.5">
                            <XStack gap="$2" items="center">
                                <AlertTriangle size={18} color="$orange10" />
                                <Text color="$orange10" fontSize="$3" fontWeight="700">
                                    Untrusted Mint
                                </Text>
                            </XStack>
                            <Text color="$orange10" fontSize="$2" fontWeight="500" lineHeight={18}>
                                You are about to add and trust this mint to receive funds.
                                {tokenInfo.preview ? ' Review the details below.' : ''}
                            </Text>
                        </YStack>
                    )}

                    {/* ── Proof verification status badge (NUT-07) ── */}
                    <XStack
                        justify="space-between"
                        items="center"
                        bg={
                            proofStatus === 'valid' ? '$green3'
                                : proofStatus === 'spent' ? '$red3'
                                    : '$gray3'
                        }
                        p="$3"
                        px="$4"
                        rounded="$4"
                    >
                        {/* Left Element: Icon & Title */}
                        <XStack items="center" gap="$2" flex={1} mr="$2">
                            {proofStatus === 'checking' && <Spinner size="small" color="$gray10" />}
                            {proofStatus === 'valid' && <ShieldCheck size={16} color="$green10" />}
                            {proofStatus === 'spent' && <AlertTriangle size={16} color="$red10" />}
                            {proofStatus === 'unknown' && <AlertTriangle size={16} color="$gray10" />}
                            <Text
                                fontSize="$3"
                                fontWeight="600"
                                numberOfLines={1}
                                color={
                                    proofStatus === 'valid' ? '$green10'
                                        : proofStatus === 'spent' ? '$red10'
                                            : '$gray10'
                                }
                            >
                                {proofStatus === 'checking' ? 'Verifying proofs with mint…'
                                    : proofStatus === 'valid' ? 'Proof Status'
                                        : proofStatus === 'spent' ? 'Proof Warning'
                                            : 'Verification Status'}
                            </Text>
                        </XStack>

                        {/* Right Element: Status Value */}
                        <XStack items="center">
                            <Text
                                fontSize="$3"
                                fontWeight="700"
                                color={
                                    proofStatus === 'valid' ? '$green10'
                                        : proofStatus === 'spent' ? '$red10'
                                            : '$gray10'
                                }
                            >
                                {proofStatus === 'checking' ? 'Checking...'
                                    : proofStatus === 'valid' ? 'Unspent ✓'
                                        : proofStatus === 'spent' ? 'Already Spent'
                                            : 'Unverified'}
                            </Text>
                        </XStack>
                    </XStack>


                    {/* Collapsible Details Trigger & List */}
                    <YStack bg="$gray2" rounded="$5" overflow="hidden" mb="$3">
                        <XStack
                            p="$3"
                            px="$4"
                            justify="space-between"
                            items="center"
                            onPress={() => {
                                Haptics.selectionAsync();
                                setShowDetails(!showDetails);
                            }}
                            pressStyle={{ opacity: 0.8 }}
                        >
                            <Text fontSize="$3" fontWeight="700" color="$gray12">Details</Text>
                            <XStack items="center" gap="$1.5">
                                <Text fontSize="$2" color="$gray9" fontWeight="600">{showDetails ? 'Hide' : 'Show'}</Text>
                                {showDetails ? <ChevronUp size={16} color="$gray9" /> : <ChevronDown size={16} color="$gray9" />}
                            </XStack>
                        </XStack>

                        {showDetails && (
                            <>
                                <Separator borderColor="$borderColor" opacity={0.3} />
                                <YGroup separator={<Separator borderColor="$borderColor" opacity={0.5} />}>
                                    <DetailItem
                                        label="Amount"
                                        value={`${tokenInfo.amount} sats`}
                                    />
                                    <DetailItem
                                        label="Fiat"
                                        value={btcData?.price ? currencyService.formatValue(currencyService.convertSatsToCurrency(tokenInfo.amount, btcData.price), secondaryCurrency as CurrencyCode) : '...'}
                                    />
                                    <DetailItem
                                        label="Proofs"
                                        value={tokenInfo.proofCount.toString()}
                                    />
                                    <DetailItem
                                        label="Expiry"
                                        value={expiresAt ? (timeLeftStr || 'Checking...') : 'Never'}
                                    />
                                    {tokenInfo.p2pkNpub && (
                                        <DetailItem
                                            label="Locked To"
                                            value={tokenInfo.p2pkNpub === useSettingsStore.getState().npub ? "You (Safe)" : `${tokenInfo.p2pkNpub.substring(0, 10)}...${tokenInfo.p2pkNpub.substring(tokenInfo.p2pkNpub.length - 6)}`}
                                            isCopyable={tokenInfo.p2pkNpub !== useSettingsStore.getState().npub}
                                            onCopy={() => handleCopy(tokenInfo.p2pkNpub!, "NPUB")}
                                        />
                                    )}
                                    <DetailItem
                                        label="Mint"
                                        value={getMintDisplayName(tokenInfo.mint)}
                                        isCopyable
                                        onCopy={() => handleCopy(tokenInfo.mint, "Mint URL")}
                                    />
                                    {tokenInfo.preview?.description && (
                                        <DetailItem label="Description" value={tokenInfo.preview.description} />
                                    )}
                                    {estimatedFee > 0 && (
                                        <>
                                            <DetailItem
                                                label="Fee"
                                                value={`-${estimatedFee} sats`}
                                            />
                                            <DetailItem
                                                label="You Receive"
                                                value={`${tokenInfo.amount - estimatedFee} sats`}
                                            />
                                        </>
                                    )}
                                </YGroup>
                            </>
                        )}
                    </YStack>

                </YStack>
            </ScrollView>

            <YStack position="absolute" b="$4" l="$4" r="$4" gap="$2">
                <Button
                    bg="$gray3"
                    color="$color"
                    height={50}
                    rounded="$4"
                    disabled={isLoading}
                    icon={isSavingLater ? <Spinner size="small" color="$color" /> : <Clock size={18} color="$gray10" />}
                    fontWeight="700" fontSize="$5"
                    onPress={async () => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        setIsSavingLater(true);
                        try {
                            await onReceiveLater();
                        } finally {
                            setIsSavingLater(false);
                        }
                    }}
                    pressStyle={{ opacity: 0.9, scale: 0.98 }}
                >
                    {isSavingLater ? 'Saving...' : 'Receive Later'}
                </Button>





                <Button
                    bg={proofStatus === 'spent' ? '$red9' : isMintTrusted ? "$green9" : "$orange9"}
                    color="white"
                    height={50}
                    rounded="$4"
                    disabled={isLoading || proofStatus === 'spent'}
                    icon={isLoading ? <Spinner size="small" color="white" /> : undefined}
                    fontWeight="700" fontSize="$5"
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                        onConfirm();
                    }}
                    pressStyle={{ opacity: 0.9, scale: 0.98 }}
                >
                    {isLoading
                        ? 'Receiving...'
                        : proofStatus === 'spent'
                            ? 'Token Already Spent'
                            : (isMintTrusted ? 'Receive' : 'Trust & Receive')}
                </Button>
            </YStack>
        </YStack >
    );
}

function DetailItem({ label, value, isCopyable, onCopy }: { label: string, value: string, isCopyable?: boolean, onCopy?: () => void }) {
    return (
        <XStack justify="space-between" items="center" py="$3" px="$4">
            <Text fontSize="$3" color="$gray10" fontWeight="600">{label}</Text>
            <XStack gap="$2" items="center">
                <Text fontSize="$3" fontWeight="800" color="$color" numberOfLines={1} style={{ maxWidth: 200 }}>
                    {value}
                </Text>
                {isCopyable && (
                    <Button size="$2" chromeless icon={<Copy size={16} color="$gray10" />} onPress={onCopy} />
                )}
            </XStack>
        </XStack>
    );
}
