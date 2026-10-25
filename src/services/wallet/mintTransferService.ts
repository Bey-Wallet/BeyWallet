import { AppState } from 'react-native';
import type { Manager, WalletService } from 'coco-cashu-core';
import type { ExpoSqliteRepositories } from '~/storage/sqlite';
import {
  MintTransferRepository,
  type MintTransferRecord,
} from '~/storage/sqlite/repositories/MintTransferRepository';
import { supportsPaymentMethod } from './paymentMintPolicy';

export type { MintTransferRecord } from '~/storage/sqlite/repositories/MintTransferRepository';
export const TRANSFER_WAIT_MS = 20_000;
const listeners = new Set<() => void>();
export function subscribeMintTransfers(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function changed(): void {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      /* UI listeners cannot interrupt a payment. */
    }
  });
}

/** A UI deadline observes work; it never cancels or repeats a submitted payment. */
export function observeTransfer<T>(work: Promise<T>, fallback: () => T | Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      Promise.resolve().then(fallback).then(resolve, reject);
    }, TRANSFER_WAIT_MS);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function authorize(): void {
  const { useSettingsStore } =
    require('~/state/settingsStore') as typeof import('~/state/settingsStore');
  const { useAuthStore } = require('~/state/authStore') as typeof import('~/state/authStore');
  if (useSettingsStore.getState().biometricEnabled && !useAuthStore.getState().isAuthenticated)
    throw new Error('Unlock your wallet first.');
}

export class MintTransferService {
  readonly journal: MintTransferRepository;
  private submissions = new Map<string, Promise<MintTransferRecord>>();
  private checks = new Map<string, Promise<MintTransferRecord>>();
  private preparing = new Set<string>();
  private reviews = new Set<string>();
  private recovering = false;
  private feeChecks = new Set<string>();
  private stops: (() => void)[] = [];
  private timer?: ReturnType<typeof setInterval>;

  constructor(
    private manager: Manager,
    private repositories: ExpoSqliteRepositories,
    private unlock = authorize,
  ) {
    this.journal = new MintTransferRepository(repositories.db);
  }

  async prepare(source: string, target: string, amount: number): Promise<MintTransferRecord> {
    let cancelled = false;
    let record: MintTransferRecord | undefined;
    const work = (async () => {
      this.unlock();
      source = source.trim().replace(/\/+$/, '');
      target = target.trim().replace(/\/+$/, '');
      if (!source || !target || source === target) throw new Error('Select two different mints.');
      if (!Number.isSafeInteger(amount) || amount <= 0)
        throw new Error('Enter a positive amount in sats.');
      if (
        !(await this.manager.mint.isTrustedMint(source)) ||
        !(await this.manager.mint.isTrustedMint(target))
      )
        throw new Error('Select trusted mints.');
      const [sourceInfo, targetInfo] = await Promise.all([
        this.manager.mint.getMintInfo(source),
        this.manager.mint.getMintInfo(target),
      ]);
      if (
        !supportsPaymentMethod(sourceInfo, 'melt-lightning') ||
        !supportsPaymentMethod(targetInfo, 'mint-lightning')
      )
        throw new Error('These mints do not support Lightning transfers.');
      if (cancelled) throw new Error('Transfer preparation expired.');
      const balance = (await this.repositories.proofRepository.getAvailableProofs(source)).reduce(
        (sum, proof) => sum + proof.amount,
        0,
      );
      if (amount > balance) throw new Error('Insufficient balance in the source mint.');
      const quote = await this.manager.quotes.createMintQuote(target, amount);
      record = {
        id: 'transfer_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2),
        sourceMintUrl: source,
        targetMintUrl: target,
        mintQuoteId: quote.quote,
        meltQuoteId: null,
        operationId: null,
        amount,
        feeReserve: 0,
        feePaid: null,
        expiresAt: quote.expiry || null,
        state: 'draft',
        stage: 'payment',
        createdAt: Date.now(),
      };
      this.preparing.add(record.id);
      await this.journal.insert(record);
      if (cancelled) throw new Error('Transfer preparation expired.');
      if (quote.amount !== amount || quote.unit !== 'sat' || !quote.request)
        throw new Error('The destination quote does not match this transfer.');
      const operation = await this.manager.quotes.prepareMeltBolt11(source, quote.request);
      record.operationId = operation.id;
      record.meltQuoteId = operation.quoteId;
      record.feeReserve = operation.fee_reserve + operation.swap_fee;
      await this.journal.save(record);
      const meltQuote =
        (await this.repositories.meltQuoteRepository.getMeltQuote(source, operation.quoteId)) ??
        (await (await this.wallet(source)).checkMeltQuoteBolt11(operation.quoteId));
      const expiries = [quote.expiry, meltQuote?.expiry].filter(
        (value): value is number => !!value,
      );
      record.expiresAt = expiries.length ? Math.min(...expiries) : null;
      if (cancelled) throw new Error('Transfer preparation expired.');
      if (
        operation.amount !== amount ||
        operation.mintUrl.replace(/\/+$/, '') !== source ||
        (meltQuote && (meltQuote.amount !== amount || meltQuote.unit !== 'sat')) ||
        !Number.isSafeInteger(record.feeReserve) ||
        record.feeReserve < 0 ||
        !Number.isSafeInteger(amount + record.feeReserve)
      )
        throw new Error('The source quote does not match this transfer.');
      if (amount + record.feeReserve > balance)
        throw new Error('Reduce the amount to cover the maximum fee.');
      if (record.expiresAt && record.expiresAt <= Date.now() / 1000)
        throw new Error('Quotes expired. Review a new transfer.');
      record.state = 'prepared';
      await this.journal.save(record);
      await this.journal.ensureAnchor(record);
      if (cancelled) throw new Error('Transfer preparation expired.');
      this.reviews.add(record.id);
      return record;
    })()
      .catch(async (error) => {
        if (record) await this.discard(record.id);
        throw error;
      })
      .finally(() => {
        if (record) this.preparing.delete(record.id);
      });
    return observeTransfer(work, () => {
      cancelled = true;
      throw new Error('Could not prepare the transfer in time. Check your connection and retry.');
    });
  }

