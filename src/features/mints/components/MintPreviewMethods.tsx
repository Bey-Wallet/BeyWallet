import React from 'react';
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

export function MintPreviewMethods({
  info,
  summaryOnly = false,
  hideSummary = false,
}: {
  info: Info;
  summaryOnly?: boolean;
  hideSummary?: boolean;
}) {
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
    <>
      {!hideSummary && (
        <>
          <ListTableRow label="Deposit" value={summary('Receive')} />
          <ListTableRow label="Withdraw" value={summary('Send')} />
        </>
      )}
      {!summaryOnly && rows.length === 0 && <ListTableRow label="No payment limits advertised" />}
      {!summaryOnly &&
        rows.map((row, index) => (
          <React.Fragment key={index}>
            <ListTableRow
              label={`${row.direction === 'Receive' ? 'Deposit' : 'Withdraw'} · ${methodName(row.method)}${row.unit ? ` · ${row.unit}` : ''}`}
              labelColor="$color"
              value={row.disabled ? 'Disabled by mint' : undefined}
            />
            <ListTableRow label="Minimum" value={row.minimum} />
            <ListTableRow label="Maximum" value={row.maximum} />
            {row.fee !== undefined && <ListTableRow label="Published fee" value={row.fee} />}
            {row.network && <ListTableRow label="Network" value={row.network} />}
            {row.confirmations !== undefined && (
              <ListTableRow label="Confirmations" value={String(row.confirmations)} />
            )}
          </React.Fragment>
        ))}
    </>
  );
}
