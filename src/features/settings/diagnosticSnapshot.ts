import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Application from 'expo-application';
import * as Updates from 'expo-updates';
import type { QueryClient } from '@tanstack/react-query';
import { initService } from '~/services/wallet/initService';
import { nostrService } from '~/services/wallet/nostrService';
import { useWalletStore } from '~/state/walletStore';
import { useNostrRelayStore } from '~/state/nostrRelayStore';
import { mintUrlKey } from '~/shared/utils/mintUrl';
import { getDiagnosticFailures } from '~/services/feedback/diagnosticFailures';
import type { DiagnosticSnapshot } from './diagnosticReport';

/** Reads cached observations only: opening/refreshing diagnostics does not contact mints. */
export function createDiagnosticSnapshot(client: QueryClient): DiagnosticSnapshot {
  const wallet = useWalletStore.getState();
  const constants = Platform.constants as { Model?: string; Release?: string };
  const snapshot: DiagnosticSnapshot = {
    capturedAt: Date.now(),
    version: Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? null,
    build:
      Application.nativeBuildVersion ??
      (Platform.OS === 'android'
        ? Constants.expoConfig?.android?.versionCode?.toString()
        : Constants.expoConfig?.ios?.buildNumber) ??
      null,
    platform: Platform.OS,
    device: {
      model: constants?.Model ?? null,
      osVersion:
        constants?.Release ?? (Platform.Version == null ? 'Unavailable' : String(Platform.Version)),
      ...(Platform.OS === 'android' && typeof Platform.Version === 'number'
        ? { apiLevel: Platform.Version }
        : {}),
    },
    update: {
      runtime: Updates.runtimeVersion ?? null,
      id: Updates.updateId ?? null,
      embedded: Updates.isEmbeddedLaunch === true,
      development: __DEV__,
    },
    wallet: {
      initialization: wallet.isInitializing
        ? 'starting'
        : initService.isInitialized()
          ? 'ready'
          : 'unavailable',
      hasError: !!wallet.error,
    },
    relays: null,
    failures: getDiagnosticFailures(),
  };
  try {
    const configured = useNostrRelayStore.getState().relays;
    const connections = nostrService.getRelayConnectionStatus();
    snapshot.relays = {
      configured: configured.length,
      connected: configured.filter((url) => connections[url] === true).length,
    };
  } catch {
    /* Missing relay data must not prevent sharing the rest of the report. */
  }
  const connected = new Set(wallet.mints.map((mint) => mintUrlKey(mint.mintUrl)));
  const observations = new Map<string, { failed: boolean; at: number }>();
  for (const query of client.getQueryCache().getAll()) {
    if (query.queryKey[0] !== 'mint-metadata' || typeof query.queryKey[1] !== 'string') continue;
    const key = mintUrlKey(query.queryKey[1]);
    if (!connected.has(key)) continue;
    const at = Math.max(query.state.dataUpdatedAt, query.state.errorUpdatedAt);
    if (!at || (observations.get(key)?.at ?? 0) >= at) continue;
    observations.set(key, {
      at,
      failed:
        query.state.status === 'error' || query.state.errorUpdatedAt > query.state.dataUpdatedAt,
    });
  }
  snapshot.mints = {
    connected: connected.size,
    successful: [...observations.values()].filter((item) => !item.failed).length,
    failed: [...observations.values()].filter((item) => item.failed).length,
    unchecked: connected.size - observations.size,
    checkedAt: observations.size
      ? Math.max(...[...observations.values()].map((item) => item.at))
      : null,
  };
  return snapshot;
}
