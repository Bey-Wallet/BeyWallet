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
// We purposefully obscure the check to avoid confusion. We just overwrite it or extend it.
const existingCrypto = global.crypto || {};

// Create a robust crypto object backed by expo-crypto
const cryptoShim = {
    ...existingCrypto,
    getRandomValues: (array: TypedArray) => {
        // console.log('[Polyfills] crypto.getRandomValues called with length:', array.length);
        return Crypto.getRandomValues(array);
    },
    randomUUID: () => Crypto.randomUUID(),
};

// @ts-ignore
global.crypto = cryptoShim;

// Patch other namespaces
// @ts-ignore
if (typeof window !== 'undefined') window.crypto = cryptoShim;
// @ts-ignore
if (typeof self !== 'undefined') self.crypto = cryptoShim;

console.log('[Polyfills] Patched global.crypto with expo-crypto');

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
