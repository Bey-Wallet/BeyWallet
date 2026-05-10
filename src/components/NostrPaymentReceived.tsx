/**
 * NostrPaymentReceived
 *
 * Listens for the `nostr:received` DeviceEventEmitter event (emitted AFTER
 * a token has been successfully claimed) and shows a brief toast/haptic
 * feedback. The actual claiming UI is handled by NostrClaimSheet.
 *
 * This component is kept as a lightweight listener for post-claim
 * notifications only (balance refreshes, query invalidations).
 */

import React, { useEffect } from 'react';
import { DeviceEventEmitter } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useQueryClient } from '@tanstack/react-query';
import { useWalletStore } from '../store/walletStore';

interface ReceivedPayment {
    amount: number;
    mintUrl: string;
    eventId?: string;
    senderPubkey?: string;
}

export function NostrPaymentReceived() {
    const queryClient = useQueryClient();
    const refreshBalance = useWalletStore(s => s.refreshBalance);

    useEffect(() => {
        const subscription = DeviceEventEmitter.addListener(
            'nostr:received',
            (data: ReceivedPayment) => {
                console.log('[NostrPaymentReceived] Payment claimed:', data.amount, 'sats');

                // Refresh relevant queries
                queryClient.invalidateQueries({ queryKey: ['history'] });
                queryClient.invalidateQueries({ queryKey: ['history', 'nostr'] });
                queryClient.invalidateQueries({ queryKey: ['balance'] });
                refreshBalance();
            }
        );

        return () => subscription.remove();
    }, [queryClient, refreshBalance]);

    // This component renders nothing — it's just a listener
    return null;
}
