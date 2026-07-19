import React from 'react';
import { YStack, XStack, Text, Button, View, Separator, ScrollView, YGroup } from 'tamagui';
import { ShieldCheck, AlertTriangle, Copy, Clock, Check } from '@tamagui/lucide-icons';
import { Spinner } from '../../components/UI/Spinner';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { useToastController } from '@tamagui/toast';
import { useWalletStore } from '../../store/walletStore';
import { mintManager, proofService } from '../../services/core';
import { useSettingsStore } from '../../store/settingsStore';
import { useQuery } from '@tanstack/react-query';
import { bitcoinService } from '../../services/bitcoinService';
import { currencyService, CurrencyCode } from '../../services/currencyService';

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
    const { mints } = useWalletStore();
    const { secondaryCurrency } = useSettingsStore();
    const toast = useToastController();
    const [isSavingLater, setIsSavingLater] = React.useState(false);
    const [estimatedFee, setEstimatedFee] = React.useState(0);

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
                <YStack p="$4" gap="$4">
                    {/* Middle Amount Display */}
                    <YStack gap="$3" py="$6" items="center" justify="center">
                        <Text fontSize={52} fontFamily="$oswald" fontWeight="700" color="$accent3" lineHeight={54}>
                            {currencyService.formatSats(tokenInfo.amount)}
                        </Text>
                        <Text color="$accent5" fontWeight="600" fontSize={16}>
                            {btcData?.price ? currencyService.formatValue(currencyService.convertSatsToCurrency(tokenInfo.amount, btcData.price), secondaryCurrency as CurrencyCode) : '$0.00'}
                        </Text>
                    </YStack>

                    {/* Proof verification status badge (NUT-07) */}
                    <XStack
                        self="center"
                        items="center"
                        gap="$2"
                        bg={
                            proofStatus === 'valid' ? '$green9'
                                : proofStatus === 'spent' ? '$red9'
                                    : '$gray9'
                        }
                        px="$4"
                        py="$3"
                        rounded="$10"
                    >
                        {proofStatus === 'checking' && <Spinner size="small" color="white" />}
                        {proofStatus === 'valid' && <Check size={16} color="white" />}
                        {proofStatus === 'spent' && <AlertTriangle size={16} color="white" />}
                        {proofStatus === 'unknown' && <AlertTriangle size={16} color="white" />}
                        <Text
                            fontSize="$3"
                            fontWeight="700"
                            color="white"
                        >
                            {proofStatus === 'checking' ? 'Checking...'
                                : proofStatus === 'valid' ? 'Unspent'
                                    : proofStatus === 'spent' ? 'Spent'
                                        : 'Unverified'}
                        </Text>
                    </XStack>

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

                    {/* Details List */}
                    <YStack bg="$gray2" rounded="$5" overflow="hidden" mb="$3">
                        <View p="$3" px="$4">
                            <Text fontSize="$3" fontWeight="700" color="$gray12">Details</Text>
                        </View>
                        <Separator borderColor="$borderColor" opacity={0.3} />
                        <YGroup separator={<Separator borderColor="$borderColor" opacity={0.5} />}>
                            <DetailItem
                                label="Token"
                                value={`${token.substring(0, 10)}...${token.substring(token.length - 6)}`}
                                isCopyable
                                onCopy={() => handleCopy(token, "Token")}
                            />
                            <DetailItem
                                label="Proofs"
                                value={tokenInfo.proofCount.toString()}
                            />
                            <DetailItem
                                label="Mint"
                                value={getMintDisplayName(tokenInfo.mint)}
                                isCopyable
                                onCopy={() => handleCopy(tokenInfo.mint, "Mint URL")}
                            />
                            {estimatedFee > 0 && (
                                <DetailItem
                                    label="Fee"
                                    value={`${estimatedFee} sats`}
                                />
                            )}
                            {tokenInfo.p2pkNpub && (
                                <DetailItem
                                    label="Locked To"
                                    value={tokenInfo.p2pkNpub === useSettingsStore.getState().npub ? "You (Safe)" : `${tokenInfo.p2pkNpub.substring(0, 10)}...${tokenInfo.p2pkNpub.substring(tokenInfo.p2pkNpub.length - 6)}`}
                                    isCopyable={tokenInfo.p2pkNpub !== useSettingsStore.getState().npub}
                                    onCopy={() => handleCopy(tokenInfo.p2pkNpub!, "NPUB")}
                                />
                            )}
                            {expiresAt && (
                                <DetailItem
                                    label="Expiry"
                                    value={timeLeftStr || 'Checking...'}
                                />
                            )}
                        </YGroup>
                    </YStack>

                </YStack>
            </ScrollView>

            <XStack position="absolute" b="$2" l="$4" r="$4" gap="$2">
                <Button
                    bg="$gray3"
                    color="$color"
            
                    flex={1}
                    rounded="$5"
                    size="$5"
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
                    {isSavingLater ? 'Saving...' : 'Only Save'}
                </Button>

                <Button
                    bg={proofStatus === 'spent' ? '$red9' : isMintTrusted ? "$green9" : "$orange9"}
                    color="white"
            
                    flex={1}
                    rounded="$5"
                    size="$5"
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
            </XStack>
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
