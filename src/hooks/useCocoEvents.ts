import { useEffect, useCallback } from 'react';
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
 */
export function useCocoEvents() {
    const { refreshBalance } = useWalletStore();
    const queryClient = useQueryClient();
    const toast = useToastController();

    const handleBalanceUpdate = useCallback(() => {
        console.log('[useCocoEvents] Balance update triggered');
        refreshBalance();
        queryClient.invalidateQueries({ queryKey: ['history'] });
        queryClient.invalidateQueries({ queryKey: ['history-volume'] });
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
        console.log('[useCocoEvents] Proofs saved:', payload.mintUrl, payload.keysetId);
        handleBalanceUpdate();
    }, [handleBalanceUpdate]);

    const handleProofsStateChanged = useCallback((payload: any) => {
        console.log('[useCocoEvents] Proofs state changed:', payload.state);
        handleBalanceUpdate();
    }, [handleBalanceUpdate]);

    const handleMeltQuotePaid = useCallback((payload: any) => {
        console.log('[useCocoEvents] Melt quote paid:', payload.quoteId);
        notificationService.sendLocalNotification('Payment Sent', 'Your Lightning invoice was paid successfully.');
        handleBalanceUpdate();
    }, [handleBalanceUpdate]);

    const handleHistoryUpdated = useCallback((payload: any) => {
        console.log('[useCocoEvents] History updated');
        queryClient.invalidateQueries({ queryKey: ['history'] });
        queryClient.invalidateQueries({ queryKey: ['history-volume'] });
    }, [queryClient]);

    useEffect(() => {
        if (!initService.isInitialized()) {
            console.log('[useCocoEvents] Not initialized, skipping event subscription');
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
            console.log('[useCocoEvents] Unsubscribing from CoreEvents');
            unsubs.forEach(unsub => unsub());
            nostrSub.remove();
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
