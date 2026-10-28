import React, { useState } from 'react';
import { Check, ChevronDown, ChevronUp } from '@tamagui/lucide-icons';
import { AppPressable } from '~/shared/ui/AppPressable';
import { ListTableRow } from '~/shared/ui/ListTable';

// Names follow https://github.com/cashubtc/nuts; only advertised entries are rendered.
const nutNames: Record<number, string> = {
  0: 'Cryptography and models',
  1: 'Mint public keys',
  2: 'Keysets and fees',
  3: 'Token exchange',
  4: 'Minting tokens',
  5: 'Melting tokens',
  6: 'Mint information',
  7: 'Token state checks',
  8: 'Lightning fee returns',
  9: 'Signature restoration',
  10: 'Spending conditions',
  11: 'P2PK locking',
  12: 'DLEQ proofs',
  13: 'Deterministic secrets',
  14: 'HTLC locking',
  15: 'Multi-path payments',
  16: 'Animated QR codes',
  17: 'WebSocket subscriptions',
  18: 'Payment requests',
  19: 'Cached responses',
  20: 'Signed mint quotes',
  21: 'Clear authentication',
  22: 'Blind authentication',
  23: 'BOLT11 payments',
  24: 'HTTP 402 payments',
  25: 'BOLT12 payments',
  26: 'Encoded payment requests',
  27: 'Nostr mint backups',
  28: 'Blinded-key locking (P2BK)',
  29: 'Batch minting',
  30: 'On-chain payments',
};

function advertisedNuts(nuts: unknown) {
  if (!nuts || typeof nuts !== 'object' || Array.isArray(nuts)) return [];
  const entries = new Map<number, string>();
  for (const [key, settings] of Object.entries(nuts)) {
    const id = Number(key);
    if (!/^\d+$/.test(key) || !Number.isSafeInteger(id)) continue;
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) continue;
    const config = settings as Record<string, unknown>;
    if (config.supported === false || config.disabled === true) continue;
    if (Array.isArray(config.supported) && config.supported.length === 0) continue;
    entries.set(id, nutNames[id] ?? 'Additional capability');
  }
  return [...entries].sort(([a], [b]) => a - b);
}

export function MintNutsRow({ nuts }: { nuts: unknown }) {
  const [expanded, setExpanded] = useState(false);
  const entries = advertisedNuts(nuts);
  return (
    <>
      <AppPressable
        minHeight={48}
        accessibilityLabel="Advertised NUTs"
        accessibilityState={{ expanded, disabled: entries.length === 0 }}
        disabled={entries.length === 0}
        onPress={() => setExpanded((value) => !value)}
      >
        <ListTableRow
          label="Advertised NUTs"
          value={entries.length}
          rightContent={
            expanded ? (
              <ChevronUp size={18} color="$gray10" />
            ) : (
              <ChevronDown size={18} color="$gray10" />
            )
          }
        />
      </AppPressable>
      {expanded &&
        entries.map(([id, name]) => (
          <ListTableRow
            key={id}
            label={`NUT-${String(id).padStart(2, '0')} · ${name}`}
            rightContent={<Check size={18} color="$green11" />}
          />
        ))}
    </>
  );
}
