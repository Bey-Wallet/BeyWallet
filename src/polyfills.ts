import * as Crypto from 'expo-crypto';
import { TextEncoder, TextDecoder } from 'text-encoding';
import { Buffer } from 'buffer';

// @ts-ignore
global.TextEncoder = TextEncoder;
// @ts-ignore
global.TextDecoder = TextDecoder;


// Filter out verbose coco-cashu library logs
const originalConsoleLog = console.log;
console.log = (...args: any[]) => {
    const firstArg = args[0];
    if (typeof firstArg === 'string') {
        // Suppress keep/blinded message logs
        if (/^(amount\.keep|keep \[)/.test(firstArg) || /blindedMessage|blindingFactor/.test(firstArg)) {
            return;
        }
    }
    // Suppress arrays with blindedMessage objects
    if (Array.isArray(firstArg) && firstArg[0]?.blindedMessage) {
        return;
    }
    originalConsoleLog.apply(console, args);
};

console.log('[Polyfills] Starting polyfill installation using expo-crypto');

// 1. Patch Buffer
if (typeof global.Buffer === 'undefined') {
    global.Buffer = Buffer;
    console.log('[Polyfills] Patched global.Buffer');
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
        return Crypto.getRandomValues(array);
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
            enumerable: true
        });
        console.log('[Polyfills] Patched global.crypto with expo-crypto');
    } else {
        console.log('[Polyfills] Native global.crypto and getRandomValues already present');
    }
} catch (e) {
    console.warn('[Polyfills] Failed to define global.crypto via Object.defineProperty, trying direct assignment:', e);
    try {
        // @ts-ignore
        global.crypto = cryptoShim;
    } catch (e2) {
        console.error('[Polyfills] Direct assignment of global.crypto also failed:', e2);
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
