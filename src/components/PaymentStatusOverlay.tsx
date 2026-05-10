/**
 * PaymentStatusOverlay
 *
 * Full-screen overlay shown during payment processing.
 * Three states:
 *   - sending:  Animated spinner + pulsing accent glow
 *   - success:  Green checkmark, amount, recipient, details
 *   - error:    Red X, error message, retry/dismiss
 */

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Modal } from 'react-native';
import { YStack, XStack, Text, Button, Separator, View } from 'tamagui';
import {
  Check,
  X,
  ArrowUpRight,
  ArrowDownLeft,
  User,
  Building2,
  Clock,
  Zap,
} from '@tamagui/lucide-icons';
import AppBottomSheet, { AppBottomSheetRef } from './UI/AppBottomSheet';
import { Spinner } from './UI/Spinner';
import { ProcessingSheet } from './UI/ProcessingSheet';

export type PaymentStatusState = 'sending' | 'receiving' | 'success' | 'error';
export type PaymentDirection = 'send' | 'receive';

export interface PaymentStatusOverlayProps {
  visible: boolean;
  state: PaymentStatusState;
  direction: PaymentDirection;
  amount?: number;
  recipient?: string; // npub, nip05, or bey.cash username
  mintUrl?: string;
  errorMessage?: string;
  onDismiss: () => void;
  onRetry?: () => void;
  onViewDetails?: () => void;
}

export function PaymentStatusOverlay({
  visible,
  state,
  direction,
  amount = 0,
  recipient,
  mintUrl,
  errorMessage,
  onDismiss,
  onRetry,
  onViewDetails,
}: PaymentStatusOverlayProps) {
  useEffect(() => {
    // We only need basic fade/scale if we still used Modal, 
    // but now everything is in ProcessingSheet (AppBottomSheet).
    // AppBottomSheet handles its own animations.
  }, [visible, state]);

  const truncate = (s?: string) => {
    if (!s) return 'Unknown';
    if (s.includes('@')) return s; // bey.cash username
    if (s.length > 20) return `${s.slice(0, 10)}...${s.slice(-6)}`;
    return s;
  };

  const mintDomain = mintUrl
    ? mintUrl.replace(/^https?:\/\//, '').split('/')[0]
    : 'Unknown';

  const isSending = state === 'sending' || state === 'receiving';
  const isSuccess = state === 'success';
  const isError = state === 'error';

  const dirLabel = direction === 'send' ? 'Sending' : 'Receiving';
  const toFromLabel = direction === 'send' ? 'to' : 'from';

  const status = isSending ? 'processing' : isSuccess ? 'success' : 'error';

  return (
    <ProcessingSheet
      visible={visible}
      status={status}
      title={dirLabel}
      amount={amount}
      detail={recipient ? (
        <XStack items="center" gap="$1.5">
          <Text fontSize="$4" color="$color10" fontWeight="600">
            {toFromLabel}
          </Text>
          <Text fontSize="$4" color="$color12" fontWeight="800">
            {truncate(recipient)}
          </Text>
        </XStack>
      ) : undefined}
      errorMessage={errorMessage}
      onClose={onDismiss}
      onRetry={onRetry}
      onViewDetails={onViewDetails}
      mintUrl={mintUrl}
      recipient={recipient}
      direction={direction}
      type="p2pk" // Defaulting to p2pk for now as per app logic, or we can make it dynamic if props allow
    />
  );
}

const styles = StyleSheet.create({});
