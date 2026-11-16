import { nfcFlow } from './nfcFlow';
import * as SecureStore from 'expo-secure-store';

const consumedLaunchKey = 'bey.nfc.consumedLaunch';
let launchQueue: Promise<unknown> = Promise.resolve();

function consumeLaunch(id: string): Promise<boolean> {
  // Serialize duplicate deliveries from initial URL and live-link handling.
  const result = launchQueue
    .then(async () => {
      if ((await SecureStore.getItemAsync(consumedLaunchKey)) === id) return false;
      await SecureStore.setItemAsync(consumedLaunchKey, id);
      return true;
    })
    .catch(() => {
      // Manual NFC remains available when launch replay protection cannot persist.
      console.warn('[NFC] Could not consume launch; open NFC manually.');
      return false;
    });
  launchQueue = result;
  return result;
}

export function isNfcIntent(path: string) {
  return /(?:^|\/)nfc-(?:receive|send)(?:[?#]|$)/.test(path);
}

export function redirectNfcIntent({ path, initial }: { path: string; initial: boolean }) {
  if (!isNfcIntent(path)) return path;
  // Expo Router ignores empty warm-link redirects, preserving the current route.
  const destination = initial ? '/(tabs)' : '';
  const launchId =
    /[?&]launchId=([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:&|$)/i
      .exec(path)?.[1]
      ?.toLowerCase();
  if (!launchId) {
    // Older clients retain a constant NFC URL as their initial intent. It cannot
    // distinguish a fresh cold tap from a dev reload or task-history replay.
    // Keep startup on Home; fresh warm links and manual NFC continue to work.
    if (!initial) nfcFlow.openReader();
    return destination;
  }
  return consumeLaunch(launchId).then((fresh) => {
    // No invoice/token is read from this URL. Readiness/auth gates own the queue.
    if (fresh) nfcFlow.openReader();
    return destination;
  });
}
