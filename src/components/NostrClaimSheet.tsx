/**
 * NostrClaimSheet
 *
 * Bottom sheet that appears when a Nostr payment arrives. Shows sender info,
 * amount, mint details, and lets the user inspect before claiming.
 * Uses ProcessingSheet for the claiming animation.
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { YStack, XStack, Text, Button, View, Separator, Theme } from 'tamagui';
import { ArrowDownLeft, Building2, User, ShieldCheck, Zap } from '@tamagui/lucide-icons';
import AppBottomSheet, { AppBottomSheetRef } from './UI/AppBottomSheet';
import { ProcessingSheet } from './UI/ProcessingSheet';
import Blockies from './UI/Blockies';
import * as Haptics from 'expo-haptics';
import { useNostrInboxStore, type NostrInboxItem } from '../store/nostrInboxStore';
import { walletService, mintManager } from '../services/core';
import { useWalletStore } from '../store/walletStore';
import { useSettingsStore } from '../store/settingsStore';
import { nip19 } from 'nostr-tools';
import { nostrRequestStore } from '../store/nostrRequestStore';
import { Image } from 'tamagui';

const nostrIcon = require('../assets/images/nostr-icon-white-transparent.png');

export function NostrClaimSheet() {
    const sheetRef = useRef<AppBottomSheetRef>(null);
    const [activeItem, setActiveItem] = useState<NostrInboxItem | null>(null);
    const [claimStatus, setClaimStatus] = useState<'idle' | 'claiming' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState('');

    const addIncoming = useNostrInboxStore(s => s.addIncoming);
    const markClaiming = useNostrInboxStore(s => s.markClaiming);
    const markClaimed = useNostrInboxStore(s => s.markClaimed);
    const markFailed = useNostrInboxStore(s => s.markFailed);
    const dismiss = useNostrInboxStore(s => s.dismiss);
    const refreshBalance = useWalletStore(s => s.refreshBalance);
    const settingsNsec = useSettingsStore(s => s.nsec);

    // Listen for incoming Nostr payments
    useEffect(() => {
        const subscription = DeviceEventEmitter.addListener(
            'nostr:incoming',
            (data: {
                eventId: string;
                tokenString: string;
                amount: number;
                mintUrl: string;
                senderPubkey: string;
                senderUsername?: string;
                requestId?: string;
            }) => {
                console.log('[NostrClaimSheet] Incoming payment:', data.amount, 'sats');
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

                // Add to inbox store
                addIncoming({
                    id: data.eventId,
                    tokenString: data.tokenString,
                    amount: data.amount,
                    mintUrl: data.mintUrl,
                    senderPubkey: data.senderPubkey,
                    senderUsername: data.senderUsername,
                });

                // Show claim sheet for this item
                setActiveItem({
                    id: data.eventId,
                    tokenString: data.tokenString,
                    amount: data.amount,
                    mintUrl: data.mintUrl,
                    senderPubkey: data.senderPubkey,
                    senderUsername: data.senderUsername,
                    receivedAt: Date.now(),
                    status: 'pending',
                    seen: false,
                });
                setClaimStatus('idle');
                setErrorMessage('');
                sheetRef.current?.present();
            }
        );

        return () => subscription.remove();
    }, [addIncoming]);

    // Also allow opening from NostrActivity (via event)
    useEffect(() => {
        const subscription = DeviceEventEmitter.addListener(
            'nostr:openClaim',
            (item: NostrInboxItem) => {
                setActiveItem(item);
                setClaimStatus('idle');
                setErrorMessage('');
                sheetRef.current?.present();
            }
        );
        return () => subscription.remove();
    }, []);

    const handleClaim = useCallback(async () => {
        if (!activeItem) return;

        setClaimStatus('claiming');
        markClaiming(activeItem.id);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

        try {
            // Ensure mint is trusted
            await mintManager.addMint(activeItem.mintUrl, { trusted: true });

            // Try P2PK receive first, then standard
            let privkeyHex: string | null = null;
            if (settingsNsec) {
                try {
                    if (settingsNsec.startsWith('nsec')) {
                        const decoded = nip19.decode(settingsNsec);
                        const bytes = decoded.data as Uint8Array;
                        privkeyHex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
                    } else {
                        privkeyHex = settingsNsec; // Already hex
                    }
                } catch { /* ignore */ }
            }
            let received = false;

            if (privkeyHex) {
                try {
                    await walletService.receiveP2PK(activeItem.tokenString, privkeyHex);
                    received = true;
                    console.log(`[NostrClaimSheet] ✅ P2PK receive success: ${activeItem.amount} sats`);
                } catch (p2pkErr: any) {
                    const errMsg = p2pkErr?.message ?? '';
                    const isP2PKError = errMsg.includes('locked') || errMsg.includes('P2PK') ||
                        errMsg.includes('public key') || errMsg.includes('Witness') ||
                        errMsg.includes('signature');

                    if (errMsg.includes('already spent')) {
                        throw new Error('This token has already been claimed.');
                    }

                    if (!isP2PKError) {
                        // Not P2PK locked — try standard receive
                        await walletService.receive(activeItem.tokenString);
                        received = true;
                        console.log(`[NostrClaimSheet] ✅ Standard receive success: ${activeItem.amount} sats`);
                    } else {
                        throw p2pkErr;
                    }
                }
            } else {
                // No private key — try standard receive
                await walletService.receive(activeItem.tokenString);
                received = true;
            }

            if (received) {
                markClaimed(activeItem.id);
                setClaimStatus('success');
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

                // Refresh balance
                refreshBalance();

                // Try to match pending nostr requests
                try {
                    const pending = nostrRequestStore.getPending();
                    const match = pending.find(
                        r => r.mintUrl.replace(/\/$/, '') === activeItem.mintUrl.replace(/\/$/, '') &&
                            r.amount === activeItem.amount &&
                            r.state === 'pending'
                    );
                    if (match) {
                        await nostrRequestStore.markReceived(match.id);
                    }
                } catch { /* non-fatal */ }

                // Emit received event for history/UI
                DeviceEventEmitter.emit('nostr:received', {
                    amount: activeItem.amount,
                    mintUrl: activeItem.mintUrl,
                    eventId: activeItem.id,
                    senderPubkey: activeItem.senderPubkey,
                });

                // Auto-dismiss after 2s
                setTimeout(() => {
                    sheetRef.current?.dismiss();
                    setActiveItem(null);
                    setClaimStatus('idle');
                }, 2000);
            }
        } catch (err: any) {
            console.error('[NostrClaimSheet] Claim failed:', err?.message || err);
            markFailed(activeItem.id, err?.message || 'Failed to claim');
            setClaimStatus('error');
            setErrorMessage(err?.message || 'Failed to claim payment');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
    }, [activeItem, settingsNsec, markClaiming, markClaimed, markFailed, refreshBalance]);

    const handleDismiss = useCallback(() => {
        sheetRef.current?.dismiss();
        if (activeItem && claimStatus !== 'claiming') {
            // Keep in inbox for later
            setActiveItem(null);
            setClaimStatus('idle');
        }
    }, [activeItem, claimStatus]);

    const senderDisplay = activeItem?.senderUsername ||
        (activeItem?.senderPubkey ? (() => {
            try {
                const npub = nip19.npubEncode(activeItem.senderPubkey);
                return `${npub.slice(0, 10)}...${npub.slice(-6)}`;
            } catch {
                return `${activeItem.senderPubkey.slice(0, 8)}...`;
            }
        })() : 'Unknown');

    const senderNpub = activeItem?.senderPubkey ? (() => {
        try { return nip19.npubEncode(activeItem.senderPubkey); } catch { return activeItem.senderPubkey; }
    })() : '';

    const mintDomain = activeItem?.mintUrl
        ? activeItem.mintUrl.replace(/^https?:\/\//, '').split('/')[0]
        : 'Unknown';

    if (!activeItem && claimStatus === 'idle') return null;

    return (
        <>
            <Theme inverse>
                <AppBottomSheet ref={sheetRef} onClose={() => { setActiveItem(null); setClaimStatus('idle'); }} enablePanDownToClose={claimStatus !== 'claiming'}>
                    <YStack p="$4" gap="$4" items="center">

                        {/* Nostr badge + sender info */}
                        <XStack items="center" gap="$3">
                            <View w={48} h={48} borderRadius={5} bg="$purple10" items="center" justify="center">
                                <Image source={nostrIcon} width={40} height={40} resizeMode="contain" />
                            </View>
                            <YStack>
                                <Text fontSize="$3" color="$gray10">Incoming Payment</Text>
                                <Text fontSize="$5" fontWeight="800" color="$color1">
                                    {senderDisplay}
                                </Text>
                            </YStack>
                        </XStack>

                        {/* Amount */}
                        <YStack items="center" gap="$1">
                            <Text fontSize={36} fontWeight="900" color="$green10" letterSpacing={-1}>
                                +₿{activeItem?.amount?.toLocaleString() ?? 0}
                            </Text>
                            <Text fontSize="$3" color="$gray10">sats</Text>
                        </YStack>

                        {/* Details */}
                        <YStack width="100%" gap="$0" bg="$gray3" rounded="$4" overflow="hidden">
                            <DetailRow
                                icon={<User size={16} color="$gray9" />}
                                label="From"
                                value={senderDisplay}
                            />
                            <Separator borderColor="$borderColor" opacity={0.3} />
                            <DetailRow
                                icon={<Building2 size={16} color="$gray9" />}
                                label="Mint"
                                value={mintDomain}
                            />
                            <Separator borderColor="$borderColor" opacity={0.3} />
                            <DetailRow
                                icon={<ShieldCheck size={16} color="$gray9" />}
                                label="Type"
                                value="Nostr DM"
                            />
                        </YStack>

                        {/* Error message */}
                        {claimStatus === 'error' && (
                            <YStack bg="$red3" p="$3" rounded="$3" width="100%">
                                <Text color="$red11" fontSize="$3" textAlign="center">{errorMessage}</Text>
                            </YStack>
                        )}

                        {/* Success message */}
                        {claimStatus === 'success' && (
                            <YStack bg="$green3" p="$3" rounded="$3" width="100%">
                                <Text color="$green11" fontSize="$3" fontWeight="700" textAlign="center">
                                    ✅ Payment claimed successfully!
                                </Text>
                            </YStack>
                        )}

                        {/* Action buttons */}
                        {claimStatus !== 'success' && (
                            <XStack width="100%" gap="$3">
                                <Button
                                    flex={1}
                                    bg="$gray4"
                                    color="$color"
                                    size="$5"
                                    fontWeight="700"
                                    rounded="$4"
                                    onPress={handleDismiss}
                                    disabled={claimStatus === 'claiming'}
                                    pressStyle={{ scale: 0.97 }}
                                >
                                    Dismiss
                                </Button>
                                <Button
                                    flex={2}
                                    bg="$green9"
                                    color="white"
                                    size="$5"
                                    fontWeight="800"
                                    rounded="$4"
                                    onPress={handleClaim}
                                    disabled={claimStatus === 'claiming'}
                                    icon={claimStatus === 'error' ? <Zap size={18} color="white" /> : <ArrowDownLeft size={18} color="white" />}
                                    pressStyle={{ scale: 0.97, opacity: 0.9 }}
                                >
                                    {claimStatus === 'error' ? 'Retry' : 'Claim Now'}
                                </Button>
                            </XStack>
                        )}
                    </YStack>
                </AppBottomSheet>
            </Theme>

            {/* ProcessingSheet overlay while claiming */}
            <ProcessingSheet
                visible={claimStatus === 'claiming'}
                status="processing"
                variant="nostr"
                title="Claiming..."
                amount={activeItem?.amount}
                detail={`Receiving from ${senderDisplay}`}
            />
        </>
    );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <XStack justify="space-between" items="center" px="$4" py="$3">
            <XStack gap="$2" items="center">
                {icon}
                <Text color="$gray10" fontSize="$3" fontWeight="500">{label}</Text>
            </XStack>
            <Text color="$color" fontSize="$3" fontWeight="700" numberOfLines={1} style={{ maxWidth: 180 }}>
                {value}
            </Text>
        </XStack>
    );
}
