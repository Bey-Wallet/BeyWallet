import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw } from '@tamagui/lucide-icons';
import { AppIconButton } from '~/shared/ui/AppIconButton';
import { ListTableRow } from '~/shared/ui/ListTable';
import { paymentStatusColors, type PaymentStatus } from '~/shared/ui/PaymentStatusIcon';
import { Spinner } from '~/shared/ui/Spinner';
import { usePaymentListening } from '~/shared/hooks/usePendingPaymentPolling';

/** Refreshes the owning flow without inferring payment completion. */
export function PaymentStatusRow({
  value,
  onRefresh,
  checking = false,
  disabled = false,
  valueColor,
  status,
}: {
  value: string;
  onRefresh?: () => void | Promise<void>;
  checking?: boolean;
  disabled?: boolean;
  valueColor?: string;
  status?: PaymentStatus;
}) {
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);
  const active = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => setFailed(false), [value]);
  const busy = checking || refreshing;
  const listening = usePaymentListening(status === 'pending' && !disabled);
  return (
    <ListTableRow
      label="Status"
      value={busy && !listening ? 'Checking…' : failed ? 'Unverified' : value}
      valueColor={
        failed ? '$gray10' : (valueColor ?? (status ? paymentStatusColors[status] : undefined))
      }
      rightContent={
        listening ? (
          <Spinner size="small" color="$gray10" accessibilityLabel="Listening for payment" />
        ) : (
          onRefresh && (
            <AppIconButton
              variant="default"
              emphasis="ghost"
              size="xxsmall"
              accessibilityLabel="Refresh status"
              loading={busy}
              disabled={disabled || busy}
              icon={<RefreshCw size={16} color="$gray10" />}
              onPress={async () => {
                if (disabled || checking || active.current) return;
                active.current = true;
                setRefreshing(true);
                setFailed(false);
                try {
                  await onRefresh();
                } catch {
                  if (mounted.current) setFailed(true);
                } finally {
                  active.current = false;
                  if (mounted.current) setRefreshing(false);
                }
              }}
            />
          )
        )
      }
    />
  );
}
