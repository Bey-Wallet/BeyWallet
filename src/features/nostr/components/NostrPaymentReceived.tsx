/**
 * NostrPaymentReceived
 *
 * Listens for the `nostr:received` DeviceEventEmitter event (emitted AFTER
 * a token has been successfully claimed) to refresh feature queries.
 * Presentation belongs to the feedback coordinator and active result owner.
 *
 * This component is kept as a lightweight listener for post-claim
 * notifications only (balance refreshes, query invalidations).
 */

import React, { useEffect } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useWalletStore } from '~/state/walletStore';

export function NostrPaymentReceived() {
  const queryClient = useQueryClient();
  const refreshBalance = useWalletStore((s) => s.refreshBalance);

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('nostr:received', () => {
      // Refresh relevant queries
      queryClient.invalidateQueries({ queryKey: ['history'] });
      queryClient.invalidateQueries({ queryKey: ['history', 'nostr'] });
      queryClient.invalidateQueries({ queryKey: ['balance'] });
      refreshBalance();
    });

    return () => subscription.remove();
  }, [queryClient, refreshBalance]);

  // This component renders nothing — it's just a listener
  return null;
}
