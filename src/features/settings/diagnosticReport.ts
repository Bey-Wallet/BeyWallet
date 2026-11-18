import { wordlists } from 'bip39';
import {
  diagnosticOperations,
  diagnosticErrorType,
  type DiagnosticFailure,
} from '~/services/feedback/diagnosticFailures';

export interface DiagnosticSnapshot {
  version: string | null;
  build: string | null;
  platform: string;
  relays: { configured: number; connected: number } | null;
  capturedAt?: number;
  device?: { model: string | null; osVersion: string; apiLevel?: number };
  update?: { runtime: string | null; id: string | null; embedded: boolean; development: boolean };
  wallet?: { initialization: 'ready' | 'starting' | 'unavailable'; hasError: boolean };
  network?: { connected: boolean | null; reachable: boolean | null; type: string };
  mints?: {
    connected: number;
    successful: number;
    failed: number;
    unchecked: number;
    checkedAt: number | null;
  };
  failures?: DiagnosticFailure[];
}
export interface DiagnosticDetails {
  happened: string;
  expected: string;
  steps: string;
}
const words = new Set(wordlists.english);

function redactSeedRuns(value: string): string {
  return value.replace(/\b[a-z]+(?:[\s,]+[a-z]+){11,}\b/gi, (run) => {
    const tokens = run.split(/[\s,]+/);
    const redacted = [...tokens];
    for (let start = 0; start < tokens.length;) {
      if (!words.has(tokens[start].toLowerCase())) {
        start++;
        continue;
      }
      let end = start;
      while (end < tokens.length && words.has(tokens[end].toLowerCase())) end++;
      if (end - start >= 12)
        redacted.splice(start, end - start, ...Array(end - start).fill('[redacted]'));
      start = end;
    }
    return redacted.join(' ').replace(/(?:\[redacted\]\s*){2,}/g, '[recovery phrase redacted] ');
  });
}

/** User-entered prose is optional. Strip common bearer secrets before storing/previewing it. */
export function sanitizeSupportText(value: string): string {
  return redactSeedRuns(value.slice(0, 4000))
    .replace(
      /\b(?:secret|private[_ -]?key|mnemonic|seed|invoice|token|proofs?|balance|amount)\b["']?\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;}]+)/gi,
      '[sensitive field redacted]',
    )
    .replace(
      /\b(?:cashu[AB]|creqA|nsec1|npub1|nprofile1|lnbc|lntb|lnbcrt|lnurl1)[a-z0-9+/_=.-]+/gi,
      '[redacted]',
    )
    .replace(/\b[a-f0-9]{64,}\b/gi, '[redacted]')
    .replace(/\bhttps?:\/\/[^\s]+|\bwss?:\/\/[^\s]+|\b[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, '[redacted]')
    .replace(
      /(?:[$€£₹₿]\s*\d[\d,.]*|\b\d[\d,.]*\s*(?:sats?|msats?|btc|usd|eur|inr)\b)/gi,
      '[amount redacted]',
    );
}
const text = (value: string | null | undefined) =>
  value
    ? sanitizeSupportText(value)
        .replace(/[\r\n]/g, ' ')
        .slice(0, 100)
    : 'Unavailable';
const count = (value: number) =>
  Number.isSafeInteger(value) && value >= 0 ? String(value) : 'Unavailable';
const date = (value?: number | null) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 && value < 8.64e15
    ? new Date(value).toISOString()
    : 'Unavailable';
const yes = (value: boolean | null) =>
  value === true ? 'Yes' : value === false ? 'No' : 'Unavailable';

/** Explicit allowlist: never serialize stores, raw errors, transaction IDs or URLs. */
export function formatDiagnosticReport(snapshot: DiagnosticSnapshot, details?: DiagnosticDetails) {
  const lines = [
    'Bey Wallet diagnostic report',
    ...(snapshot.capturedAt ? [`Snapshot: ${date(snapshot.capturedAt)}`] : []),
    `App version: ${text(snapshot.version)}`,
    `Build: ${text(snapshot.build)}`,
    `Platform: ${text(snapshot.platform)}`,
  ];
  if (snapshot.device)
    lines.push(
      `Device model: ${text(snapshot.device.model)}`,
      `OS version: ${text(snapshot.device.osVersion)}`,
      ...(snapshot.device.apiLevel != null
        ? [`Android API: ${count(snapshot.device.apiLevel)}`]
        : []),
    );
  if (snapshot.update)
    lines.push(
      `App mode: ${snapshot.update.development ? 'Development' : 'Release'}`,
      `Update runtime: ${text(snapshot.update.runtime)}`,
      `Update: ${snapshot.update.embedded ? 'Embedded bundle' : text(snapshot.update.id)}`,
    );
  if (snapshot.wallet)
    lines.push(
      `Wallet initialization: ${snapshot.wallet.initialization === 'ready' ? 'Ready' : snapshot.wallet.initialization === 'starting' ? 'Starting' : 'Unavailable'}`,
      `Wallet reported an error: ${yes(snapshot.wallet.hasError)}`,
    );
  if (snapshot.network)
    lines.push(
      `Network connected: ${yes(snapshot.network.connected)}`,
      `Internet reachable: ${yes(snapshot.network.reachable)}`,
      `Network type: ${text(snapshot.network.type)}`,
    );
  lines.push(
    snapshot.relays
      ? `Configured relays connected: ${count(snapshot.relays.connected)}/${count(snapshot.relays.configured)}`
      : 'Relay connection status: Unavailable',
  );
  if (snapshot.mints)
    lines.push(
      `Connected mints: ${count(snapshot.mints.connected)}`,
      `Last cached mint checks: ${count(snapshot.mints.successful)} successful, ${count(snapshot.mints.failed)} failed, ${count(snapshot.mints.unchecked)} unchecked`,
      `Latest cached mint check: ${date(snapshot.mints.checkedAt)}`,
    );
  lines.push('', 'Recent failures (current session only; no messages or raw logs)');
  for (const failure of (snapshot.failures ?? []).slice(-20)) {
    if (!Object.prototype.hasOwnProperty.call(diagnosticOperations, failure.operation)) continue;
    const fields = [
      date(failure.at),
      diagnosticOperations[failure.operation],
      diagnosticErrorType(failure.type),
      ...(failure.durationMs != null ? [`duration ${count(failure.durationMs)} ms`] : []),
      ...(typeof failure.code === 'number' && failure.code >= 0 && failure.code <= 99999
        ? [`code ${count(failure.code)}`]
        : []),
      ...(typeof failure.status === 'number' && failure.status >= 100 && failure.status <= 599
        ? [`HTTP ${count(failure.status)}`]
        : []),
      `occurrences ${count(failure.count)}`,
    ];
    lines.push(fields.join(' | '));
  }
  if (!lines.at(-1)?.includes(' | ')) lines.push('No recorded failures in this session.');
  if (details)
    lines.push(
      '',
      'User-provided details (review before sharing)',
      `What happened: ${sanitizeSupportText(details.happened).trim() || 'Not provided'}`,
      `Expected behavior: ${sanitizeSupportText(details.expected).trim() || 'Not provided'}`,
      `Steps to reproduce: ${sanitizeSupportText(details.steps).trim() || 'Not provided'}`,
    );
  return lines.join('\n');
}
