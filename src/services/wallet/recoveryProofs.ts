import {
  constructProofFromPromise,
  hash_e,
  numberToHexPadded64,
  pointFromHex,
  serializeProof,
  type DLEQ,
  type HasKeysetKeys,
  type OutputData,
  type SerializedBlindedSignature,
} from '@cashu/cashu-ts';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { equalBytes } from '@noble/curves/utils.js';
import { recoveryNow } from './recoveryTimings';

type PublicPoint = ReturnType<typeof pointFromHex>;
let generator: PublicPoint | undefined;

/** NUT-12 Alice verification. Inputs are public; never pass secret scalars here. */
export function verifyRecoveryDleq(
  dleq: Pick<DLEQ, 's' | 'e'>,
  B: PublicPoint,
  C: PublicPoint,
  A: PublicPoint,
) {
  const field = secp256k1.Point.Fn;
  const s = field.fromBytes(dleq.s);
  const e = field.fromBytes(dleq.e);
  // Preserve cashu-ts multiply()'s strict nonzero, canonical scalar contract.
  if (!field.isValidNot0(s) || !field.isValidNot0(e)) throw new Error('Invalid DLEQ scalar');
  // Use cashu-ts point instances throughout: bundled and ESM curve classes may differ.
  generator ??= pointFromHex(
    '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
  ).precompute(8);
  const R1 = generator.multiplyUnsafe(s).subtract(A.multiplyUnsafe(e));
  const R2 = B.multiplyUnsafe(s).subtract(C.multiplyUnsafe(e));
  return equalBytes(hash_e([R1, R2, A, C]), dleq.e);
}

type Timings = {
  keyPrecomputeMs: number;
  dleqVerificationMs: number;
  signatureUnblindMs: number;
};

/** Same NUT-12 checks and cashu-ts unblinding, reusing public-key multiplication tables. */
export function createRecoveryProofConverter(keyset: HasKeysetKeys, timings?: Timings) {
  // Scoped to one keyset scan. No proof secrets or blinding factors are cached.
  const publicKeys = new Map<string, ReturnType<typeof pointFromHex>>();
  return (output: OutputData, signature: SerializedBlindedSignature) => {
    if (
      signature.id !== keyset.id ||
      output.blindedMessage.id !== keyset.id ||
      !Number.isSafeInteger(signature.amount) ||
      signature.amount <= 0
    )
      throw new Error('Invalid recovery signature');
    const keyHex = keyset.keys[signature.amount];
    if (!keyHex) throw new Error('Recovery signature has no matching mint key');
    let publicKey = publicKeys.get(keyHex);
    if (!publicKey) {
      const started = recoveryNow();
      publicKey = pointFromHex(keyHex).precompute(8, false);
      publicKeys.set(keyHex, publicKey);
      if (timings) timings.keyPrecomputeMs += recoveryNow() - started;
    }
    // Parse the signature once for both DLEQ validation and unblinding.
    const blindedSignature = pointFromHex(signature.C_);
    const dleq = signature.dleq && {
      s: hexToBytes(signature.dleq.s),
      e: hexToBytes(signature.dleq.e),
    };
    if (dleq) {
      const started = recoveryNow();
      const valid = verifyRecoveryDleq(
        dleq,
        pointFromHex(output.blindedMessage.B_),
        blindedSignature,
        publicKey,
      );
      if (timings) timings.dleqVerificationMs += recoveryNow() - started;
      if (!valid) throw new Error('DLEQ verification failed on mint response');
    }
    const started = recoveryNow();
    // This uses the secret blinding factor: retain cashu-ts constant-time multiplication.
    const proof = serializeProof(
      constructProofFromPromise(
        { id: signature.id, amount: signature.amount, C_: blindedSignature },
        output.blindingFactor,
        output.secret,
        publicKey,
      ),
    );
    if (timings) timings.signatureUnblindMs += recoveryNow() - started;
    return {
      ...proof,
      ...(dleq && {
        dleq: {
          s: bytesToHex(dleq.s),
          e: bytesToHex(dleq.e),
          r: numberToHexPadded64(output.blindingFactor),
        },
      }),
    };
  };
}
