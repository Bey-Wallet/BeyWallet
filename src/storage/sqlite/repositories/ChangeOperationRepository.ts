import type { ProofService } from 'coco-cashu-core';
import type { ExpoSqliteDb } from '../db';

export type ChangeOutputs = Parameters<ProofService['recoverProofsFromOutputData']>[1];
export interface ChangeOperation {
  id: string;
  mintUrl: string;
  state: 'prepared' | 'submitted' | 'completed' | 'canceled';
  inputAmount: number;
  fee: number;
  outputAmount: number;
  inputSecrets: string[];
  outputs: ChangeOutputs;
  createdAt: number;
}

export function parseChangeOperation(row: {
  id: string;
  mintUrl: string;
  state: string;
  data: string;
}): ChangeOperation {
  try {
    const op: ChangeOperation = JSON.parse(row.data);
    if (
      op.id !== row.id ||
      op.mintUrl !== row.mintUrl ||
      op.state !== row.state ||
      !['prepared', 'submitted', 'completed', 'canceled'].includes(op.state) ||
      !Number.isSafeInteger(op.inputAmount) ||
      op.inputAmount <= 0 ||
      !Number.isSafeInteger(op.fee) ||
      op.fee < 0 ||
      op.outputAmount !== op.inputAmount - op.fee ||
      op.outputAmount <= 0 ||
      !Array.isArray(op.inputSecrets) ||
      !op.inputSecrets.length ||
      op.inputSecrets.some((secret) => typeof secret !== 'string' || !secret.length) ||
      new Set(op.inputSecrets).size !== op.inputSecrets.length ||
      !Array.isArray(op.outputs?.keep) ||
      op.outputs.send?.length !== 0 ||
      op.outputs.keep.some(
        (output) =>
          !Number.isSafeInteger(output.blindedMessage?.amount) ||
          output.blindedMessage.amount <= 0 ||
          typeof output.blindedMessage.id !== 'string' ||
          !/^(02|03)[0-9a-f]{64}$/i.test(output.blindedMessage.B_) ||
          !/^[0-9a-f]+$/i.test(output.blindingFactor) ||
          !/^([0-9a-f]{2})+$/i.test(output.secret),
      ) ||
      new Set(op.outputs.keep.map((output) => output.secret)).size !== op.outputs.keep.length ||
      (op.outputs.keep.length &&
        op.outputs.keep.reduce((sum, output) => sum + output.blindedMessage.amount, 0) !==
          op.outputAmount) ||
      (['submitted', 'completed'].includes(op.state) && !op.outputs.keep.length)
    )
      throw new Error();
    return op;
  } catch {
    throw new Error('Invalid change operation record.');
  }
}

export class ChangeOperationRepository {
  constructor(private db: ExpoSqliteDb) {}
  async get(id: string): Promise<ChangeOperation | null> {
    const row = await this.db.get<{ id: string; mintUrl: string; state: string; data: string }>(
      'SELECT id, mintUrl, state, data FROM bey_change_operations WHERE id = ?',
      [id],
    );
    return row ? parseChangeOperation(row) : null;
  }
  async pending(mintUrl?: string): Promise<ChangeOperation[]> {
    const rows = await this.db.all<{ id: string; mintUrl: string; state: string; data: string }>(
      `SELECT id, mintUrl, state, data FROM bey_change_operations WHERE state IN ('prepared', 'submitted')${mintUrl ? ' AND mintUrl = ?' : ''} ORDER BY createdAt`,
      mintUrl ? [mintUrl] : [],
    );
    return rows.map(parseChangeOperation);
  }
  async save(operation: ChangeOperation): Promise<void> {
    await this.db.transaction((db) =>
      db.run(
        `INSERT INTO bey_change_operations (id, mintUrl, state, data, createdAt)
      VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET state=excluded.state, data=excluded.data`,
        [
          operation.id,
          operation.mintUrl,
          operation.state,
          JSON.stringify(operation),
          operation.createdAt,
        ],
      ),
    );
  }
}
