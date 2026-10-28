import { OutputData, hasValidDleq, type Proof } from '@cashu/cashu-ts';
import type { CoreProof } from 'coco-cashu-core';
import type { NPCClient } from 'npubcash-sdk';
import { Buffer } from 'buffer';
import { DeviceEventEmitter } from 'react-native';
import { publishWalletFeedback, quoteFeedbackId } from '~/services/feedback/feedbackCoordinator';
import type { ExpoSqliteRepositories } from '~/storage/sqlite';
import {
  LightningAddressRepository,
  type LightningReceipt,
} from '~/storage/sqlite/repositories/LightningAddressRepository';
import { ExpoProofRepository } from '~/storage/sqlite/repositories/ProofRepository';
import { ExpoHistoryRepository } from '~/storage/sqlite/repositories/HistoryRepository';
import { useLightningAddressStore } from '~/state/lightningAddressStore';
import type { ChangeServices } from './plugins/ChangePreparationPlugin';
import { NPUB_CASH, LEGACY_NPUB_CASH } from '~/services/api/npubCashClient';

type Preferences = {
  enabled: boolean;
  autoCollect: boolean;
  receivingMint: string;
  lastChecked: number;
};
export class LightningAddressError extends Error {}
export class LightningAddressService {
  private startedAt = Date.now();
  private queue: Promise<unknown> = Promise.resolve();
  private preferences: Preferences = {
    enabled: false,
    autoCollect: true,
    receivingMint: '',
    lastChecked: 0,
  };
  private journal: LightningAddressRepository;
  private disposed = false;
  private generation = 0;
  invalidate() {
    this.generation++;
  }
  constructor(
    private repos: ExpoSqliteRepositories,
    private services: ChangeServices,
    private owner: string,
    private privateKey: string,
    private client: (provider: string) => NPCClient,
    private allowed: () => boolean,
  ) {
    this.journal = new LightningAddressRepository(repos.db, owner);
  }

