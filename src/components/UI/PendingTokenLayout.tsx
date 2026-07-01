import React, { useEffect, useState, useRef } from 'react';
import { YStack, XStack, Text, Button, Separator, View, ScrollView, useTheme } from "tamagui";
import { Copy, Share2, Check, RotateCcw, Hexagon, Gauge, ZoomIn, ArrowDownLeft, Share, Nfc, Globe } from "@tamagui/lucide-icons";
import { Buffer } from 'buffer';
import * as Haptics from 'expo-haptics';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { Share as RNShare, Platform } from 'react-native';
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
import { nfcService } from '~/services/nfcService';
import { ProcessingSheet, ProcessingStatus } from './ProcessingSheet';
import { useAuthStore } from '~/store/authStore';

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
    onNfcPress?: () => void;
    expiresAt?: number;
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
    onNfcPress,
    expiresAt,
}: PendingTokenLayoutProps) {
    const toast = useToastController();
    const { primaryCurrency, secondaryCurrency, npub } = useSettingsStore();
    const theme = useTheme();
    const { setLockDisabled } = useAuthStore();

    const [copied, setCopied] = useState(false);
    const [currentToken, setCurrentToken] = useState<string>(token || '');
    const [qrCodeFragment, setQrCodeFragment] = useState<string>(token || '');
    const [showAnimatedQR, setShowAnimatedQR] = useState(true);
    const [fragmentLength, setFragmentLength] = useState(150);
    const [intervalMs, setIntervalMs] = useState(150);
    const encoderRef = useRef<UREncoder | null>(null);
    const [tokenVersion, setTokenVersion] = useState<'V3' | 'V4'>(token?.startsWith('cashuB') ? 'V4' : 'V3');

    const [timeLeftStr, setTimeLeftStr] = useState<string | null>(null);

    useEffect(() => {
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

    // Optional internal parsing for p2pk if lockedToNpub not passed
    const [parsedNpub, setParsedNpub] = useState<string | null>(lockedToNpub || null);

    const MAX_STATIC_QR_LENGTH = 1000;

    const [showNfcSheet, setShowNfcSheet] = useState(false);
    const [nfcStatus, setNfcStatus] = useState<ProcessingStatus>('processing');
    const [nfcMessage, setNfcMessage] = useState('Preparing to send...');
    const [nfcError, setNfcError] = useState<string | undefined>(undefined);
    const simulationRef = useRef<any>(null);

    const handleNfcShare = async () => {
        if (!currentToken) return;

        setShowNfcSheet(true);
        setNfcStatus('processing');
        setNfcMessage('Checking NFC status...');

        try {
            const enabled = await nfcService.isEnabled();
            if (!enabled) {
                setNfcStatus('error');
                setNfcMessage('NFC is disabled');
                setNfcError('Please enable NFC in your device settings.');
                return;
            }

            if (Platform.OS === 'android') {
                setNfcMessage('Broadcasting... Hold near receiver phone.');
                const session = await nfcService.startHceSimulation(currentToken);
                simulationRef.current = session;
            } else {
                setNfcMessage('Approach physical tag to write...');
                await nfcService.writeNdefTag(currentToken);
                setNfcStatus('success');
                setNfcMessage('Token written to tag!');
            }
        } catch (e: any) {
            console.error('NFC share error:', e);
            setNfcStatus('error');
            setNfcMessage('NFC Share Failed');
            setNfcError(e.message || 'An error occurred during NFC transmission.');
        }
    };

    const handleWriteToTag = async () => {
        if (simulationRef.current) {
            await nfcService.stopHceSimulation(simulationRef.current);
            simulationRef.current = null;
        }
        setNfcStatus('processing');
        setNfcMessage('Approach physical tag to write...');
        try {
            await nfcService.writeNdefTag(currentToken);
            setNfcStatus('success');
            setNfcMessage('Token written to tag!');
        } catch (e: any) {
            console.error('NFC write error:', e);
            setNfcStatus('error');
            setNfcMessage('NFC Write Failed');
            setNfcError(e.message || 'An error occurred during NFC transmission.');
        }
    };

    const handleCloseNfc = async () => {
        setShowNfcSheet(false);
        if (simulationRef.current) {
            await nfcService.stopHceSimulation(simulationRef.current);
            simulationRef.current = null;
        }
    };

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
        if (!currentToken || currentToken.startsWith('http')) return;

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
            if (currentToken.startsWith('http')) {
                setQrCodeFragment(currentToken);
                return;
            }

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
            setLockDisabled(true);

            const shareMessage = currentToken.startsWith('http')
                ? `Claim my ecash send of ${amount} sats:\n\n${currentToken}`
                : `Claim my ecash send of ${amount} sats:\n\n${Linking.createURL('/(modals)/receive', { queryParams: { scannedToken: currentToken } })}`;

            await RNShare.share({
                message: shareMessage,
                title: 'Share Token'
            });
        } catch (error) {
            handleCopy();
        } finally {
            setTimeout(() => setLockDisabled(false), 1000);
        }
    };

    const [isPublishing, setIsPublishing] = useState(false);

    const handlePublishToWeb = async () => {
        if (!currentToken || currentToken.startsWith('http')) return;
        
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setIsPublishing(true);
        try {
            // 1. Generate 32 bytes random secret_key
            const secretKeyBytes = global.crypto.getRandomValues(new Uint8Array(32));
            const secretKeyHex = Buffer.from(secretKeyBytes).toString('hex');
            
            // 2. Build Nostr event containing the Cashu token
            const { buildEcashNostrEvent } = require('~/utils/ecashSharing');
            const { event } = buildEcashNostrEvent(cleanToken(currentToken), secretKeyHex);
            
            // 3. Publish to relays
            const { SimplePool } = require('nostr-tools');
            const { RELAYS } = require('~/services/core/nostrService');
            const pool = new SimplePool();
            await Promise.any(pool.publish(RELAYS, event));
            pool.close(RELAYS);
            
            // 4. Construct share link
            const websiteUrl = 'https://bey.cash/c/';
            const shareLink = `${websiteUrl}#${secretKeyHex}`;
            
            setCurrentToken(shareLink);
            toast.show('Published!', { message: 'Token published on bey.cash' });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (e: any) {
            console.error('[PendingTokenLayout] Publish to web failed:', e);
            toast.show('Publish Failed', { message: e?.message || 'Could not publish to Nostr relays' });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
            setIsPublishing(false);
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

                {/* Quick Share Actions */}
                <XStack gap="$3" width="100%" justify="center" py="$2">
                    {/* NFC Share */}
                    <YStack items="center" gap="$1" flex={1}>
                        <Button
                            bg="$gray3"
                            borderWidth={1}
                            borderColor="$borderColor"

                            size="$6"
                            circular
                            items="center"
                            justify="center"
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                if (onNfcPress) onNfcPress();
                                else handleNfcShare();
                            }}
                            pressStyle={{ scale: 0.95, bg: "$gray4" }}
                            icon={<Nfc size={20} color="$color" />}
                        />
                        <Text fontSize={10} fontWeight="700" color="$gray10" textTransform="uppercase" letterSpacing={0.5}>NFC</Text>
                    </YStack>

                    {/* Nostr Send */}
                    <YStack items="center" gap="$1" flex={1}>
                        <Button
                            bg="$gray3"
                            borderWidth={1}
                            borderColor="$borderColor"

                            size="$6"
                            circular
                            items="center"
                            justify="center"
                            disabled={!!displayNpub}
                            opacity={displayNpub ? 0.3 : 1}
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                toast.show('Nostr Send', { message: 'Nostr sending is not implemented yet' });
                            }}
                            pressStyle={{ scale: 0.95, bg: "$gray4" }}
                            icon={<NostrIcon size={22} color="$color" />}
                        />
                        <Text fontSize={10} fontWeight="700" color="$gray10" textTransform="uppercase" letterSpacing={0.5}>Nostr</Text>
                    </YStack>

                    {/* Share Link */}
                    <YStack items="center" gap="$1" flex={1}>
                        <Button
                            bg="$gray3"
                            borderWidth={1}
                            borderColor="$borderColor"

                            size="$6"
                            circular
                            items="center"
                            justify="center"
                            onPress={handleShare}
                            pressStyle={{ scale: 0.95, bg: "$gray4" }}
                            icon={<Share2 size={20} color="$color" />}
                        />
                        <Text fontSize={10} fontWeight="700" color="$gray10" textTransform="uppercase" letterSpacing={0.5}>Share</Text>
                    </YStack>

                    {/* Copy Token */}
                    <YStack items="center" gap="$1" flex={1}>
                        <Button
                            bg="$gray3"
                            borderWidth={1}
                            borderColor="$borderColor"

                            size="$6"
                            circular
                            items="center"
                            justify="center"
                            onPress={handleCopy}
                            pressStyle={{ scale: 0.95, bg: "$gray4" }}
                            icon={copied ? <Check size={20} color="$green10" /> : <Copy size={20} color="$color" />}
                        />
                        <Text fontSize={10} fontWeight="700" color="$gray10" textTransform="uppercase" letterSpacing={0.5}>Copy</Text>
                    </YStack>
                </XStack>
            </YStack>

            {/* Submit to Web Button (if raw Cashu token) */}
            {!currentToken.startsWith('http') && (
                <Button
                    size="$5"
                    bg="$purple10"
                    color="white"
                    fontWeight="800"
                    rounded="$5"
                    mx="$1"
                    icon={isPublishing ? <Spinner size="small" color="white" /> : <Globe size={20} />}
                    onPress={handlePublishToWeb}
                    disabled={isPublishing}
                    pressStyle={{ scale: 0.97, bg: "$purple11" }}
                >
                    {isPublishing ? 'Publishing...' : 'Publish on bey.cash'}
                </Button>
            )}

            {/* Link Text Display */}
            {currentToken.startsWith('http') && (
                <YStack bg="$gray3" p="$3" rounded="$5" mx="$1" gap="$1" items="center" borderStyle="dashed" borderWidth={1} borderColor="$gray6">
                    <Text fontSize="$2" color="$gray9" fontWeight="700" textTransform="uppercase" letterSpacing={1}>eCash Sharing Link</Text>
                    <Text fontSize="$3" color="$accent5" fontWeight="800" numberOfLines={1} text="center" style={{ maxWidth: '95%' }}>
                        {currentToken}
                    </Text>
                </YStack>
            )}

            {/* Details Table */}
            {!hideDetails && (
                <YStack gap="$0" bg="$gray2" rounded="$5" overflow="hidden" separator={<Separator borderColor="$borderColor" opacity={0.5} />}>
                    {primaryCurrency === 'FIAT' ? (
                        <>
                            <DetailItem label="Amount" value={btcData?.price ? currencyService.formatValue(currencyService.convertSatsToCurrency(Number(amount), btcData.price), secondaryCurrency as CurrencyCode) : '...'} />
                            <DetailItem label="Sats" value={`₿${amount} sats`} />
                        </>
                    ) : (
                        <>
                            <DetailItem label="Amount" value={`₿${amount} sats`} />
                            <DetailItem label="Fiat" value={btcData?.price ? currencyService.formatValue(currencyService.convertSatsToCurrency(Number(amount), btcData.price), secondaryCurrency as CurrencyCode) : '...'} />
                        </>
                    )}
                    {fee > 0 && <DetailItem label="Fee" value={`₿${fee} sats`} />}
                    <DetailItem label="Expiry" value={expiresAt ? (timeLeftStr || 'Checking...') : 'Never'} />
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
                    {currentToken.startsWith('http') && (
                        <DetailItem
                            label="Web Link"
                            value={`${currentToken.slice(0, 18)}…${currentToken.slice(-6)}`}
                            isCopyable
                            onCopy={async () => {
                                await Clipboard.setStringAsync(currentToken);
                                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                toast.show('Copied!', { message: 'Web share link copied to clipboard' });
                            }}
                        />
                    )}
                </YStack>
            )}

            {/* Action Buttons */}
            {!hideActions && (
                <YStack mt="auto" pb="$8" gap="$4">
                    {onClaim ? (
                        <Button
                            bg="$accent10"
                            hoverStyle={{ bg: "$accent11" }}
                            color="white"
                            size="$5"
                            height={55}
                            rounded="$5"
                            onPress={onClaim}
                            disabled={isClaiming}
                            icon={isClaiming ? <Spinner size="small" color="white" /> : <ArrowDownLeft size={20} color="white" />}
                            fontWeight="800"
                        >
                            CLAIM NOW
                        </Button>
                    ) : (
                        onReclaim && (
                            <Button
                                onPress={onReclaim}
                                theme="gray"
                                size="$5"
                                height={55}
                                rounded="$5"
                                fontWeight="800"
                                icon={isReclaiming ? <Spinner size="small" /> : <RotateCcw size={18} />}
                                disabled={isReclaiming}
                            >
                                {isReclaiming ? 'Reclaiming...' : 'Reclaim'}
                            </Button>
                        )
                    )}
                </YStack>
            )}
            <ProcessingSheet
                visible={showNfcSheet}
                status={nfcStatus}
                title={nfcMessage}
                errorMessage={nfcError}
                variant="nfc"
                onClose={handleCloseNfc}
                detail={
                    Platform.OS === 'android' && nfcStatus === 'processing' ? (
                        <Button size="$3" theme="orange" onPress={handleWriteToTag} mt="$2">
                            Write to Physical Tag instead
                        </Button>
                    ) : null
                }
            />
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
