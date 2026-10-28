import { feedbackCoordinator } from '~/services/feedback/feedbackCoordinator';

/** Scheduling only: this boundary never reads seeds, proofs or wallet repositories. */
export class RecoveryCoordinator {
  private pauses = new Set<symbol>();
  private listeners = new Set<() => void>();
  private drains = new Set<() => Promise<void>>();
  private jobs = new Map<string, Promise<unknown>>();
  private tail: Promise<void> = Promise.resolve();
  private maintenanceJobs = new Map<
    string,
    {
      promise: Promise<void>;
      task: () => Promise<void>;
      generation: number;
      dirty: boolean;
    }
  >();
  private activeMaintenance = new Set<Promise<void>>();
  private lifecycleLocks = 0;
  private epoch = 0;

  get paused(): boolean {
    return this.pauses.size > 0;
  }

  get generation(): number {
    return this.epoch;
  }

  has(mintUrl: string): boolean {
    return this.jobs.has(mintUrl);
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  registerDrain(drain: () => Promise<void>): () => void {
    this.drains.add(drain);
    return () => {
      this.drains.delete(drain);
    };
  }

  pause(): () => void {
    const releaseFeedback = feedbackCoordinator.suppress();
    const token = Symbol();
    this.pauses.add(token);
    this.listeners.forEach((listener) => listener());
    return () => {
      if (!this.pauses.delete(token)) return;
      releaseFeedback();
      this.listeners.forEach((listener) => listener());
    };
  }

  /** A lifecycle mutation must not dispose a manager underneath a live scan. */
  beginLifecycle(): () => void {
    if (this.jobs.size)
      throw new Error('Wait for wallet recovery to finish before changing the wallet.');
    this.lifecycleLocks++;
    this.epoch++;
    const resume = this.pause();
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.lifecycleLocks--;
      resume();
    };
  }

  async drainBackground(): Promise<void> {
    await Promise.all([...this.drains].map((drain) => drain()));
    await this.drainMaintenance();
  }

  async drainMaintenance(): Promise<void> {
    await Promise.all([...this.activeMaintenance]);
  }

  enqueue<T>(mintUrl: string, task: () => Promise<T>): Promise<T> {
    const existing = this.jobs.get(mintUrl);
    if (existing) return existing as Promise<T>;
    if (this.lifecycleLocks)
      return Promise.reject(new Error('Wallet is changing. Try recovery again.'));
    const resume = this.pause();
    const result = this.tail.then(async () => {
      await this.drainBackground();
      return task();
    });
    const finished = result.finally(() => {
      this.jobs.delete(mintUrl);
      resume();
    });
    this.jobs.set(mintUrl, finished);
    this.tail = finished.then(
      () => undefined,
      () => undefined,
    );
    return finished;
  }

  private async waitUntilResumed(): Promise<void> {
    if (!this.paused) return;
    await new Promise<void>((resolve) => {
      const unsubscribe = this.subscribe(() => {
        if (!this.paused) {
          unsubscribe();
          resolve();
        }
      });
    });
  }

  /** Coalesce a key's triggers, retaining a trailing run when work changes mid-flight. */
  maintenance(key: string, task: () => Promise<void>): Promise<void> {
    const existing = this.maintenanceJobs.get(key);
    if (existing) {
      existing.task = task;
      existing.generation = this.epoch;
      existing.dirty = true;
      return existing.promise;
    }
    const entry = { task, generation: this.epoch, dirty: true, promise: Promise.resolve() };
    const result = Promise.resolve()
      .then(async () => {
        while (entry.dirty) {
          await this.waitUntilResumed();
          if (entry.generation !== this.epoch) return;
          // A pause can have been acquired after the waiter resolved.
          if (this.paused) continue;
          entry.dirty = false;
          const active = entry.task();
          this.activeMaintenance.add(active);
          try {
            await active;
          } finally {
            this.activeMaintenance.delete(active);
          }
          await yieldWalletWork();
        }
      })
      .finally(() => {
        this.maintenanceJobs.delete(key);
      });
    entry.promise = result;
    this.maintenanceJobs.set(key, entry);
    return result;
  }
}

export const recoveryCoordinator = new RecoveryCoordinator();
export const yieldWalletWork = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