  private serial<T>(work: () => Promise<T>): Promise<T> {
    const result = this.queue.then(work);
    this.queue = result.catch(() => {});
    return result;
  }
  private requireActive(collect = false, generation = this.generation) {
    if (
      generation !== this.generation ||
      this.disposed ||
      !this.allowed() ||
      (collect && !this.preferences.enabled)
    )
      throw new LightningAddressError('Unlock your wallet and go online to continue.');
  }
  async load() {
    const value = await this.repos.settingsRepository.getSetting(`lightningAddress:${this.owner}`);
    if (this.disposed) return;
    if (value) this.preferences = { ...this.preferences, ...JSON.parse(value) };
    await this.publish();
  }
  private async publish() {
    const pending = (await this.journal.list()).filter((r) => r.state !== 'completed');
    if (!this.disposed)
      useLightningAddressStore.setState({ ...this.preferences, loaded: true, pending });
  }
  private async save(preferences: Preferences) {
    await this.repos.settingsRepository.setSetting(
      `lightningAddress:${this.owner}`,
      JSON.stringify(preferences),
    );
    this.preferences = preferences;
    await this.publish();
  }
  async eligibleMint(mintUrl: string) {
    const generation = this.generation;
    this.requireActive();
    if (!(await this.repos.mintRepository.isTrustedMint(mintUrl)))
      throw new LightningAddressError('Connect and trust this mint before collecting.');
    this.requireActive(false, generation);
    const { wallet } = await this.services.walletService.getWalletWithActiveKeysetId(mintUrl);
    this.requireActive(false, generation);
    const info = await wallet.mint.getInfo();
    this.requireActive(false, generation);
    if (
      !info.nuts?.[9]?.supported ||
      info.nuts?.[4]?.disabled ||
      !info.nuts?.[4]?.methods?.some((m) => m.method === 'bolt11' && m.unit === 'sat')
    )
      throw new LightningAddressError(
        'Choose a SAT mint with Lightning minting and output recovery support.',
      );
    return wallet;
  }
  setReceivingMint(mintUrl: string) {
    return this.serial(async () => {
      const generation = this.generation;
      this.requireActive();
      await this.eligibleMint(mintUrl);
      this.requireActive(false, generation);
      const result = await this.client(NPUB_CASH).settings.setMintUrl(mintUrl);
      this.requireActive(false, generation);
      if (
        result.error ||
        result.data.user.mintUrl.replace(/\/+$/, '') !== mintUrl.replace(/\/+$/, '')
      )
        throw new LightningAddressError('Provider did not confirm the receiving mint.');
      await this.save({ ...this.preferences, receivingMint: mintUrl });
    });
  }
  enable() {
    return this.serial(async () => {
      const generation = this.generation;
      this.requireActive();
      if (!this.preferences.receivingMint)
        throw new LightningAddressError('Choose a receiving mint first.');
      await this.eligibleMint(this.preferences.receivingMint);
      const info = await this.client(NPUB_CASH).getInfo();
      this.requireActive(false, generation);
      if (info.mintUrl.replace(/\/+$/, '') !== this.preferences.receivingMint.replace(/\/+$/, ''))
        throw new LightningAddressError(
          'Select the receiving mint again to confirm it with npub.cash.',
        );
      await this.save({ ...this.preferences, enabled: true });
    });
  }
  // Stop new work immediately; queued preference persistence waits for submitted issuance.
  disable() {
    this.invalidate();
    this.preferences.enabled = false;
    useLightningAddressStore.setState({ enabled: false, connection: 'Disabled' });
    return this.serial(() => this.save({ ...this.preferences, enabled: false }));
  }
  setAutoCollect(autoCollect: boolean) {
    this.preferences.autoCollect = autoCollect;
    return this.serial(() => this.save({ ...this.preferences, autoCollect }));
  }
  sync(provider = NPUB_CASH) {
    return this.serial(async () => {
      const generation = this.generation;
      this.requireActive(provider !== LEGACY_NPUB_CASH);
      if (![NPUB_CASH, LEGACY_NPUB_CASH].includes(provider))
        throw new Error('Unsupported provider');
      // Reconcile ambiguous submissions before discovering new work, even in manual mode.
      for (const receipt of await this.journal.list()) {
        if (receipt.state === 'submitted') await this.tryCollect(receipt);
      }
      const checkpoint = await this.journal.checkpoint(provider);
      const quotes = await this.client(provider).getQuotesSince(Math.max(0, checkpoint - 1));
      this.requireActive(provider !== LEGACY_NPUB_CASH, generation);
      await this.repos.db.transaction(async (db) => {
        this.requireActive(provider !== LEGACY_NPUB_CASH, generation);
        const journal = new LightningAddressRepository(db, this.owner);
        let latest = checkpoint;
        for (const quote of quotes) {
          const mintUrl = new URL(quote.mintUrl);
          if (
            mintUrl.protocol !== 'https:' ||
            mintUrl.username ||
            mintUrl.password ||
            mintUrl.search ||
            mintUrl.hash ||
            !quote.quoteId ||
            !Number.isSafeInteger(quote.amount) ||
            quote.amount <= 0 ||
            !Number.isSafeInteger(quote.paidAt) ||
            quote.paidAt < 0
          )
            throw new Error('Invalid incoming payment metadata.');
          const mint = mintUrl.href.replace(/\/+$/, '');
          const existing = await journal.get(mint, quote.quoteId);
          if (existing) {
            if (!existing.providers.includes(provider))
              await journal.save({ ...existing, providers: [...existing.providers, provider] });
          } else {
            await journal.save({
              mintUrl: mint,
              quoteId: quote.quoteId,
              amount: quote.amount,
              request: quote.request,
              locked: quote.locked,
              paidAt: quote.paidAt,
              providers: [provider],
              state: 'pending',
            });
          }
          latest = Math.max(latest, quote.paidAt);
        }
        await journal.advance(provider, latest);
      });
      await this.save({ ...this.preferences, lastChecked: Date.now() });
      if (this.preferences.autoCollect && this.preferences.enabled)
        for (const receipt of await this.journal.list()) {
          if (
            !this.preferences.autoCollect ||
            !this.allowed() ||
            !this.preferences.enabled ||
            this.disposed
          )
            break;
          if (receipt.state !== 'completed') await this.tryCollect(receipt);
        }
      await this.publish();
    });
  }
  collect(mintUrl: string, quoteId: string) {
    return this.serial(async () => {
      const receipt = await this.journal.get(mintUrl, quoteId);
      if (receipt && receipt.state !== 'completed') await this.tryCollect(receipt);
      await this.publish();
    });
  }
  collectAll() {
    return this.serial(async () => {
      for (const receipt of await this.journal.list()) {
        if (receipt.state !== 'completed') await this.tryCollect(receipt);
      }
      await this.publish();
    });
  }
  private async tryCollect(receipt: LightningReceipt) {
    try {
      await this.issue(receipt);
    } catch (error) {
      // SDK errors can contain quote/proof material. Persist only our actionable messages.
      const issue =
        error instanceof LightningAddressError
          ? error.message
          : 'Collection is unfinished. Reconnect and retry; prepared outputs are retained.';
      await this.journal.save({ ...receipt, issue });
    }
  }
  private output(output: NonNullable<LightningReceipt['outputs']>[number]) {
    return new OutputData(
      output.blindedMessage,
      BigInt('0x' + output.blindingFactor),
      new Uint8Array(Buffer.from(output.secret, 'hex')),
    );
  }
  private async issue(receipt: LightningReceipt) {
    const generation = this.generation;
    this.requireActive(true);
    if (!(await this.repos.mintRepository.isTrustedMint(receipt.mintUrl)))
      throw new CollectionError('Connect and trust this mint to collect this payment.');
    const wallet = await this.eligibleMint(receipt.mintUrl);
    const quote = await wallet.mint.checkMintQuoteBolt11(receipt.quoteId);
    if (quote.quote !== receipt.quoteId || quote.unit !== 'sat' || quote.amount !== receipt.amount)
      throw new CollectionError('Mint quote details do not match this payment.');
    if (
      quote.pubkey &&
      quote.pubkey !== this.owner &&
      !['02' + this.owner, '03' + this.owner].includes(quote.pubkey)
    )
      throw new CollectionError('This quote is locked to a different key.');
    if (receipt.locked && !quote.pubkey)
      throw new CollectionError(
        'The mint did not return the expected quote lock. Retry after checking mint support.',
      );
    if (!receipt.outputs?.length) {
      this.requireActive(true, generation);
      if (quote.state !== 'PAID')
        throw new CollectionError(
          quote.state === 'ISSUED'
            ? 'Already issued elsewhere. Recover this mint before collecting again.'
            : 'Waiting for the mint to confirm payment.',
        );
      const outputs = await this.services.proofService.createOutputsAndIncrementCounters(
        receipt.mintUrl,
        { keep: receipt.amount, send: 0 },
      );
      receipt.outputs = outputs.keep.map((output) => ({
        blindedMessage: { ...output.blindedMessage },
        blindingFactor: output.blindingFactor.toString(16),
        secret: Buffer.from(output.secret).toString('hex'),
      }));
      if (
        !receipt.outputs.length ||
        receipt.outputs.reduce((sum, o) => sum + o.blindedMessage.amount, 0) !== receipt.amount
      )
        throw new CollectionError('Could not prepare the payment outputs.');
      receipt.state = 'prepared';
      await this.journal.save(receipt);
    }
    this.requireActive(true, generation);
    const restored = await wallet.mint.restore({
      outputs: receipt.outputs.map((o) => o.blindedMessage),
    });
    let proofs: Proof[];
    if (restored.outputs.length) {
      if (
        restored.outputs.length !== receipt.outputs.length ||
        restored.signatures.length !== restored.outputs.length
      )
        throw new CollectionError('Incomplete mint recovery. Retry collection.');
      proofs = [];
      for (let i = 0; i < restored.outputs.length; i++) {
        const output = receipt.outputs.find((o) => o.blindedMessage.B_ === restored.outputs[i].B_);
        const signature = restored.signatures[i];
        if (
          !output ||
          signature.id !== output.blindedMessage.id ||
          signature.amount !== output.blindedMessage.amount
        )
          throw new CollectionError('Unexpected recovery output.');
        const keyset = await this.repos.keysetRepository.getKeysetById(
          receipt.mintUrl,
          signature.id,
        );
        if (!keyset || keyset.unit !== 'sat') throw new CollectionError('Missing recovery keys.');
        const keys = { id: keyset.id, keys: keyset.keypairs };
        const proof = this.output(output).toProof(signature, keys);
        if (proof.dleq && !hasValidDleq(proof, keys))
          throw new CollectionError('Invalid recovery proof.');
        proofs.push(proof);
      }
    } else {
      if (quote.state !== 'PAID')
        throw new CollectionError(
          'Mint issuance is uncertain. Keep this payment pending and retry recovery.',
        );
      this.requireActive(true, generation);
      receipt.state = 'submitted';
      if (!(await this.repos.mintRepository.isTrustedMint(receipt.mintUrl)))
        throw new CollectionError('Connect and trust this mint to collect this payment.');
      this.requireActive(true, generation);
      await this.journal.save(receipt);
      this.requireActive(true, generation);
      // Once submitted, persist the result even if the app locks or receiving is disabled.
      proofs = await wallet.mintProofsBolt11(
        receipt.amount,
        quote,
        { privkey: this.privateKey },
        { type: 'custom', data: receipt.outputs.map((o) => this.output(o)) },
      );
    }
    const expected = new Map(
      receipt.outputs.map((o) => [Buffer.from(o.secret, 'hex').toString('utf8'), o.blindedMessage]),
    );
    if (
      proofs.length !== expected.size ||
      new Set(proofs.map((p) => p.secret)).size !== expected.size ||
      proofs.some((p) => {
        const o = expected.get(p.secret);
        return !o || o.id !== p.id || o.amount !== p.amount;
      }) ||
      proofs.reduce((sum, p) => sum + p.amount, 0) !== receipt.amount
    )
      throw new CollectionError('Mint returned unexpected proofs. Retry recovery.');
    for (const proof of proofs) {
      const keys = await this.repos.keysetRepository.getKeysetById(receipt.mintUrl, proof.id);
      if (
        !keys ||
        keys.unit !== 'sat' ||
        (proof.dleq && !hasValidDleq(proof, { id: keys.id, keys: keys.keypairs }))
      )
        throw new CollectionError('Invalid mint proof.');
    }
    const states = await wallet.checkProofsStates(proofs);
    if (states.length !== proofs.length || !states.every((s) => s.state === 'UNSPENT'))
      throw new CollectionError('Recovered coins are not confirmed unspent.');
    const coreProofs = proofs.map(
      (p) => ({ ...p, mintUrl: receipt.mintUrl, state: 'ready' }) as CoreProof,
    );
    const entry = await this.repos.db.transaction(async (db) => {
      const journal = new LightningAddressRepository(db, this.owner);
      if ((await journal.get(receipt.mintUrl, receipt.quoteId))?.state === 'completed') return;
      await new ExpoProofRepository(db).saveProofs(receipt.mintUrl, coreProofs);
      const entry = await new ExpoHistoryRepository(db).addHistoryEntry({
        type: 'mint',
        mintUrl: receipt.mintUrl,
        quoteId: receipt.quoteId,
        unit: 'sat',
        amount: receipt.amount,
        state: 'ISSUED',
        paymentRequest: receipt.request,
        createdAt: receipt.paidAt * 1000,
        metadata: { source: 'lightning-address' },
      });
      await journal.save({ ...receipt, state: 'completed', outputs: undefined, issue: undefined });
      return entry;
    });
    receipt.state = 'completed';
    if (entry) {
      await this.services.eventBus
        .emit('proofs:saved', {
          mintUrl: receipt.mintUrl,
          keysetId: proofs[0].id,
          proofs: coreProofs,
        })
        .catch(() => {});
      await this.services.eventBus
        .emit('history:updated', { mintUrl: receipt.mintUrl, entry })
        .catch(() => {});
      await publishWalletFeedback({
        entity: { type: 'quote', id: quoteFeedbackId(receipt.mintUrl, receipt.quoteId) },
        parentOperationId: receipt.quoteId,
        kind: 'received',
        state: 'completed',
        origin: receipt.paidAt * 1000 >= this.startedAt ? 'live' : 'catch-up',
        target: { type: 'transaction', id: String(entry.id) },
        details: { amount: receipt.amount },
      });
      DeviceEventEmitter.emit('lightning-address:received', { amount: receipt.amount });
    }
  }
  async dispose() {
    this.disposed = true;
    await this.queue;
    this.privateKey = '';
  }
}
class CollectionError extends LightningAddressError {}
