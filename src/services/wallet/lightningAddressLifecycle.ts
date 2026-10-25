import { AppState } from 'react-native';
import * as Network from 'expo-network';
import { finalizeEvent } from 'nostr-tools/pure';
import { Buffer } from 'buffer';
import { useAuthStore } from '~/state/authStore';
import { useSettingsStore } from '~/state/settingsStore';
import { useLightningAddressStore, lightningAddressDefaults } from '~/state/lightningAddressStore';
import { createNpubCashClient, NPUB_CASH } from '~/services/api/npubCashClient';
import { LightningAddressService } from './lightningAddressService';
import { getChangeServices } from './plugins/ChangePreparationPlugin';
import type { ExpoSqliteRepositories } from '~/storage/sqlite';

let service: LightningAddressService | undefined;
let teardown: (() => void) | undefined;
export function getLightningAddressService() {
  if (!service) throw new Error('Open your wallet first.');
  return service;
}
export async function stopLightningAddress() {
  teardown?.();
  teardown = undefined;
  const previous = service;
  service = undefined;
  await previous?.dispose();
  useLightningAddressStore.setState({ ...lightningAddressDefaults });
}

export async function startLightningAddress(
  repos: ExpoSqliteRepositories,
  privkey: string,
  pubkey: string,
) {
  await stopLightningAddress();
  let online = false;
  let stopped = false;
  let running = false;
  let generation = 0;
  let syncing = false;
  let again = false;
  let backoff = 1000;
  let unsubscribe: (() => void) | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let debounce: ReturnType<typeof setTimeout> | undefined;
  let poll: ReturnType<typeof setInterval> | undefined;
  let socketClosed = () => {};
  let realtime = false;
  let wasAvailable = false;
  const clients = new Map<string, ReturnType<typeof createNpubCashClient>>();
  const allowed = () =>
    !stopped &&
    online &&
    AppState.currentState === 'active' &&
    useSettingsStore.getState().initialized &&
    (!useSettingsStore.getState().biometricEnabled || useAuthStore.getState().isAuthenticated);
  const current = new LightningAddressService(
    repos,
    getChangeServices(),
    pubkey,
    privkey,
    (provider) => {
      let client = clients.get(provider);
      if (!client) {
        const epoch = generation;
        client = createNpubCashClient(
          provider,
          async (event) => {
            if (!allowed()) throw new Error('Wallet locked or unavailable.');
            return finalizeEvent(event, new Uint8Array(Buffer.from(privkey, 'hex')));
          },
          () => allowed() && epoch === generation,
          () => socketClosed(),
          () => {
            if (epoch !== generation || !running || !allowed()) return;
            realtime = true;
            backoff = 1000;
            useLightningAddressStore.setState({ connection: 'Listening' });
          },
        );
        clients.set(provider, client);
      }
      return client;
    },
    allowed,
  );
  service = current;
  const stopListening = () => {
    running = false;
    realtime = false;
    generation++;
    current.invalidate();
    unsubscribe?.();
    unsubscribe = undefined;
    if (retry) clearTimeout(retry);
    if (debounce) clearTimeout(debounce);
    if (poll) clearInterval(poll);
    retry = undefined;
    debounce = undefined;
    poll = undefined;
    clients.clear();
  };
  const sync = async () => {
    if (!running || !allowed()) return false;
    if (syncing) {
      again = true;
      return false;
    }
    syncing = true;
    const epoch = generation;
    try {
      do {
        again = false;
        await current.sync();
      } while (again && running && allowed() && epoch === generation);
      if (epoch !== generation) return false;
      useLightningAddressStore.setState({
        connection: realtime ? 'Listening' : 'Checking periodically',
      });
      return true;
    } catch {
      if (epoch === generation)
        useLightningAddressStore.setState({ connection: 'Could not check payments. Retrying…' });
      return false;
    } finally {
      syncing = false;
    }
  };
  const connect = async (epoch: number) => {
    await sync();
    if (epoch !== generation || !running || !allowed()) return;
    const client = clients.get(NPUB_CASH);
    if (client) {
      unsubscribe?.();
      const reconnect = () => {
        if (epoch !== generation || !running) return;
        realtime = false;
        useLightningAddressStore.setState({ connection: 'Checking periodically' });
        unsubscribe?.();
        unsubscribe = undefined;
        if (!retry)
          retry = setTimeout(() => {
            retry = undefined;
            void connect(epoch);
          }, backoff);
        backoff = Math.min(30000, backoff * 2);
      };
      socketClosed = reconnect;
      try {
        unsubscribe = client.subscribe(() => {
          if (epoch !== generation || !running) return;
          backoff = 1000;
          if (debounce) clearTimeout(debounce);
          debounce = setTimeout(() => {
            void sync();
          }, 300);
        }, reconnect);
      } catch {
        reconnect();
      }
    } else {
      retry = setTimeout(() => {
        retry = undefined;
        void connect(epoch);
      }, backoff);
      backoff = Math.min(30000, backoff * 2);
    }
  };
  const update = () => {
    const state = useLightningAddressStore.getState();
    const available = allowed();
    const becameUnavailable = wasAvailable && !available;
    wasAvailable = available;
    const shouldRun = state.loaded && state.enabled && available;
    if (!shouldRun) {
      if (running || becameUnavailable) stopListening();
      const connection = !state.enabled ? 'Disabled' : !online ? 'Offline' : 'Paused';
      if (state.connection !== connection) useLightningAddressStore.setState({ connection });
    } else if (!running) {
      running = true;
      const epoch = ++generation;
      clients.clear();
      useLightningAddressStore.setState({ connection: 'Checking payments…' });
      // SDK 0.3.2 has no socket-open signal. Poll as a watchdog for silent closes too.
      poll = setInterval(() => {
        void sync();
      }, 30000);
      void connect(epoch);
    }
  };
  const authStop = useAuthStore.subscribe(update);
  const settingsStop = useSettingsStore.subscribe(update);
  const preferencesStop = useLightningAddressStore.subscribe(update);
  const app = AppState.addEventListener('change', update);
  const network = Network.addNetworkStateListener((state) => {
    online = state.isConnected === true && state.isInternetReachable !== false;
    update();
  });
  teardown = () => {
    stopped = true;
    stopListening();
    authStop();
    settingsStop();
    preferencesStop();
    app.remove();
    network.remove();
  };
  await current.load();
  const state = await Network.getNetworkStateAsync().catch(() => null);
  if (stopped) return;
  online = state?.isConnected === true && state.isInternetReachable !== false;
  update();
}
