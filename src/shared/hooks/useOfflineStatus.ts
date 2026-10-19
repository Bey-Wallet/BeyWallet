import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import * as Network from 'expo-network';

export function useOfflineStatus(): boolean {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    let active = true;
    let revision = 0;
    const update = (state: Network.NetworkState) => {
      if (active) setOffline(state.isConnected === false || state.isInternetReachable === false);
    };
    const refresh = async () => {
      const current = ++revision;
      try {
        const state = await Network.getNetworkStateAsync();
        if (current === revision) update(state);
      } catch {
        /* Keep the last known state when connectivity cannot be determined. */
      }
    };
    const network = Network.addNetworkStateListener((state) => {
      revision++;
      update(state);
    });
    const app = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    void refresh();
    return () => {
      active = false;
      revision++;
      network.remove();
      app.remove();
    };
  }, []);
  return offline;
}