  execute(id: string): Promise<MintTransferRecord> {
    const existing = this.submissions.get(id);
    if (existing) return observeTransfer(existing, () => this.requireRecord(id));
    const task = this.executeOnce(id);
    this.submissions.set(id, task);
    void task.finally(() => this.submissions.delete(id)).catch(() => {});
    return observeTransfer(task, () => this.requireRecord(id));
  }

  private async executeOnce(id: string): Promise<MintTransferRecord> {
    this.unlock();
    const record = await this.requireRecord(id);
    if (record.state !== 'prepared') return record;
    if (!record.operationId) throw new Error('Review a new transfer.');
    if (record.expiresAt && record.expiresAt <= Date.now() / 1000) {
      await this.discard(id);
      throw new Error('Quotes expired. Review a new transfer.');
    }
    if (
      !(await this.manager.mint.isTrustedMint(record.sourceMintUrl)) ||
      !(await this.manager.mint.isTrustedMint(record.targetMintUrl))
    ) {
      await this.discard(id);
      throw new Error('Select trusted mints and review again.');
    }
    if (!(await this.journal.commit(id))) throw new Error('This transfer was already submitted.');
    record.state = 'committed';
    changed();
    this.reviews.delete(id);
    try {
      await this.manager.quotes.executeMelt(record.operationId);
    } catch {
      // A lost response is not evidence of failure. Check the original operation.
    }
    return this.reconcile(id).catch(() => record);
  }

  async refresh(id: string): Promise<MintTransferRecord> {
    if (this.submissions.has(id)) return this.requireRecord(id);
    let task = this.checks.get(id);
    if (!task) {
      task = this.reconcile(id);
      this.checks.set(id, task);
      void task.finally(() => this.checks.delete(id)).catch(() => {});
    }
    return observeTransfer(task, () => this.requireRecord(id));
  }

  private async reconcile(id: string): Promise<MintTransferRecord> {
    const record = await this.requireRecord(id);
    if (record.state !== 'committed' || !record.operationId) return record;
    const previousStage = record.stage;
    try {
      let operation = await this.manager.quotes.getMeltOperation(record.operationId);
      if (operation?.state === 'pending') {
        await this.manager.quotes.checkPendingMelt(record.operationId);
        operation = await this.manager.quotes.getMeltOperation(record.operationId);
      }
      // Only an operation that never started may be rolled back here.
      if (operation?.state === 'prepared') {
        await this.manager.quotes.rollbackMelt(operation.id);
        operation = await this.manager.quotes.getMeltOperation(operation.id);
      }
      if (operation?.state === 'failed' || operation?.state === 'rolled_back') {
        record.state = 'failed';
      } else if (operation?.state === 'finalized') {
        record.stage = 'issuance';
        if (record.feePaid === null && !this.feeChecks.has(id)) {
          this.feeChecks.add(id);
          void this.recordPaidFee(record, operation)
            .catch(() => {})
            .finally(() => this.feeChecks.delete(id));
        }
        const quote = await this.repositories.mintQuoteRepository.getMintQuote(
          record.targetMintUrl,
          record.mintQuoteId,
        );
        if (quote?.state === 'ISSUED') {
          record.state = 'completed';
        } else if (quote?.state === 'PAID') {
          // The existing processor owns issuance; do not redeem in a competing loop.
          await this.manager.quotes.requeuePaidMintQuotes(record.targetMintUrl);
        }
      }
      if (record.state !== 'committed' || record.stage !== previousStage) {
        await this.journal.save(record);
        changed();
      }
    } catch {
      // Keep the journal and reserved proofs after network or storage ambiguity.
    }
    return this.requireRecord(id);
  }

