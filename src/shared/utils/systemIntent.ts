import { queueAppShortcut } from '~/services/platform/appShortcuts';
import { redirectNfcIntent } from '~/features/nfc/nativeIntent';

export function redirectSystemPath(input: { path: string; initial: boolean }) {
  if (queueAppShortcut(input.path)) {
    // Queue cold launches until wallet startup/unlock; warm launches preserve the active operation.
    return input.initial ? '/(tabs)' : '';
  }
  return redirectNfcIntent(input);
}
