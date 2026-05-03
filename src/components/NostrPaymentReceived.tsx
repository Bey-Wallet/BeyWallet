/**
 * NostrPaymentReceived
 *
 * Listens for the `nostr:received` DeviceEventEmitter event and shows a
 * full-screen success overlay when a P2PK payment is received via Nostr.
 * Auto-dismisses after 5 seconds or on tap.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { DeviceEventEmitter } from 'react-native';
import {
  PaymentStatusOverlay,
  type PaymentStatusState,
} from './PaymentStatusOverlay';
import * as Haptics from 'expo-haptics';

interface ReceivedPayment {
  amount: number;
  mintUrl: string;
  eventId?: string;
  senderPubkey?: string;
}

export function NostrPaymentReceived() {
  const [payment, setPayment] = useState<ReceivedPayment | null>(null);
  const [visible, setVisible] = useState(false);
  const autoDismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    if (autoDismissTimer.current) {
      clearTimeout(autoDismissTimer.current);
      autoDismissTimer.current = null;
    }
    // Small delay before clearing data to allow exit animation
    setTimeout(() => setPayment(null), 400);
  }, []);

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(
      'nostr:received',
      (data: ReceivedPayment) => {
        console.log('[NostrPaymentReceived] Payment received:', data.amount, 'sats');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        setPayment(data);
        setVisible(true);

        // Auto-dismiss after 6 seconds
        if (autoDismissTimer.current) clearTimeout(autoDismissTimer.current);
        autoDismissTimer.current = setTimeout(() => {
          handleDismiss();
        }, 6000);
      }
    );

    return () => {
      subscription.remove();
      if (autoDismissTimer.current) clearTimeout(autoDismissTimer.current);
    };
  }, [handleDismiss]);

  if (!payment) return null;

  return (
    <PaymentStatusOverlay
      visible={visible}
      state="success"
      direction="receive"
      amount={payment.amount}
      recipient={payment.senderPubkey}
      mintUrl={payment.mintUrl}
      onDismiss={handleDismiss}
    />
  );
}
