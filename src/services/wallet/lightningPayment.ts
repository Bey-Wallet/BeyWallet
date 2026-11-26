import type { MeltOperation } from 'coco-cashu-core';
import {
  recordDiagnosticFailure,
  diagnosticFailureGeneration,
} from '~/services/feedback/diagnosticFailures';
import { getChangeServices } from './plugins/ChangePreparationPlugin';
import { safeWalletErrorDiagnostic } from './walletLogger';

export type LightningPaymentState = 'paid' | 'pending' | 'unresolved';

async function getManager() {
  const { initService } = require('./initService') as typeof import('./initService');
  return initService.getManager();
}

/** Own one Coco operation and its quote from preview through settlement. */
export class LightningPayment {
  private previewPromise?: Promise<{
    operationId: string;
    quote: string;
    amount: number;
    fee_reserve: number;
    expiry: number;
  }>;
  private operation?: MeltOperation;
  private submitted = false;
  private disposed = false;
  private submission?: Promise<LightningPaymentState>;
  private disposal?: Promise<void>;
  private cancelled = false;
  private preparationStage: 'initializing' | 'preparing' | 'checking_quote' = 'initializing';
  private preparationError?: ReturnType<typeof safeWalletErrorDiagnostic>;
  private preparationFailure?:
    | 'cancelled'
    | 'quote_conflict'
    | 'insufficient_balance'
    | 'connection'
    | 'keyset'
    | 'internal_api'
    | 'unknown';

  /** Fixed categories only: never include SDK messages, invoice or operation IDs. */
  get preparationDiagnostic() {
    return {
      stage: this.preparationStage,
      failure: this.preparationFailure,
      error: this.preparationError,
    };
  }

  get canRetry(): boolean {
    return this.disposed && this.cancelled && !this.submitted;
  }

  constructor(
    readonly mintUrl: string,
    readonly invoice: string,
    private manager = getManager,
    private services: () => Pick<
      ReturnType<typeof getChangeServices>,
      'walletService' | 'meltOperationService'
    > = getChangeServices,
  ) {}

  preview() {
    if (this.disposed) return Promise.reject(new Error('Invoice or mint changed'));
    return (this.previewPromise ??= this.prepare());
  }

  private async prepare() {
    const diagnosticStart = Date.now();
    const diagnosticGeneration = diagnosticFailureGeneration();
    try {
      return await this.preparePreview();
    } catch (error) {
      if (!this.disposed)
        recordDiagnosticFailure('lightning_prepare', error, diagnosticStart, diagnosticGeneration);
      this.preparationError = safeWalletErrorDiagnostic(error);
      const message = error instanceof Error ? error.message : '';
      this.preparationFailure = this.disposed
        ? 'cancelled'
        : /UNIQUE constraint failed: coco_cashu_melt_operations\./i.test(message)
          ? 'quote_conflict'
          : /insufficient|not enough|balance too low/i.test(message)
            ? 'insufficient_balance'
            : /network|offline|fetch failed|timeout|timed out/i.test(message)
              ? 'connection'
              : /keyset|MintKeys/i.test(message)
                ? 'keyset'
                : error instanceof TypeError
                  ? 'internal_api'
                  : 'unknown';
      throw error;
    }
  }

  private async preparePreview() {
    await this.manager();
    const services = this.services();
    // Retain the durable ID before preparation. The convenience Quotes API loses
    // it when preparation throws, even if proof cleanup also failed.
    this.operation = await services.meltOperationService.init(this.mintUrl, 'bolt11', {
      invoice: this.invoice,
    });
    this.preparationStage = 'preparing';
    const operation = await services.meltOperationService.prepare(this.operation.id);
    this.operation = operation;
    if (this.disposed) {
      throw new Error('Invoice or mint changed');
    }
    this.preparationStage = 'checking_quote';
    const wallet = await services.walletService.getWallet(this.mintUrl);
    const quote = await wallet.checkMeltQuoteBolt11(operation.quoteId);
    return {
      operationId: operation.id,
      quote: operation.quoteId,
      amount: operation.amount,
      fee_reserve: operation.fee_reserve + operation.swap_fee,
      expiry: quote.expiry,
    };
  }

  pay(): Promise<LightningPaymentState> {
    // Repeated actions share the same submission and never execute again after ambiguity.
    return (this.submission ??= this.submit());
  }

  private async submit(): Promise<LightningPaymentState> {
    const preview = await this.preview();
    if (this.disposed) throw new Error('Invoice or mint changed');
    if (preview.expiry && preview.expiry <= Date.now() / 1000) {
      await this.dispose();
      throw new Error('Quote expired. Review a fresh quote before paying.');
    }
    const manager = await this.manager();
    if (this.disposed) throw new Error('Invoice or mint changed');
    this.submitted = true;
    const diagnosticStart = Date.now();
    const diagnosticGeneration = diagnosticFailureGeneration();
    try {
      this.operation = await manager.quotes.executeMelt(preview.operationId);
    } catch (error) {
      recordDiagnosticFailure('lightning_pay', error, diagnosticStart, diagnosticGeneration);
      // Includes "already paid or pending". Reconcile the original operation only.
      return this.refresh();
    }
    return this.operation.state === 'finalized' ? 'paid' : 'pending';
  }

  async refresh(): Promise<LightningPaymentState> {
    const diagnosticStart = Date.now();
    const diagnosticGeneration = diagnosticFailureGeneration();
    if (this.disposed && !this.submitted && !this.cancelled) {
      // A failed rollback can be retried by Refresh, without submitting funds.
      try {
        await this.cancelPreparation();
      } catch {
        /* Keep the reservation. */
      }
    }
    if (!this.operation) return 'unresolved';
    try {
      const manager = await this.manager();
      const current = await manager.quotes.getMeltOperation(this.operation.id);
      if (current?.state === 'pending') {
        await manager.quotes.checkPendingMelt(this.operation.id);
      }
      const updated = await manager.quotes.getMeltOperation(this.operation.id);
      if (updated) this.operation = updated;
      if (updated?.state === 'finalized') return 'paid';
      if (updated?.state === 'pending' || updated?.state === 'executing') return 'pending';
    } catch (error) {
      recordDiagnosticFailure('lightning_status', error, diagnosticStart, diagnosticGeneration);
      /* Preserve ambiguity and reserved proofs. */
    }
    return 'unresolved';
  }

  dispose(): Promise<void> {
    this.disposed = true;
    return (this.disposal ??= this.cancelPreparation());
  }

  private async cancelPreparation(): Promise<void> {
    // A late preparation can reserve proofs after backgrounding. Join it before
    // reporting cancellation complete, and roll back the same operation once.
    await this.previewPromise?.catch(() => {});
    if (this.submitted) return;
    if (!this.operation) {
      // init never returned: this controller never called prepare or execute.
      this.cancelled = true;
      return;
    }
    const manager = await this.manager();
    const current = await manager.quotes.getMeltOperation(this.operation.id);
    if (current?.state === 'prepared') {
      if (this.preparationFailure && this.preparationFailure !== 'cancelled') {
        // Receipt classification only; never persist the SDK's raw error or change rollback rules.
        await manager.quotes.rollbackMelt(current.id, 'Bey: preparation failed');
      } else await manager.quotes.rollbackMelt(current.id);
      this.cancelled = true;
    } else if (!current || current.state === 'rolled_back') {
      // Coco deletes failed init operations only after releasing their proofs.
      this.cancelled = true;
    }
    if (this.cancelled) this.operation = undefined;
  }
}
