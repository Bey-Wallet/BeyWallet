import { appLogger } from './appLogger';

const installed = Symbol.for('bey.dependencyConsoleGuard');

/** Only intercept known dependency bypasses; framework diagnostics keep their normal console. */
export function installDependencyConsoleGuard() {
  const target = console as unknown as Record<PropertyKey, unknown>;
  if (target[installed]) return;
  Object.defineProperty(target, installed, { value: true, configurable: true });
  for (const level of ['log', 'warn', 'error'] as const) {
    const original = console[level];
    console[level] = (...args: unknown[]) => {
      const first = args[0];
      if (
        first === 'Failed to parse witness string:' ||
        first === 'Failed to parse HTLC witness string:'
      ) {
        appLogger.warn('[Cashu] Invalid witness data.', undefined, 'wallet_sdk');
        return;
      }
      if (typeof first === 'string' && first.startsWith('[CocoPatch]')) {
        appLogger.warn('[Cashu] Keysets unavailable.', undefined, 'mint_connection');
        return;
      }
      if (
        typeof first === 'string' &&
        (/^(amount\.keep|keep \[)/.test(first) ||
          /blindedMessage|blindingFactor/.test(first) ||
          first.startsWith(' - id: '))
      )
        return;
      let array: boolean;
      try {
        array = Array.isArray(first);
      } catch {
        return;
      }
      if (array) {
        // Do not invoke getters in third-party payloads just to inspect a log.
        try {
          const item = Object.getOwnPropertyDescriptor(first, '0')?.value;
          if (item && Object.getOwnPropertyDescriptor(item, 'blindedMessage')) return;
        } catch {
          return;
        }
      }
      original.apply(console, args);
    };
  }
}
