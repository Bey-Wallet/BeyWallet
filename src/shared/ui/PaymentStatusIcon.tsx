import React from 'react';
import { YStack } from 'tamagui';
import { Check, X, Clock, Minus } from '@tamagui/lucide-icons';

export type PaymentStatus = 'success' | 'error' | 'pending' | 'cancelled';
export const paymentStatusColors = {
  success: '$green10',
  error: '$red10',
  pending: '$orange10',
  cancelled: '$orange10',
} as const;

export function paymentReceiptStatus(state: string, broadcast = false): PaymentStatus {
  const value = state.trim().toLowerCase();
  if (['failed', 'error'].includes(value)) return 'error';
  if (['expired', 'cancelled', 'canceled'].includes(value)) return 'cancelled';
  if (
    !broadcast &&
    ['success', 'claimed', 'completed', 'finalized', 'paid', 'issued', 'refunded'].includes(value)
  )
    return 'success';
  return 'pending';
}

export function PaymentStatusIcon({ status }: { status: PaymentStatus }) {
  const Icon = { success: Check, error: X, pending: Clock, cancelled: Minus }[status];
  return (
    <YStack
      testID={`payment-status-${status}`}
      accessibilityRole="image"
      accessibilityLabel={
        status === 'error'
          ? 'Payment failed'
          : status === 'success'
            ? 'Payment completed'
            : status === 'cancelled'
              ? 'Payment cancelled'
              : 'Payment pending'
      }
      width={60}
      height={60}
      rounded={1000}
      bg={paymentStatusColors[status]}
      items="center"
      justify="center"
      mb="$2"
    >
      <Icon size={30} color="white" strokeWidth={3} />
    </YStack>
  );
}