  async discard(id: string): Promise<void> {
    this.reviews.delete(id);
    const record = await this.journal.get(id);
    if (!record || !['draft', 'prepared'].includes(record.state)) return;
    // Recover the narrow crash window between Coco preparing and saving its ID here.
    if (!record.operationId) {
      const quote = await this.repositories.mintQuoteRepository.getMintQuote(
        record.targetMintUrl,
        record.mintQuoteId,
      );
      const prepared = await this.manager.quotes.getPreparedMeltOperations();
      const operation = prepared.find(
        (candidate) =>
          candidate.mintUrl.replace(/\/+$/, '') === record.sourceMintUrl &&
          'invoice' in candidate.methodData &&
          candidate.methodData.invoice === quote?.request,
      );
      if (operation) {
        record.operationId = operation.id;
        record.meltQuoteId = operation.quoteId;
        await this.journal.save(record);
      }
    }
    if (record.operationId) {
      const operation = await this.manager.quotes.getMeltOperation(record.operationId);
      if (operation?.state === 'prepared') await this.manager.quotes.rollbackMelt(operation.id);
      else if (operation && !['init', 'rolled_back', 'failed'].includes(operation.state)) return;
    }
    record.state = 'discarded';
    await this.journal.save(record);
  }

  private wallet(mintUrl: string) {
    return (this.manager as unknown as { walletService: WalletService }).walletService.getWallet(
      mintUrl,
    );
  }

  private async recordPaidFee(
    record: MintTransferRecord,
    operation: {
      inputAmount: number;
      needsSwap: boolean;
      fee_reserve: number;
      swap_fee: number;
      quoteId: string;
    },
  ): Promise<void> {
    const quote = await (
      await this.wallet(record.sourceMintUrl)
    ).checkMeltQuoteBolt11(operation.quoteId);
    if (quote.state !== 'PAID' || quote.amount !== record.amount) return;
    const change = (quote.change ?? []).reduce((sum, signature) => sum + signature.amount, 0);
    const paid =
      (operation.needsSwap
        ? operation.fee_reserve + operation.swap_fee
        : operation.inputAmount - record.amount) - change;
    if (!Number.isSafeInteger(paid) || paid < 0) return;
    await this.journal.saveFee(record.id, paid);
    changed();
  }

  private async requireRecord(id: string): Promise<MintTransferRecord> {
    const record = await this.journal.get(id);
    if (!record) throw new Error('Transfer record not found.');
    return record;
  }

  start(): void {
    this.stop();
    const recover = (repairExecuting = false) => {
      void this.recover(repairExecuting).catch(() => {});
    };
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') recover(true);
    });
    this.stops.push(() => subscription.remove());
    this.timer = setInterval(() => {
      if (AppState.currentState === 'active') recover();
    }, 10_000);
    recover(true);
  }

  private async recover(repairExecuting = false): Promise<void> {
    if (this.recovering) return;
    this.recovering = true;
    try {
      const records = await this.journal.unfinished();
      // Use Coco's recovery on relaunch/reconnect, never alongside our live submission.
      if (
        repairExecuting &&
        records.some((record) => record.state === 'committed') &&
        !this.submissions.size &&
        !this.preparing.size
      )
        await this.manager.recoverPendingMeltOperations().catch(() => {});
      for (const record of records) {
        if (this.preparing.has(record.id) || this.reviews.has(record.id)) continue;
        if (record.state === 'draft' || record.state === 'prepared') await this.discard(record.id);
        else await this.refresh(record.id);
      }
    } finally {
      this.recovering = false;
    }
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    this.stops.splice(0).forEach((stop) => stop());
  }
}

let current: MintTransferService | undefined;
let currentManager: Manager | undefined;
export function getMintTransferService(): MintTransferService {
  const { initService } = require('./initService') as typeof import('./initService');
  const manager = initService.getManager();
  if (manager !== currentManager) {
    current?.stop();
    current = new MintTransferService(manager, initService.getRepo());
    currentManager = manager;
  }
  return current!;
}

export function stopMintTransferService(): void {
  current?.stop();
}
