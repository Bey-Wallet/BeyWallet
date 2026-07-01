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
import { walletService, mintManager, historyService } from '../services/core';
import { useWalletStore } from '../store/walletStore';
import { useSettingsStore } from '../store/settingsStore';
import { nip19 } from 'nostr-tools';
import { nostrRequestStore } from '../store/nostrRequestStore';
import { Image } from 'tamagui';
import { useToastController } from '@tamagui/toast';
import { useRouter, usePathname } from 'expo-router';

const nostrIcon = require('../assets/images/nostr-icon-white-transparent.png');

function hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
    }
    return bytes;
}

function safeNpubEncode(pubkey: string): string {
    if (!pubkey) return '';
    if (pubkey.startsWith('npub1')) return pubkey;
    if (pubkey.startsWith('nprofile1')) {
        try {
            const decoded = nip19.decode(pubkey);
            if (decoded.type === 'nprofile') {
                return nip19.npubEncode(hexToBytes(decoded.data.pubkey));
            }
        } catch {}
        return pubkey;
    }
    // Assume hex
    try {
        return nip19.npubEncode(hexToBytes(pubkey));
    } catch {
        return pubkey;
    }
}

export function NostrClaimSheet() {
    const sheetRef = useRef<AppBottomSheetRef>(null);
    const toast = useToastController();
    const router = useRouter();
    const pathname = usePathname();
    const [activeItem, setActiveItem] = useState<NostrInboxItem | null>(null);
    const [claimStatus, setClaimStatus] = useState<'idle' | 'claiming' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState('');

    const addIncoming = useNostrInboxStore(s => s.addIncoming);
    const markClaiming = useNostrInboxStore(s => s.markClaiming);
    const markClaimed = useNostrInboxStore(s => s.markClaimed);
    const markFailed = useNostrInboxStore(s => s.markFailed);
    const dismiss = useNostrInboxStore(s => s.dismiss);
    const storeItems = useNostrInboxStore(s => s.items);
    const refreshBalance = useWalletStore(s => s.refreshBalance);
    const settingsNsec = useSettingsStore(s => s.nsec);

    // Listen for incoming Nostr payments
    useEffect(() => {
        const subscription = DeviceEventEmitter.addListener(
            'nostr:incoming',
            async (data: {
                eventId: string;
                tokenString: string;
                amount: number;
                mintUrl: string;
                senderPubkey: string;
                senderUsername?: string;
                requestId?: string;
            }) => {
                // Skip items already claimed/dismissed in persistent store
                const existing = useNostrInboxStore.getState().items.find(i => i.id === data.eventId);
                if (existing && (existing.status === 'claimed' || existing.status === 'claiming')) {
                    console.log(`[NostrClaimSheet] Skipping already ${existing.status} event ${data.eventId.slice(0, 8)}`);
                    return;
                }

                // Ensure pending requests are loaded from DB
                const { useNostrRequestStore } = require('../store/nostrRequestStore');
                try {
                    await useNostrRequestStore.getState().loadPendingRequests();
                } catch (loadErr) {
                    console.warn('[NostrClaimSheet] Failed to load pending requests on incoming event:', loadErr);
                }

                const pending = useNostrRequestStore.getState().pendingRequests;
                const matchingRequest = pending.find(
                    (r: any) => (data.requestId && r.id === data.requestId) ||
                         (Number(r.amount) === Number(data.amount) && r.mintUrl.replace(/\/$/, '') === data.mintUrl.replace(/\/$/, '') && r.state === 'pending')
                );

                if (matchingRequest) {
                    console.log('[NostrClaimSheet] Matches pending request! Auto-claiming...');
                    toast.show('Claiming payment...', { message: 'Auto-claiming requested payment' });
                    
                    // Add to inbox store
                    addIncoming({
                        id: data.eventId,
                        tokenString: data.tokenString,
                        amount: data.amount,
                        mintUrl: data.mintUrl,
                        senderPubkey: data.senderPubkey,
                        senderUsername: data.senderUsername,
                    });
                    
                    markClaiming(data.eventId);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

                    try {
                        // Ensure mint is trusted
                        await mintManager.addMint(data.mintUrl, { trusted: true });

                        // Decrypt private key
                        let privkeyHex: string | null = null;
                        if (settingsNsec) {
                            try {
                                if (settingsNsec.startsWith('nsec')) {
                                    const decoded = nip19.decode(settingsNsec);
                                    const bytes = decoded.data as Uint8Array;
                                    privkeyHex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
                                } else {
                                    privkeyHex = settingsNsec;
                                }
                            } catch { /* ignore */ }
                        }

                        let received = false;
                        if (privkeyHex) {
                            try {
                                await walletService.receiveP2PK(data.tokenString, privkeyHex);
                                received = true;
                                console.log(`[NostrClaimSheet] Auto-claim: ✅ P2PK receive success: ${data.amount} sats`);
                            } catch (p2pkErr: any) {
                                const errMsg = p2pkErr?.message ?? '';
                                const isP2PKError = errMsg.includes('locked') || errMsg.includes('P2PK') ||
                                    errMsg.includes('public key') || errMsg.includes('Witness') ||
                                    errMsg.includes('signature');

                                if (errMsg.includes('already spent') || p2pkErr?.code === 11001) {
                                    console.log(`[NostrClaimSheet] Auto-claim: Token already spent — treating as claimed`);
                                    received = true;
                                } else if (!isP2PKError) {
                                    // Not P2PK locked — try standard receive
                                    await walletService.receive(data.tokenString);
                                    received = true;
                                    console.log(`[NostrClaimSheet] Auto-claim: ✅ Standard receive success: ${data.amount} sats`);
                                } else {
                                    throw p2pkErr;
                                }
                            }
                        } else {
                            try {
                                await walletService.receive(data.tokenString);
                                received = true;
                                console.log(`[NostrClaimSheet] Auto-claim: ✅ Standard receive success (no key): ${data.amount} sats`);
                            } catch (stdErr: any) {
                                if (stdErr?.message?.includes('already spent') || stdErr?.code === 11001) {
                                    console.log(`[NostrClaimSheet] Auto-claim: Token already spent — treating as claimed`);
                                    received = true;
                                } else {
                                    throw stdErr;
                                }
                            }
                        }

                        if (received) {
                            markClaimed(data.eventId);
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            refreshBalance();

                            // Mark request as received
                            await useNostrRequestStore.getState().markReceived(matchingRequest.id);

                            // Tag history with sender info
                            try {
                                const senderNpub = data.senderPubkey
                                    ? safeNpubEncode(data.senderPubkey)
                                    : undefined;
                                
                                await historyService.tagHistoryVia(
                                    data.mintUrl,
                                    'receive',
                                    'nostr',
                                    {
                                        nostrPubkey: senderNpub,
                                        nostrUsername: data.senderUsername ? data.senderUsername.replace('@bey.cash', '') : undefined
                                    }
                                );
                            } catch (tagErr) {
                                console.warn('[NostrClaimSheet] Failed to tag history on auto-claim:', tagErr);
                            }

                            // Emit received event
                            DeviceEventEmitter.emit('nostr:received', {
                                amount: data.amount,
                                mintUrl: data.mintUrl,
                                eventId: data.eventId,
                                senderPubkey: data.senderPubkey,
                                requestId: data.requestId,
                            });

                            toast.show('Payment Received! 🎉', { message: `₿${data.amount} sats claimed automatically` });

                            // Fetch the history database after a short delay to get the transaction ID and navigate to details
                            setTimeout(async () => {
                                try {
                                    const history = await historyService.getHistory(5, 0);
                                    // Find entry that matches this mint and amount
                                    const entry = history.find(
                                        (e: any) => e.type === 'receive' && Number(e.amount) === Number(data.amount) && e.mintUrl.replace(/\/$/, '') === data.mintUrl.replace(/\/$/, '')
                                    );
                                    if (entry) {
                                        // Only redirect if NOT on the receive screen (to let RequestEcashStage handle it cleanly)
                                        if (!pathname.includes('receive')) {
                                            router.push({
                                                pathname: '/(modals)/txn-details',
                                                params: { id: entry.id }
                                            });
                                        }
                                    } else {
                                        if (!pathname.includes('receive')) {
                                            router.push('/(tabs)/history');
                                        }
                                    }
                                } catch (navErr) {
                                    console.warn('[NostrClaimSheet] Navigation to details failed:', navErr);
                                }
                            }, 800);
                        }
                    } catch (err: any) {
                        console.error('[NostrClaimSheet] Auto-claim failed:', err);
                        markFailed(data.eventId, err?.message || 'Failed to auto-claim');
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                        toast.show('Auto-claim Failed', { message: err.message || 'Could not claim requested payment' });
                    }
                    return; // Stop here since it was handled
                }

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
    }, [addIncoming, settingsNsec, markClaiming, markClaimed, markFailed, refreshBalance, router]);

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

                    if (errMsg.includes('already spent') || p2pkErr?.code === 11001) {
                        // Token was already claimed (e.g. in a previous session).
                        // Mark as claimed and show success instead of error.
                        console.log(`[NostrClaimSheet] Token already spent — marking as claimed`);
                        markClaimed(activeItem.id);
                        setClaimStatus('success');
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        setTimeout(() => {
                            sheetRef.current?.dismiss();
                            setActiveItem(null);
                            setClaimStatus('idle');
                        }, 1500);
                        return;
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
                try {
                    await walletService.receive(activeItem.tokenString);
                    received = true;
                } catch (stdErr: any) {
                    if (stdErr?.message?.includes('already spent') || stdErr?.code === 11001) {
                        console.log(`[NostrClaimSheet] Token already spent — marking as claimed`);
                        markClaimed(activeItem.id);
                        setClaimStatus('success');
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        setTimeout(() => {
                            sheetRef.current?.dismiss();
                            setActiveItem(null);
                            setClaimStatus('idle');
                        }, 1500);
                        return;
                    }
                    throw stdErr;
                }
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
                    requestId: activeItem.requestId || match?.id,
                });

                // Tag history with sender info
                try {
                    const senderNpub = activeItem.senderPubkey
                        ? safeNpubEncode(activeItem.senderPubkey)
                        : undefined;
                    
                    historyService.tagHistoryVia(
                        activeItem.mintUrl,
                        'receive',
                        'nostr',
                        {
                            nostrPubkey: senderNpub,
                            nostrUsername: activeItem.senderUsername ? activeItem.senderUsername.replace('@bey.cash', '') : undefined
                        }
                    ).catch((e: any) => console.warn('[NostrClaimSheet] Failed to tag history:', e));
                } catch (e) {
                    console.warn('[NostrClaimSheet] Failed to tag history:', e);
                }

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
            dismiss(activeItem.id);
            setActiveItem(null);
            setClaimStatus('idle');
        }
    }, [activeItem, claimStatus, dismiss]);

    const senderDisplay = activeItem?.senderUsername ||
        (activeItem?.senderPubkey ? (() => {
            const npub = safeNpubEncode(activeItem.senderPubkey);
            return `${npub.slice(0, 10)}...${npub.slice(-6)}`;
        })() : 'Unknown');

    const senderNpub = activeItem?.senderPubkey ? safeNpubEncode(activeItem.senderPubkey) : '';

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
                            <Text fontSize={36} fontWeight="900" color="$color1" letterSpacing={-1}>
                                +₿{activeItem?.amount?.toLocaleString() ?? 0}
                            </Text>
                            <Text fontSize="$3" color="$gray10">sats</Text>
                        </YStack>

                        {/* Details */}
                        <Theme inverse>
                            <YStack width="100%" gap="$0" borderWidth={1} borderColor="$borderColor" rounded="$4" overflow="hidden">
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
                        </Theme>

                        {/* Error message */}
                        {claimStatus === 'error' && (
                            <YStack bg="$red3" p="$3" rounded="$3" width="100%">
                                <Text color="$red11" fontSize="$3" textAlign="center">{errorMessage}</Text>
                            </YStack>
                        )}

                        {/* Success message */}
                        {claimStatus === 'success' && (
                            <Theme inverse >

                                <YStack bg="$green3" p="$3" rounded="$3" width="100%">
                                    <Text color="$green11" fontSize="$3" fontWeight="700" textAlign="center">
                                        ✅ Payment claimed successfully!
                                    </Text>
                                </YStack>
                            </Theme>
                        )}

                        {/* Action buttons */}
                        {claimStatus !== 'success' && (
                            <XStack width="100%" gap="$3">
                                <Button
                                    flex={1}
                                    themeInverse
                                    size="$5"
                                    fontWeight="700"
                                    rounded="$4"
                                    onPress={handleDismiss}
                                    disabled={claimStatus === 'claiming'}
                                    pressStyle={{ scale: 0.97 }}
                                >
                                    Delete
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
