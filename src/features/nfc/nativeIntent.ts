import { nfcFlow } from './nfcFlow';

export function isNfcIntent(path: string) {
  return /(?:^|\/)nfc-(?:receive|send)(?:[?#]|$)/.test(path);
}

export function redirectNfcIntent({ path, initial }: { path: string; initial: boolean }) {
  if (!isNfcIntent(path)) return path;
  // Legacy send links are deliberately treated as reader launches. Tokens are no
  // longer accepted from navigation URLs. A cold start may need another tap.
  nfcFlow.openReader();
  // Expo Router ignores empty warm-link redirects, preserving the current route.
  return initial ? '/(tabs)' : '';
}
