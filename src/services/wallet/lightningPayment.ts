import type { Manager, MeltOperation, WalletService } from 'coco-cashu-core';

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

  constructor(
    readonly mintUrl: string,
    readonly invoice: string,
    private manager = getManager,
  ) {}

  preview() {
    return (this.previewPromise ??= this.prepare());
  }

  private async prepare() {
    const manager = await this.manager();
    const operation = await manager.quotes.prepareMeltBolt11(this.mintUrl, this.invoice);
    this.operation = operation;
    if (this.disposed) {
      await manager.quotes.rollbackMelt(operation.id);
      throw new Error('Invoice or mint changed');
    }
    const wallet = await (
      manager as unknown as { walletService: WalletService }
    ).walletService.getWallet(this.mintUrl);
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
    this.submitted = true;
    try {
      this.operation = await manager.quotes.executeMelt(preview.operationId);
    } catch {
      // Includes "already paid or pending". Reconcile the original operation only.
      return this.refresh();
    }
    return this.operation.state === 'finalized' ? 'paid' : 'pending';
  }

  async refresh(): Promise<LightningPaymentState> {
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
    } catch {
      /* Preserve ambiguity and reserved proofs. */
    }
    return 'unresolved';
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    if (!this.submitted && this.operation?.state === 'prepared') {
      const manager = await this.manager();
      await manager.quotes.rollbackMelt(this.operation.id);
      this.operation = undefined;
    }
  }
}
