import { splitAmount, type Token, type Wallet } from '@cashu/cashu-ts';
import type { CoreProof, Manager, WalletService } from 'coco-cashu-core';
import { nip44 } from 'nostr-tools';
import { hexToBytes } from '@noble/hashes/utils.js';
import { isPaymentMintAllowed, type ParsedPaymentRequest } from './paymentRequestModel';
import { createPaymentRequestPayload } from './paymentRequestDelivery';
import {
  preparePaymentRequestPublication,
  publishPaymentRequest,
  type PaymentRequestPublication,
} from './paymentRequestPublisher';
import { resolveNostrRecipient } from './nostrService';
import { seedService } from '~/services/platform/seedService';

export interface PaymentRequestCost {
  mintUrl: string;
  amount: number;
  grossAmount: number;
  receiverFee: number;
  senderFee: number;
  totalDebit: number;
}

// Coco rc.47 exposes wallet access only internally; keep the existing compatibility boundary narrow.
function wallets(manager: Manager): WalletService {
  return (manager as unknown as { walletService: WalletService }).walletService;
}

// Matches Coco's exact-match selection and swap output split without reserving proofs/counters.
export function calculatePaymentRequestCost(
  amount: number,
  mintUrl: string,
  wallet: Pick<Wallet, 'selectProofsToSend' | 'getFeesForKeyset' | 'getFeesForProofs'>,
  proofs: CoreProof[],
  keys: Parameters<typeof splitAmount>[1],
  keysetId: string,
): PaymentRequestCost {
  let grossAmount = amount;
  for (let attempt = 0; attempt < 100; attempt++) {
    const exact = wallet.selectProofsToSend(proofs, grossAmount, false).send;
    const exactAmount = exact.reduce((sum, proof) => sum + proof.amount, 0);
    const needsSwap = exact.length === 0 || exactAmount !== grossAmount;
    const receiverFee = needsSwap
      ? wallet.getFeesForKeyset(splitAmount(grossAmount, keys).length, keysetId)
      : wallet.getFeesForProofs(exact);
    if (!Number.isSafeInteger(receiverFee) || receiverFee < 0) {
      throw new Error('Unsupported receiver fee requirements');
    }
    if (grossAmount - receiverFee < amount) {
      grossAmount = amount + receiverFee;
      continue;
    }
    const selected = needsSwap ? wallet.selectProofsToSend(proofs, grossAmount, true).send : exact;
    const senderFee = needsSwap ? wallet.getFeesForProofs(selected) : 0;
    const totalDebit = grossAmount + senderFee;
    if (
      !Number.isSafeInteger(totalDebit) ||
      selected.reduce((sum, proof) => sum + proof.amount, 0) < totalDebit
    ) {
      throw new Error('No compatible funded mint has enough balance including fees');
    }
    return { mintUrl, amount, grossAmount, receiverFee, senderFee, totalDebit };
  }
  throw new Error('Unsupported receiver fee requirements');
}

export async function previewPaymentRequest(request: ParsedPaymentRequest, mintUrl: string) {
  if (!isPaymentMintAllowed(request, mintUrl))
    throw new Error('Mint is not accepted by the recipient');
  const { initService } = require('./initService') as typeof import('./initService');
  const manager = initService.getManager();
  if (!(await manager.mint.isTrustedMint(mintUrl))) throw new Error('Mint is not trusted');
  const { wallet, keys, keysetId } = await wallets(manager).getWalletWithActiveKeysetId(mintUrl);
  const proofs = await initService.getRepo().proofRepository.getAvailableProofs(mintUrl);
  return calculatePaymentRequestCost(request.amount, mintUrl, wallet, proofs, keys.keys, keysetId);
}

export function areAllPaymentProofsSpent(states: { state: string }[], proofCount: number): boolean {
  return (
    proofCount > 0 &&
    states.length === proofCount &&
    states.every((state) => state.state === 'SPENT')
  );
}

/** A controller survives delivery retries and never creates a second send operation. */
export class PaymentRequestPayment {
  private busy = false;
  private started = false;
  operationId?: string;
  encoded?: string;
  token?: Token;
  private publication?: PaymentRequestPublication;
  private deliverable = false;
  failureMessage?: string;
  publicationState?: 'publishing' | 'published' | 'unconfirmed';

  constructor(
    readonly request: ParsedPaymentRequest,
    readonly cost: PaymentRequestCost,
  ) {}

