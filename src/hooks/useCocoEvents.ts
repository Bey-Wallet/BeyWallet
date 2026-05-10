import { useEffect, useCallback, useRef } from 'react';
import { initService, eventService } from '../services/core';
import { useWalletStore } from '../store/walletStore';
import { useQueryClient } from '@tanstack/react-query';
import { notificationService } from '../services/notificationService';
import { DeviceEventEmitter } from 'react-native';
import { useToastController } from '@tamagui/toast';

/**
 * Hook to subscribe to coco CoreEvents and trigger wallet updates.
 * Use this in your app's root component to enable real-time updates.
 *
 * Subscribed events:
 * - mint-quote:redeemed  → balance gained from paid Lightning invoice
 * - receive:created      → ecash token received
 * - send:created         → ecash token sent
 * - proofs:saved         → new proofs stored (covers mint redemption)
 * - proofs:state-changed → proof state transitions (spent, etc.)
 * - melt-quote:paid      → Lightning invoice paid from ecash
 * - history:updated      → any history entry changed
 *
 * PERF: handleBalanceUpdate is debounced (300ms) to batch rapid-fire events
 * (e.g. proofs:saved + history:updated + receive:created all fire within ms)
 * into a single refresh cycle.
 */
export function useCocoEvents() {
    const { refreshBalance } = useWalletStore();
    const queryClient = useQueryClient();
    const toast = useToastController();
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleBalanceUpdate = useCallback(() => {
        // Debounce: batch rapid-fire events into a single refresh
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            refreshBalance();
            queryClient.invalidateQueries({ queryKey: ['history'] });
            queryClient.invalidateQueries({ queryKey: ['history-volume'] });
        }, 300);
    }, [refreshBalance, queryClient]);

    const handleMintQuoteRedeemed = useCallback((payload: any) => {
        console.log('[useCocoEvents] Mint quote redeemed:', payload.quoteId);
        notificationService.sendLocalNotification('Mint Completed', 'Your ecash has been minted successfully.');
        handleBalanceUpdate();
    }, [handleBalanceUpdate]);

    const handleReceiveCreated = useCallback((payload: any) => {
        console.log('[useCocoEvents] Receive created:', payload.mintUrl);
        notificationService.sendLocalNotification('Ecash Received', 'You have successfully received ecash tokens via Link / QR code.');
        handleBalanceUpdate();
    }, [handleBalanceUpdate]);

    const handleSendCreated = useCallback((payload: any) => {
        console.log('[useCocoEvents] Send created:', payload.mintUrl);
        notificationService.sendLocalNotification('Ecash Prepared', 'Your ecash tokens are ready to be sent.');
        handleBalanceUpdate();
    }, [handleBalanceUpdate]);

    const handleProofsSaved = useCallback((payload: any) => {
        handleBalanceUpdate();
    }, [handleBalanceUpdate]);

    const handleProofsStateChanged = useCallback((payload: any) => {
        handleBalanceUpdate();
    }, [handleBalanceUpdate]);

    const handleMeltQuotePaid = useCallback((payload: any) => {
        console.log('[useCocoEvents] Melt quote paid:', payload.quoteId);
        notificationService.sendLocalNotification('Payment Sent', 'Your Lightning invoice was paid successfully.');
        handleBalanceUpdate();
    }, [handleBalanceUpdate]);

    const handleHistoryUpdated = useCallback((payload: any) => {
        queryClient.invalidateQueries({ queryKey: ['history'] });
        queryClient.invalidateQueries({ queryKey: ['history-volume'] });
    }, [queryClient]);

    useEffect(() => {
        if (!initService.isInitialized()) {
            return;
        }

        console.log('[useCocoEvents] Subscribing to CoreEvents');
        
        // Listen for internal app events
        const nostrSub = DeviceEventEmitter.addListener('nostr:received', (payload: any) => {
            console.log('[useCocoEvents] Nostr received:', payload.amount);
            notificationService.sendLocalNotification('Payment Received', `You received ₿${payload.amount} sats via Nostr.`);
            toast.show('Payment Received! 🎉', { message: `₿${payload.amount} sats added to your wallet via Nostr` });
            handleBalanceUpdate();
        });

        const syncSub = DeviceEventEmitter.addListener('nostr:sync-success', (payload: { npub: string }) => {
            const shortAddress = payload.npub.substring(0, 10) + '...' + payload.npub.substring(payload.npub.length - 4);
            toast.show('Success', { message: `Mint is nostr sync with address ${shortAddress}` });
        });

        // Subscribe using typed eventService
        const unsubs = [
            eventService.on('mint-quote:redeemed', handleMintQuoteRedeemed),
            eventService.on('receive:created', handleReceiveCreated),
            eventService.on('send:created', handleSendCreated),
            eventService.on('proofs:saved', handleProofsSaved),
            eventService.on('proofs:state-changed', handleProofsStateChanged),
            eventService.on('melt-quote:paid', handleMeltQuotePaid),
            eventService.on('history:updated', handleHistoryUpdated),
        ];

        return () => {
            unsubs.forEach(unsub => unsub());
            nostrSub.remove();
            syncSub.remove();
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [
        handleMintQuoteRedeemed,
        handleReceiveCreated,
        handleSendCreated,
        handleProofsSaved,
        handleProofsStateChanged,
        handleMeltQuotePaid,
        handleHistoryUpdated,
    ]);
}
