import React, { useEffect, useState, useRef } from 'react';
import { YStack, XStack, Text, Button, Separator, View, ScrollView } from "tamagui";
import { Copy, Share2, Check, RotateCcw, Hexagon, Gauge, ZoomIn, ArrowDownLeft } from "@tamagui/lucide-icons";
import * as Haptics from 'expo-haptics';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { Share as RNShare } from 'react-native';
import { useToastController } from '@tamagui/toast';

import { Spinner } from './Spinner';
import { Buffer } from 'buffer';
import { UR, UREncoder } from "@gandlaf21/bc-ur";
import { useSettingsStore } from '~/store/settingsStore';
import { useQuery } from '@tanstack/react-query';
import { bitcoinService } from '~/services/bitcoinService';
import { currencyService, CurrencyCode } from '~/services/currencyService';
import { cleanToken, decodeToken, encodeTokenV4, encodeTokenV3 } from '~/services/core';
import { nip19 } from 'nostr-tools';

export interface PendingTokenLayoutProps {
    token: string;
    amount: number | string;
    fee?: number;
    mintUrl?: string;
    onReclaim?: () => void | Promise<void>;
    isReclaiming?: boolean;
    lockedToNpub?: string | null;
    hideDetails?: boolean;
    hideActions?: boolean;
    onClaim?: () => void | Promise<void>;
    isClaiming?: boolean;
}

