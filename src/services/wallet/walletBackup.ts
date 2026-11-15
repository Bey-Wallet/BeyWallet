import * as bip39 from 'bip39';
import { parseChangeOperation } from '~/storage/sqlite/repositories/ChangeOperationRepository';

export interface WalletState {
  mints: any[];
  keysets: any[];
  proofs: any[];
  counters: any[];
  history: any[];
  mintQuotes: any[];
  sendOperations: any[];
  meltOperations: any[];
  changeOperations?: any[];
  meltQuotes?: any[];
  keypairs?: any[];
}

export interface WalletBackup extends WalletState {
  version: number;
  mnemonic: string;
  secondaryCurrency: string;
  theme: 'system' | 'light' | 'dark';
  exportedAt: string;
}

export function normalizeBackupMnemonic(value: string): string {
  if (typeof value !== 'string') throw new Error('Invalid backup recovery phrase.');
  return value.normalize('NFKD').trim().toLowerCase().split(/\s+/).join(' ');
}

export function sameBackupIdentity(left: string, right: string): boolean {
  // Compare BIP39 identity, never cached public keys or phrase presentation.
  return (
    bip39.mnemonicToEntropy(normalizeBackupMnemonic(left)) ===
    bip39.mnemonicToEntropy(normalizeBackupMnemonic(right))
  );
}

const fields = [
  'mints',
  'keysets',
  'proofs',
  'counters',
  'history',
  'mintQuotes',
  'sendOperations',
  'meltOperations',
  'changeOperations',
  'meltQuotes',
  'keypairs',
] as const;

/** Structural validation is followed by schema/constraint validation in an isolated database. */
export function parseWalletBackup(value: unknown): WalletBackup {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid wallet backup.');
  const input = value as Record<string, any>;
  const mnemonic = normalizeBackupMnemonic(input.mnemonic ?? input['cashu.mnemonic'] ?? '');
  if (!bip39.validateMnemonic(mnemonic)) throw new Error('Invalid backup recovery phrase.');
  const version = input.version ?? 1;
  if (!Number.isInteger(version) || version < 1 || version > 4)
    throw new Error('Unsupported wallet backup version.');
  const state = {} as WalletState;
  for (const field of fields) {
    let rows = input[field];
    if (field === 'proofs' && rows === undefined && input['cashu.dexie.db.proofs']) {
      try {
        rows = JSON.parse(input['cashu.dexie.db.proofs']);
      } catch {
        throw new Error('Invalid backup proofs.');
      }
    }
    if (rows === undefined) rows = [];
    if (
      !Array.isArray(rows) ||
      rows.some((row) => !row || typeof row !== 'object' || Array.isArray(row))
    )
      throw new Error(`Invalid backup ${field}.`);
    state[field] = rows.map((row) => ({ ...row }));
    for (const row of state[field]!) {
      for (const [key, encoded] of Object.entries(row)) {
        if (
          (!key.endsWith('Json') &&
            !(field === 'mints' && key === 'mintInfo') &&
            !(field === 'keysets' && key === 'keypairs')) ||
          encoded === null ||
          encoded === undefined
        )
          continue;
        try {
          if (typeof encoded !== 'string') throw new Error();
          const decoded = JSON.parse(encoded);
          if (!decoded || typeof decoded !== 'object') throw new Error();
          if (
            key === 'inputProofSecretsJson' &&
            (!Array.isArray(decoded) ||
              decoded.some((secret) => typeof secret !== 'string' || !secret))
          )
            throw new Error();
          if (['outputDataJson', 'changeOutputDataJson', 'swapOutputDataJson'].includes(key)) {
            if (!Array.isArray(decoded.keep) || !Array.isArray(decoded.send)) throw new Error();
            for (const output of [...decoded.keep, ...decoded.send]) {
              if (
                !output ||
                typeof output.secret !== 'string' ||
                !output.secret ||
                typeof output.blindingFactor !== 'string' ||
                !/^[0-9a-f]+$/i.test(output.blindingFactor) ||
                !output.blindedMessage ||
                !Number.isSafeInteger(output.blindedMessage.amount) ||
                output.blindedMessage.amount < 0 ||
                !/^(02|03)[0-9a-f]{64}$/i.test(output.blindedMessage.B_) ||
                typeof output.blindedMessage.id !== 'string'
              )
                throw new Error();
            }
          }
        } catch {
          throw new Error(`Invalid backup ${field} data.`);
        }
      }
    }
  }
  if (
    version === 4 &&
    [
      'mints',
      'keysets',
      'proofs',
      'counters',
      'history',
      'mintQuotes',
      'sendOperations',
      'meltOperations',
      'meltQuotes',
      'keypairs',
    ].some((field) => input[field] === undefined)
  )
    throw new Error('Incomplete wallet backup.');
  for (const proof of state.proofs) {
    if (version < 4) {
      proof.state ??= 'ready';
      proof.createdAt ??= Math.floor(Date.now() / 1000);
    }
    if (
      typeof proof.mintUrl !== 'string' ||
      !proof.mintUrl ||
      typeof proof.secret !== 'string' ||
      !proof.secret ||
      typeof proof.id !== 'string' ||
      !proof.id ||
      !/^(02|03)[0-9a-f]{64}$/i.test(proof.C) ||
      !Number.isSafeInteger(proof.amount) ||
      proof.amount <= 0 ||
      !['ready', 'inflight', 'spent'].includes(proof.state)
    )
      throw new Error('Invalid backup proof record.');
  }
  for (const counter of state.counters) {
    if (
      !counter.mintUrl ||
      !counter.keysetId ||
      !Number.isSafeInteger(counter.counter) ||
      counter.counter < 0
    )
      throw new Error('Invalid backup counter.');
  }
  for (const operation of state.changeOperations ?? []) parseChangeOperation(operation);
  for (const operation of [...state.sendOperations, ...state.meltOperations]) {
    if (
      !operation.id ||
      !operation.mintUrl ||
      !Number.isSafeInteger(operation.updatedAt) ||
      ![
        'init',
        'prepared',
        'executing',
        'pending',
        'finalized',
        'rolling_back',
        'rolled_back',
      ].includes(operation.state)
    )
      throw new Error('Invalid backup payment operation.');
    if (['prepared', 'executing', 'pending', 'rolling_back'].includes(operation.state)) {
      if (
        !Number.isSafeInteger(operation.inputAmount) ||
        operation.inputAmount <= 0 ||
        ![0, 1].includes(operation.needsSwap) ||
        typeof operation.inputProofSecretsJson !== 'string' ||
        !JSON.parse(operation.inputProofSecretsJson).length ||
        (operation.needsSwap === 1 && !operation.outputDataJson && !operation.swapOutputDataJson)
      )
        throw new Error('Backup payment recovery information is incomplete.');
    }
  }
  const theme = input.theme ?? 'system';
  if (!['system', 'light', 'dark'].includes(theme)) throw new Error('Invalid backup theme.');
  const secondaryCurrency =
    input.secondaryCurrency ?? input['cashu.settings.bitcoinPriceCurrency'] ?? 'USD';
  if (typeof secondaryCurrency !== 'string' || !/^[A-Za-z]{3,8}$/.test(secondaryCurrency))
    throw new Error('Invalid backup currency.');
  return {
    ...state,
    version,
    mnemonic,
    secondaryCurrency,
    theme,
    exportedAt: input.exportedAt ?? '',
  };
}
