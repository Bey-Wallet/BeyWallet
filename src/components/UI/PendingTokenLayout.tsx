import React, { useEffect, useState, useRef } from 'react';
import { YStack, XStack, Text, Button, Separator, View, ScrollView, useTheme } from "tamagui";
import { Copy, Share2, Check, RotateCcw, Hexagon, Gauge, ZoomIn, ArrowDownLeft, Share, Nfc } from "@tamagui/lucide-icons";
import { Buffer } from 'buffer';
import * as Haptics from 'expo-haptics';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { Share as RNShare } from 'react-native';
import { useToastController } from '@tamagui/toast';
import * as Linking from 'expo-linking';

import { Spinner } from './Spinner';

import { UR, UREncoder } from "@gandlaf21/bc-ur";
import { useSettingsStore } from '~/store/settingsStore';
import { useQuery } from '@tanstack/react-query';
import { bitcoinService } from '~/services/bitcoinService';
import { currencyService, CurrencyCode } from '~/services/currencyService';
import { cleanToken, decodeToken, encodeTokenV4, encodeTokenV3 } from '~/services/core';
import { nip19 } from 'nostr-tools';
import NFCFillIcon from '~/components/icons/NFC-fill';
import NostrIcon from '~/components/icons/NostrIcon';

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
    const theme = useTheme();

    const [copied, setCopied] = useState(false);
    const [currentToken, setCurrentToken] = useState<string>(token || '');
    const [qrCodeFragment, setQrCodeFragment] = useState<string>(token || '');
    const [showAnimatedQR, setShowAnimatedQR] = useState(true);
    const [fragmentLength, setFragmentLength] = useState(150);
    const [intervalMs, setIntervalMs] = useState(150);
    const encoderRef = useRef<UREncoder | null>(null);
    const [tokenVersion, setTokenVersion] = useState<'V3' | 'V4'>(token?.startsWith('cashuB') ? 'V4' : 'V3');

    // Optional internal parsing for p2pk if lockedToNpub not passed
    const [parsedNpub, setParsedNpub] = useState<string | null>(lockedToNpub || null);

    const MAX_STATIC_QR_LENGTH = 1000;

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

    // Effect 1: Detect proof count + p2pk from token — only runs when token changes.
    // Sets showAnimatedQR if >2 proofs (matches cashu.me behaviour) but does NOT
    // depend on showAnimatedQR itself, avoiding an infinite loop.
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
                        if (hexPubkey) setParsedNpub(nip19.npubEncode(hexPubkey));
                    } catch (e) { }
                }
            }

            // Always use animated QR as requested by user
        } catch (e) {
            console.error('[PendingTokenLayout] Failed to decode token:', e);
        }
    }, [currentToken, lockedToNpub]);

    // Effect 2: Build QR / UR encoder whenever token, mode, or fragment params change.
    // Does NOT set showAnimatedQR — reads it as a stable value from Effect 1.
    useEffect(() => {
        if (!currentToken) return;

        try {
            const clean = cleanToken(currentToken);

            if (showAnimatedQR) {
                // Match cashu.me exactly: UR.fromBuffer(Buffer.from(tokenString))
                // Raw token string bytes — no CBOR wrapping — compatible with all UR scanners
                const ur = UR.fromBuffer(Buffer.from(clean));
                encoderRef.current = new UREncoder(ur, fragmentLength, 0);
                setQrCodeFragment(encoderRef.current.nextPart());
            } else {
                // Static mode: plain token string — readable by all wallets
                setQrCodeFragment(clean);
            }
        } catch (e) {
            console.error('[PendingTokenLayout] Failed to setup QR:', e);
            setQrCodeFragment(currentToken);
        }
    }, [currentToken, fragmentLength, showAnimatedQR]);

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
            await RNShare.share({
                message: currentToken,
                title: 'Share Token'
            });
        } catch (error) {
            handleCopy();
        }
    };



    const displayNpub = lockedToNpub || parsedNpub;

    return (
        <YStack flex={1} bg="$background" gap="$3" width="100%">
            {/* QR Code */}
            <YStack items="center" gap="$3" >
                <View bg="white" p="$2" borderWidth={1} borderColor="$borderColor" rounded="$5">
                    {qrCodeFragment ? (
                        qrCodeFragment.length > MAX_STATIC_QR_LENGTH ? (
                            <YStack width={330} height={330} items="center" justify="center" px="$4">
                                <Gauge size={50} color="$orange8" opacity={0.5} />
                                <Text mt="$4" color="$gray10" text="center" fontWeight="600">
                                    Token too large
                                </Text>
                                <Text mt="$2" color="$gray9" text="center" fontSize="$2" px="$4">
                                    Please enable Animated QR (UR) or switch to V4 encoding to make it smaller.
                                </Text>
                            </YStack>
                        ) : (
                            <QRCode
                                value={qrCodeFragment}
                                size={330}
                                backgroundColor="white"
                                color="black"
                                quietZone={10}
                            />
                        )
                    ) : (
                        <YStack width={330} height={330} items="center" justify="center">
                            <Spinner size="large" color="$color" />
                        </YStack>
                    )}
                </View>

                {/* Quick Share Actions moved here */}
                <XStack gap="$2" width="100%" justify="center" >
                    <Button
                        flex={1}
                        theme="orange"
                        size="$5"
                        fontWeight="700"
                        icon={<Nfc size={24} />}
                        rounded="$4"
                        py="$6"
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            toast.show('NFC Share', { message: 'NFC sharing is not implemented yet' });
                        }}
                    />
                    <Button
                        flex={1}
                        theme="purple"
                        size="$5"
                        fontWeight="700"
                        icon={<NostrIcon size={28} />}
                        disabled={!!displayNpub}
                        opacity={displayNpub ? 0.5 : 1}
                        rounded="$4"
                        py="$6"
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            toast.show('Nostr Send', { message: 'Nostr sending is not implemented yet' });
                        }}
                    />
                    <Button
                        flex={1}
                        onPress={handleShare}
                        theme="teal"
                        size="$5"
                        fontWeight="800"
                        icon={<Share2 size={24} strokeWidth={2} />}
                        rounded="$4"
                        py="$6"
                    />
                    <Button
                        flex={1}
                        onPress={handleCopy}
                        theme="gray"
                        size="$5"
                        fontWeight="800"
                        icon={copied ? <Check size={24} /> : <Copy size={24} />}
                        rounded="$4"
                        py="$6"
                    />
                </XStack>
            </YStack>

            {/* Details Table */}
            {!hideDetails && (
                <YStack gap="$0" bg="$gray2" rounded="$5" overflow="hidden" separator={<Separator borderColor="$borderColor" opacity={0.5} />}>
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
                                flex={2}
                                onPress={handleCopy}
                                size="$5"
                                theme="gray"
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
