/** No wallet runtime may run between installing and successfully opening the new wallet. */
export interface FileRestoreRecord {
  restoreId: string;
  phase: 'preparing' | 'ready' | 'installing' | 'installed' | 'committed' | 'rolledBack';
  mode: 'merge' | 'replace' | 'new';
  previousMnemonic: string | null;
  mnemonic: string;
  onboarded: string | null;
}

export interface FileRestoreIO {
  read(): Promise<FileRestoreRecord | null>;
  write(record: FileRestoreRecord): Promise<void>;
  removeJournal(): Promise<void>;
  copy(
    source: 'active' | 'original' | 'staged',
    target: 'active' | 'original' | 'staged',
  ): Promise<void>;
  remove(database: 'active' | 'original' | 'staged'): Promise<void>;
  saveMnemonic(mnemonic: string | null): Promise<void>;
  saveOnboarding(value: string | null): Promise<void>;
}

/** Journal-first transitions; original snapshots are copied, never consumed by rollback. */
export class FileRestoreJournal {
  constructor(readonly io: FileRestoreIO) {}

  async begin(record: Omit<FileRestoreRecord, 'phase'>) {
    if (await this.io.read()) throw new Error('Finish the pending wallet restore first.');
    await this.io.write({ ...record, phase: 'preparing' });
    await this.io.copy('active', 'original');
    if (record.mode === 'merge') await this.io.copy('active', 'staged');
  }

  async ready() {
    const record = await this.require('preparing');
    await this.io.write({ ...record, phase: 'ready' });
  }

  async install() {
    const record = await this.require('ready');
    await this.io.write({ ...record, phase: 'installing' });
    await this.io.copy('staged', 'active');
    await this.io.saveMnemonic(record.mnemonic);
    await this.io.saveOnboarding('true');
    await this.io.write({ ...record, phase: 'installed' });
  }

  async commit() {
    const record = await this.require('installed');
    await this.io.write({ ...record, phase: 'committed' });
    await this.clear();
  }

  async rollback() {
    const record = await this.io.read();
    if (!record) return;
    if (record.phase === 'installing' || record.phase === 'installed') {
      await this.io.copy('original', 'active');
      await this.io.saveMnemonic(record.previousMnemonic);
      await this.io.saveOnboarding(record.onboarded);
      await this.io.write({ ...record, phase: 'rolledBack' });
    }
    await this.clear();
  }

  /** Returns true when startup must restart to discard caches hydrated before rollback. */
  async recover(): Promise<boolean> {
    const record = await this.io.read();
    if (!record || record.phase === 'ready' || record.phase === 'installed') return false;
    const changed = record.phase === 'installing' || record.phase === 'rolledBack';
    if (record.phase === 'installing') await this.rollback();
    else await this.clear();
    return changed;
  }

  private async clear() {
    await this.io.remove('staged');
    await this.io.remove('original');
    await this.io.removeJournal();
  }

  private async require(phase: FileRestoreRecord['phase']) {
    const record = await this.io.read();
    if (record?.phase !== phase) throw new Error('Wallet restore is not ready for this action.');
    return record;
  }
}