export function PendingTokenLayout({
    token,
    amount,
    fee = 0,
    mintUrl,
    onReclaim,
    isReclaiming = false,
    lockedToNpub,
    hideDetails = false,
    hideActions = false,
    onClaim,
    isClaiming = false,
}: PendingTokenLayoutProps) {
    const toast = useToastController();
    const { secondaryCurrency, npub } = useSettingsStore();

    const [copied, setCopied] = useState(false);
    const [currentToken, setCurrentToken] = useState<string>(token || '');
    const [qrCodeFragment, setQrCodeFragment] = useState<string>(token || '');
    // Animated UR QR is opt-in only — standard wallets (Minibits, cashu.me, Sovan)
    // cannot scan ur:cashu/... format. Default to static cashu: QR.
    const [showAnimatedQR, setShowAnimatedQR] = useState(false);
    const [fragmentLength, setFragmentLength] = useState(150);
    const [intervalMs, setIntervalMs] = useState(140);
    const encoderRef = useRef<UREncoder | null>(null);
    const [tokenVersion, setTokenVersion] = useState<'V3' | 'V4'>(token?.startsWith('cashuB') ? 'V4' : 'V3');

    // Optional internal parsing for p2pk if lockedToNpub not passed
    const [parsedNpub, setParsedNpub] = useState<string | null>(lockedToNpub || null);

    const { data: btcData } = useQuery({
        queryKey: ['bitcoinPrice', secondaryCurrency],
        queryFn: () => bitcoinService.fetchPrice(secondaryCurrency),
        staleTime: 30000,
    });

    // Sync currentToken when prop token changes
    useEffect(() => {
        if (token && token !== currentToken) {
            setCurrentToken(token);
        }
    }, [token]);

    useEffect(() => {
        if (!currentToken) return;

        try {
            const clean = cleanToken(currentToken);
            const decoded = decodeToken(clean) as any;

            // Handle both V3 array / V4 object format
            let proofs: any[] = [];
            if (decoded.token && decoded.token.length > 0) proofs = decoded.token[0].proofs;
            else if (decoded.proofs) proofs = decoded.proofs;

            // Extract p2pk if not explicitly provided
            if (!lockedToNpub && proofs.length > 0) {
                const firstSecret = proofs[0]?.secret;
                if (typeof firstSecret === 'string' && firstSecret.startsWith('["P2PK"')) {
                    try {
                        const parsed = JSON.parse(firstSecret);
                        const hexPubkey = parsed[1]?.data;
                        if (hexPubkey) {
                            setParsedNpub(nip19.npubEncode(hexPubkey));
                        }
                    } catch (e) { }
                }
            }

            if (showAnimatedQR) {
                // Only build UR encoder when animated mode is explicitly ON
                const { encode: cborEncode } = require('cbor-x');
                const cborBuffer = cborEncode(clean);
                const ur = new UR(Buffer.from(cborBuffer), "cashu");
                encoderRef.current = new UREncoder(ur, fragmentLength, 0);
                setQrCodeFragment(encoderRef.current.nextPart());
            } else {
                // Static mode: use plain cashu: token — readable by all wallets
                setQrCodeFragment(clean.startsWith('cashu:') ? clean : `cashu:${clean}`);
            }
        } catch (e) {
            console.error('[PendingTokenLayout] Failed to setup QR:', e);
            setShowAnimatedQR(false);
            setQrCodeFragment(currentToken.startsWith('cashu:') ? currentToken : `cashu:${currentToken}`);
        }
    }, [currentToken, fragmentLength, lockedToNpub, showAnimatedQR]);

    useEffect(() => {
        if (!showAnimatedQR || !encoderRef.current) return;
        const interval = setInterval(() => {
            setQrCodeFragment(encoderRef.current!.nextPart());
        }, intervalMs);
        return () => clearInterval(interval);
    }, [showAnimatedQR, intervalMs]);

    const handleCopy = async () => {
        if (currentToken) {
            await Clipboard.setStringAsync(currentToken);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setCopied(true);
            toast.show('Copied!', { message: 'Token copied to clipboard' });
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleShare = async () => {
        if (!currentToken) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        try {
            await RNShare.share({ message: `cashu:${currentToken}` });
        } catch (error) {
            handleCopy();
        }
    };

    const handleToggleVersion = () => {
        if (!currentToken) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        try {
            const decoded = decodeToken(currentToken);
            if (tokenVersion === 'V3') {
                setCurrentToken(encodeTokenV4(decoded));
                setTokenVersion('V4');
                toast.show('Switched to V4', { message: 'Compact CBOR encoding' });
            } else {
                setCurrentToken(encodeTokenV3(decoded));
                setTokenVersion('V3');
                toast.show('Switched to V3', { message: 'Standard JSON encoding' });
            }
        } catch (e) {
            toast.show('Error', { message: 'Failed to switch version' });
        }
    };

    const changeSpeed = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (intervalMs === 250) setIntervalMs(500);
        else if (intervalMs === 500) setIntervalMs(140);
        else setIntervalMs(250);
    };

    const changeSize = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (fragmentLength === 100) setFragmentLength(50);
        else if (fragmentLength === 50) setFragmentLength(150);
        else setFragmentLength(100);
    };

    const speedLabel = intervalMs === 140 ? "F" : intervalMs === 250 ? "M" : "S";
    const sizeLabel = fragmentLength === 150 ? "L" : fragmentLength === 100 ? "M" : "S";

    const handleToggleAnimatedQR = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setShowAnimatedQR(prev => !prev);
    };

    const displayNpub = lockedToNpub || parsedNpub;

    return (
        <YStack flex={1} bg="$background" width="100%">
            {/* QR Code */}
            <YStack items="center" gap="$4" mb="$6">
                <View bg="white" p="$2" borderWidth={1} borderColor="$borderColor" rounded="$5">
                    {qrCodeFragment ? (
                        <QRCode
                            value={qrCodeFragment}
                            size={330}
                            backgroundColor="white"
                            color="black"
                            quietZone={10}
                        />
                    ) : (
                        <YStack width={330} height={330} items="center" justify="center">
                            <Spinner size="large" color="$color" />
                        </YStack>
                    )}
                </View>

                {/* QR controls: animated UR toggle + token version + speed/size when animated */}
                <XStack gap="$1.5" bg="$color3" px="$4" py="$2" rounded="$10" flexWrap="wrap" justify="center">
                    {showAnimatedQR && (
                        <>
                            <Button size="$2.5" chromeless icon={<Gauge size={16} />} onPress={changeSpeed} color="$color" fontWeight="700">{speedLabel}</Button>
                            <Separator vertical height={15} style={{ alignSelf: 'center' }} borderColor="$gray8" />
                            <Button size="$2.5" chromeless icon={<ZoomIn size={16} />} onPress={changeSize} color="$color" fontWeight="700">{sizeLabel}</Button>
                            <Separator vertical height={15} style={{ alignSelf: 'center' }} borderColor="$gray8" />
                        </>
                    )}
                    <Button size="$2.5" chromeless icon={<Hexagon size={16} />} onPress={handleToggleVersion} color="$color" fontWeight="700">{tokenVersion}</Button>
                    <Separator vertical height={15} style={{ alignSelf: 'center' }} borderColor="$gray8" />
                    {/* UR animated QR for advanced wallets — off by default */}
                    <Button
                        size="$2.5"
                        chromeless
                        onPress={handleToggleAnimatedQR}
                        color={showAnimatedQR ? '$orange10' : '$color'}
                        fontWeight="700"
                    >
                        {showAnimatedQR ? 'UR' : 'QR'}
                    </Button>
                </XStack>
                {showAnimatedQR && (
                    <Text fontSize="$1" color="$orange10" text="center" px="$4">
                        UR animated mode — only for UR-compatible wallets
                    </Text>
                )}
            </YStack>

            {/* Details Table */}
            {!hideDetails && (
                <YStack gap="$0" mb="$6" bg="$gray2" rounded="$5" overflow="hidden" separator={<Separator borderColor="$borderColor" opacity={0.5} />}>
                    <DetailItem label="Amount" value={`₿${amount} sats`} />
                    {fee > 0 && <DetailItem label="Fee" value={`₿${fee} sats`} />}
                    <DetailItem label="Unit" value="SATOSHIS" />
                    <DetailItem label="Fiat" value={btcData?.price ? currencyService.formatValue(currencyService.convertSatsToCurrency(Number(amount), btcData.price), secondaryCurrency as CurrencyCode) : '...'} />
                    {displayNpub && (
                        <DetailItem
                            label="Locked To"
                            value={displayNpub === npub ? "You (Safe)" : `${displayNpub.substring(0, 10)}...${displayNpub.substring(displayNpub.length - 6)}`}
                            isCopyable={displayNpub !== npub}
                            onCopy={async () => {
                                await Clipboard.setStringAsync(displayNpub);
                                Haptics.selectionAsync();
                                toast.show('Copied!', { message: 'NPUB copied to clipboard' });
                            }}
                        />
                    )}
                    <DetailItem label="Mint" value={mintUrl ? mintUrl.replace(/^https?:\/\//, '').split('/')[0] : 'Unknown'} />
                </YStack>
            )}

            {/* Action Buttons */}
            {!hideActions && (
                <YStack mt="auto" pb="$8" gap="$4">
                    {onClaim ? (
                        <>
                            <Button
                                bg="$green10"
                                color="white"
                                size="$5"
                                height={55}
                                rounded="$4"
                                onPress={onClaim}
                                disabled={isClaiming}
                                icon={isClaiming ? <Spinner size="small" color="white" /> : <ArrowDownLeft size={20} color="white" />}
                            >
                                CLAIM NOW
                            </Button>
                            <XStack gap="$2" width="100%">
                                <Button flex={1} bg="$gray3" color="$color" height={55} icon={<Copy size={18} />} onPress={handleCopy} fontWeight="800">Copy</Button>
                                <Button flex={1} bg="$gray3" color="$color" height={55} icon={<Share2 size={18} />} onPress={handleShare} fontWeight="800">Share</Button>
                            </XStack>
                        </>
                    ) : (
                        <XStack gap="$2" width="100%">
                            {onReclaim && (
                                <Button
                                    flex={1}
                                    onPress={onReclaim}
                                    theme="gray"
                                    size="$5"
                                    fontWeight="800"
                                    icon={isReclaiming ? <Spinner size="small" /> : <RotateCcw size={18} />}
                                    disabled={isReclaiming}
                                >
                                    {isReclaiming ? '' : 'Reclaim'}
                                </Button>
                            )}
                            <Button
                                flex={1}
                                onPress={handleShare}
                                theme="gray"
                                size="$5"
                                fontWeight="800"
                                icon={<Share2 size={18} />}
                            />
                            <Button
                                flex={2}
                                onPress={handleCopy}
                                size="$5"
                                theme="accent"
                                fontWeight="800"
                                icon={copied ? <Check size={18} /> : <Copy size={18} />}
                            >
                                {copied ? 'Copied!' : 'Copy Token'}
                            </Button>
                        </XStack>
                    )}
                </YStack>
            )}
        </YStack>
    );
}

function DetailItem({ label, value, isCopyable, copyValue, onCopy }: { label: string, value: string, isCopyable?: boolean, copyValue?: string, onCopy?: () => void }) {
    return (
        <XStack justify="space-between" items="center" py="$3" px="$4">
            <Text fontSize="$4" color="$gray10" fontWeight="600">{label}</Text>
            <XStack gap="$2" items="center">
                <Text fontSize="$5" fontWeight="800" color="$color" numberOfLines={1} style={{ maxWidth: 200 }}>
                    {value}
                </Text>
                {isCopyable && (
                    <Button size="$2" chromeless icon={<Copy size={16} color="$gray10" />} onPress={onCopy} />
                )}
            </XStack>
        </XStack>
    );
}
