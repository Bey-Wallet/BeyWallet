import * as Crypto from 'expo-crypto';
import { TextEncoder, TextDecoder } from 'text-encoding';
import { Buffer } from 'buffer';
import { appLogger } from '~/shared/utils/appLogger';
import { installDependencyConsoleGuard } from '~/shared/utils/dependencyConsoleGuard';

// @ts-ignore
global.TextEncoder = TextEncoder;
// @ts-ignore
global.TextDecoder = TextDecoder;

installDependencyConsoleGuard();

// 1. Patch Buffer
if (typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer;
}

// 2. Patch Crypto
const existingCrypto = global.crypto || {};

// Create a robust crypto object backed by expo-crypto
const cryptoShim = {
  ...existingCrypto,
  getRandomValues: (array: TypedArray) => {
    if (existingCrypto.getRandomValues) {
      return existingCrypto.getRandomValues(array);
    }
    return Crypto.getRandomValues(array as Exclude<TypedArray, Float32Array | Float64Array>);
  },
  randomUUID: () => {
    if (existingCrypto.randomUUID) {
      return existingCrypto.randomUUID();
    }
    return Crypto.randomUUID();
  },
};

// Safely define global.crypto using Object.defineProperty to avoid read-only assignment crashes
try {
  if (!global.crypto || !global.crypto.getRandomValues) {
    Object.defineProperty(global, 'crypto', {
      value: cryptoShim,
      writable: true,
      configurable: true,
      enumerable: true,
    });
  } else {
  }
} catch (e) {
  appLogger.warn(
    '[Polyfills] Failed to define global.crypto via Object.defineProperty, trying direct assignment:',
    e,
    'app_runtime',
  );
  try {
    // @ts-ignore
    global.crypto = cryptoShim;
  } catch (e2) {
    appLogger.error(
      '[Polyfills] Direct assignment of global.crypto also failed:',
      e2,
      'app_runtime',
    );
  }
}

type TypedArray =
  | Int8Array
  | Uint8Array
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Uint8ClampedArray
  | Float32Array
  | Float64Array;
