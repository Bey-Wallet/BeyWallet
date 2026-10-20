import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from '@tamagui/lucide-icons';
import { Text, YStack } from 'tamagui';
import { AppPressable } from '~/shared/ui/AppPressable';
import { ListTable, ListTableRow } from '~/shared/ui/ListTable';

type Info = Record<string, any>;
const methodName = (method: string) =>
  (({ bolt11: 'Lightning', bolt12: 'BOLT 12', onchain: 'On-chain' }) as Record<string, string>)[
    method
  ] || method;
const amount = (value: unknown, unit: unknown) =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? `${value.toLocaleString()}${typeof unit === 'string' ? ` ${unit}` : ''}`
    : 'Not provided';
export function mintPreviewMethods(info: Info) {
  const rows: {
    direction: string;
    method: string;
    unit?: string;
    disabled: boolean;
    minimum: string;
    maximum: string;
    confirmations?: number;
    fee?: string;
    network?: string;
  }[] = [];
  for (const [id, direction] of [
    ['4', 'Receive'],
    ['5', 'Send'],
    ['30', 'Send'],
  ]) {
    const nut = info.nuts?.[id];
    if (!Array.isArray(nut?.methods)) continue;
    for (const method of nut.methods) {
      if (!method || typeof method.method !== 'string') continue;
      if (
        rows.some(
          (row) =>
            row.direction === direction && row.method === method.method && row.unit === method.unit,
        )
      )
        continue;
      const confirmations =
        method.options?.confirmations ??
        method.min_confirmations ??
        method.confirmations ??
        nut.min_confirmations;
      const fee = method.fee ?? method.options?.fee;
      rows.push({
        direction,
        method: method.method,
        unit: typeof method.unit === 'string' ? method.unit : undefined,
        disabled: nut.disabled === true || nut.supported === false || method.disabled === true,
        minimum: amount(method.min_amount, method.unit),
        maximum: amount(method.max_amount, method.unit),
        fee:
          typeof fee === 'string'
            ? fee
            : typeof fee === 'number' && Number.isFinite(fee) && fee >= 0
              ? String(fee)
              : undefined,
        network:
          typeof (method.options?.network ?? method.network) === 'string'
            ? (method.options?.network ?? method.network)
            : undefined,
        confirmations:
          typeof confirmations === 'number' &&
          Number.isSafeInteger(confirmations) &&
          confirmations >= 0
            ? confirmations
            : undefined,
      });
    }
  }
  return rows;
}

export function MintPreviewMethods({ info }: { info: Info }) {
  const [expanded, setExpanded] = useState(false);
  const rows = mintPreviewMethods(info);
  const summary = (direction: string) =>
    [
      ...new Set(
        rows
          .filter((row) => row.direction === direction && !row.disabled)
          .map((row) => methodName(row.method)),
      ),
    ].join(' · ') || 'Not advertised';
  return (
    <YStack gap="$3">
      <Text color="$gray10" fontSize="$4" fontWeight="600">
        Payment methods
      </Text>
      <ListTable compact bg="$gray3" separator={<YStack height={2} bg="$background" />}>
        <ListTableRow label="Receive" value={summary('Receive')} />
        <ListTableRow label="Send" value={summary('Send')} />
      </ListTable>
      {rows.length > 0 && (
        <>
          <AppPressable
            minHeight={48}
            flexDirection="row"
            items="center"
            justify="space-between"
            accessibilityRole="button"
            accessibilityLabel="Payment limits"
            accessibilityState={{ expanded }}
            onPress={() => setExpanded((value) => !value)}
          >
            <Text color="$gray10">Payment limits</Text>
            {expanded ? (
              <ChevronUp size={20} color="$gray10" />
            ) : (
              <ChevronDown size={20} color="$gray10" />
            )}
          </AppPressable>
          {expanded &&
            rows.map((row, index) => (
              <YStack key={index} gap="$2">
                <Text color="$gray10" fontSize={13}>
                  {row.direction} · {methodName(row.method)}
                  {row.unit ? ` · ${row.unit}` : ''}
                </Text>
                <ListTable compact bg="$gray3" separator={<YStack height={2} bg="$background" />}>
                  <ListTableRow
                    label="Availability"
                    value={row.disabled ? 'Disabled by mint' : 'Advertised by mint'}
                  />
                  <ListTableRow label="Minimum" value={row.minimum} />
                  <ListTableRow label="Maximum" value={row.maximum} />
                  {row.fee !== undefined && <ListTableRow label="Published fee" value={row.fee} />}
                  {row.network && <ListTableRow label="Network" value={row.network} />}
                  {row.confirmations !== undefined && (
                    <ListTableRow label="Confirmations" value={String(row.confirmations)} />
                  )}
                </ListTable>
              </YStack>
            ))}
        </>
      )}
    </YStack>
  );
}
