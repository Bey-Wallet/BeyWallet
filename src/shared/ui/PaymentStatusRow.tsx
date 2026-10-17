import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw } from '@tamagui/lucide-icons';
import { AppIconButton } from '~/shared/ui/AppIconButton';
import { ListTableRow } from '~/shared/ui/ListTable';

/** Refreshes the owning flow without inferring payment completion. */
export function PaymentStatusRow({
  value,
  onRefresh,
  checking = false,
  disabled = false,
  valueColor,
}: {
  value: string;
  onRefresh?: () => void | Promise<void>;
  checking?: boolean;
  disabled?: boolean;
  valueColor?: string;
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
  return (
    <ListTableRow
      label="Status"
      value={busy ? 'Checking…' : failed ? 'Unverified' : value}
      valueColor={failed ? '$gray10' : valueColor}
      rightContent={
        onRefresh && (
          <AppIconButton
            variant="default"
            emphasis="tertiary"
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
      }
    />
  );
}
