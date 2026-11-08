type DiagnosticSnapshot = {
  version: string | null;
  build: string | null;
  platform: string;
  relays: { configured: number; connected: number } | null;
};

// Explicit allowlist: never serialize stores, raw diagnostics, URLs, or errors.
export function formatDiagnosticReport(snapshot: DiagnosticSnapshot) {
  return [
    'Bey Wallet diagnostic report',
    `App version: ${snapshot.version ?? 'Unavailable'}`,
    `Build: ${snapshot.build ?? 'Unavailable'}`,
    `Platform: ${snapshot.platform}`,
    snapshot.relays
      ? `Configured relays connected: ${snapshot.relays.connected}/${snapshot.relays.configured}`
      : 'Relay connection status: Unavailable',
  ].join('\n');
}
