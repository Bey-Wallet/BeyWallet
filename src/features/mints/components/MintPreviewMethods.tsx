import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from '@tamagui/lucide-icons';
import { MintInfoRow } from './MintInfoRow';
import { ListTableRow } from '~/shared/ui/ListTable';

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
  const activeRows = (direction: string) =>
    rows.filter((row) => row.direction === direction && !row.disabled);
  const summary = (direction: string) =>
    [...new Set(activeRows(direction).map((row) => methodName(row.method)))].join(' · ') ||
    'Not advertised';
  const limits = (direction: string) => {
    const groups = new Map<
      string,
      { minimum: string; maximum: string; unit?: string; methods: string[] }
    >();
    for (const row of activeRows(direction)) {
      const key = JSON.stringify([row.minimum, row.maximum, row.unit]);
      const group = groups.get(key);
      if (group) group.methods.push(methodName(row.method));
      else groups.set(key, { ...row, methods: [methodName(row.method)] });
    }
    const entries = [...groups.values()];
    return entries
      .map((row) => {
        const range =
          row.minimum === 'Not provided' && row.maximum === 'Not provided'
            ? 'Not provided'
            : row.minimum === 'Not provided'
              ? `Up to ${row.maximum}`
              : row.maximum === 'Not provided'
                ? `From ${row.minimum}`
                : `${row.minimum} – ${row.maximum}`;
        const varying = entries.filter((other) => other.unit === row.unit).length > 1;
        return `${varying ? row.methods.join(' / ') + ': ' : ''}${range}`;
      })
      .join('\n');
  };
  return (
    <>
      <MintInfoRow label="Deposit" value={summary('Receive')} />
      <MintInfoRow label="Withdraw" value={summary('Send')} />
      {limits('Receive') && <MintInfoRow label="Deposit limits" value={limits('Receive')} />}
      {limits('Send') && <MintInfoRow label="Withdraw limits" value={limits('Send')} />}
      {rows.length > 0 && (
        <ListTableRow
          label="Payment details"
          expanded={expanded}
          rightContent={
            expanded ? (
              <ChevronUp size={20} color="$gray10" />
            ) : (
              <ChevronDown size={20} color="$gray10" />
            )
          }
          onPress={() => setExpanded((value) => !value)}
        />
      )}
      {expanded &&
        rows.map((row, index) => (
          <React.Fragment key={index}>
            <MintInfoRow
              label={`${row.direction === 'Receive' ? 'Deposit' : 'Withdraw'} · ${methodName(row.method)}${row.unit ? ` · ${row.unit}` : ''}`}
              value={row.disabled ? 'Disabled by mint' : 'Advertised by mint'}
            />
            <MintInfoRow label="Minimum" value={row.minimum} />
            <MintInfoRow label="Maximum" value={row.maximum} />
            {row.fee !== undefined && <MintInfoRow label="Published fee" value={row.fee} />}
            {row.network && <MintInfoRow label="Network" value={row.network} />}
            {row.confirmations !== undefined && (
              <MintInfoRow label="Confirmations" value={String(row.confirmations)} />
            )}
          </React.Fragment>
        ))}
    </>
  );
}
