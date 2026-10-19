/** One confirmation action, including its optional authentication prompt. */
export class PaymentConfirmation {
  private pending?: Promise<boolean>;

  confirm(options: {
    biometricEnabled: boolean;
    authenticate: () => Promise<boolean>;
    execute: () => Promise<void>;
  }): Promise<boolean> {
    if (this.pending) return this.pending;
    const run = async () => {
      if (options.biometricEnabled && !(await options.authenticate())) return false;
      await options.execute();
      return true;
    };
    this.pending = run().finally(() => {
      this.pending = undefined;
    });
    return this.pending;
  }
}