  async deliver(writeNfc?: (token: string) => Promise<void>, onPublishing?: () => void) {
    if (this.busy) return;
    this.busy = true;
    let stage = 'validation';
    try {
      let privateKey: string | undefined;
      if (this.request.delivery === 'nip17') {
        const { usePeopleStore } =
          require('~/state/peopleStore') as typeof import('~/state/peopleStore');
        const { normalizeNpub } =
          require('~/shared/utils/nostr') as typeof import('~/shared/utils/nostr');
        if (
          usePeopleStore.getState().people[normalizeNpub(this.request.nostrTarget!)]
            ?.contactStatus === 'blocked'
        ) {
          throw new Error('Unblock this person in Nostr Settings first.');
        }
      }
      if (!this.publication && this.request.delivery === 'nip17') {
        const recipient = resolveNostrRecipient(this.request.nostrTarget!);
        const mnemonic = await seedService.getMnemonic();
        if (!mnemonic) throw new Error('Wallet signing keys are unavailable');
        privateKey = (await seedService.getNostrKeys(mnemonic)).privkey;
        // Validate both curve keys before any proof reservation or token creation.
        nip44.v2.utils.getConversationKey(hexToBytes(privateKey), recipient.pubkey);
      }
      if (!this.token) {
        if (this.started)
          throw new Error('Existing payment is unresolved. Check History before continuing.');
        if (this.request.delivery === 'nfc' && !writeNfc)
          throw new Error('NFC session is unavailable');
        const currentCost = await previewPaymentRequest(this.request, this.cost.mintUrl);
        if (
          currentCost.totalDebit !== this.cost.totalDebit ||
          currentCost.grossAmount !== this.cost.grossAmount
        ) {
          throw new Error('Payment fees changed. Review the amount again before paying.');
        }
        const { initService } = require('./initService') as typeof import('./initService');
        const manager = initService.getManager();
        this.started = true;
        stage = 'preparation';
        const operation = await manager.send.prepareSend(this.cost.mintUrl, this.cost.grossAmount);
        this.operationId = operation.id;
        if (operation.fee !== this.cost.senderFee) {
          await manager.send.rollback(operation.id);
          throw new Error('Payment fees changed. Review the amount again before paying.');
        }
        stage = 'execution';
        const result = await manager.send.executePreparedSend(operation.id);
        this.token = result.token;
      }
      // Retry post-execution work with the saved token, never reserve another payment.
      if (!this.deliverable) {
        const { initService } = require('./initService') as typeof import('./initService');
        const manager = initService.getManager();
        stage = 'encoding';
        // cashu-ts V4 encoding replaces token.proofs with shortened keyset IDs.
        // Keep the original proof objects for fee lookup, NUT-18 and spent-state checks.
        this.encoded ??= manager.wallet.encodeToken({
          ...this.token,
          proofs: this.token.proofs.map((proof) => ({ ...proof })),
        });
        stage = 'net_value';
        const wallet = await wallets(manager).getWallet(this.cost.mintUrl);
        const net =
          this.token.proofs.reduce((sum, proof) => sum + proof.amount, 0) -
          wallet.getFeesForProofs(this.token.proofs);
        if (net < this.request.amount)
          throw new Error('Prepared payment has insufficient net value. Check History.');
        this.deliverable = true;
      }
      if (!this.publication && privateKey) {
        stage = 'encryption';
        this.publication = preparePaymentRequestPublication(
          JSON.stringify(createPaymentRequestPayload(this.token, this.request)),
          this.request.nostrTarget!,
          privateKey,
        );
      }
      if (!this.deliverable) throw new Error('Existing payment is unresolved. Check History.');
      if (this.request.delivery === 'nip17') {
        if (!this.publication)
          throw new Error('Existing payment delivery is unresolved. Check History.');
        stage = 'relay_publication';
        this.publicationState = 'publishing';
        onPublishing?.();
        await publishPaymentRequest(this.publication);
        this.publicationState = 'published';
        const { usePeopleStore } =
          require('~/state/peopleStore') as typeof import('~/state/peopleStore');
        const { normalizeNpub } =
          require('~/shared/utils/nostr') as typeof import('~/shared/utils/nostr');
        if (
          usePeopleStore.getState().people[normalizeNpub(this.request.nostrTarget!)]
            ?.contactStatus !== 'blocked'
        ) {
          usePeopleStore.getState().setContactStatus(this.request.nostrTarget!, 'accepted');
        }
      } else {
        stage = 'nfc_write';
        await writeNfc!(this.encoded!);
      }
      this.failureMessage = undefined;
    } catch (error) {
      if (stage === 'relay_publication') this.publicationState = 'unconfirmed';
      const messages: Record<string, string> = {
        validation: 'Payment validation failed.',
        preparation: 'Payment preparation failed.',
        execution: 'Payment execution is unresolved. Check History before continuing.',
        encoding: 'Token encoding failed. Retry delivery of the existing payment.',
        net_value: 'Prepared token net value could not be verified. Check History.',
        encryption: 'Payment encryption failed. Retry delivery of the existing payment.',
        relay_publication: 'Delivery unconfirmed. The existing payment remains in History.',
        nfc_write: 'NFC write failed. Keep the phones together and retry delivery.',
      };
      this.failureMessage = messages[stage];
      console.warn('[PaymentRequestPayment] Delivery failed', {
        operationId: this.operationId,
        category: stage,
      });
      throw error;
    } finally {
      this.busy = false;
    }
  }

  async refresh(): Promise<boolean> {
    if (!this.token || !this.operationId) return false;
    const { initService } = require('./initService') as typeof import('./initService');
    const manager = initService.getManager();
    const wallet = await wallets(manager).getWallet(this.cost.mintUrl);
    const states = await wallet.checkProofsStates(this.token.proofs);
    if (!areAllPaymentProofsSpent(states, this.token.proofs.length)) return false;
    const operation = await manager.send.getOperation(this.operationId);
    if (operation?.state === 'finalized') return true;
    if (operation?.state !== 'pending') return false;
    try {
      await manager.send.checkPendingOperation(this.operationId);
    } catch {
      // A background proof watcher may finalize the operation between these two reads.
    }
    return (await manager.send.getOperation(this.operationId))?.state === 'finalized';
  }
}
