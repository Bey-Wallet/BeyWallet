import { getTokenMetadata, PaymentRequest } from '@cashu/cashu-ts';
import type { WalletService } from 'coco-cashu-core';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { nfcService } from '~/services/platform/nfcService';
import { useNostrRequestStore, type NostrReceiveRequest } from '~/state/nostrRequestStore';
import { normalizePaymentMint } from './paymentRequestModel';
import { cleanToken } from './tokenUtils';
import { findTokenReceiveReceipt } from './nostrReceiptService';
import {
  reserveNfcReceipt,
  completeNfcReceipt,
} from '~/storage/sqlite/repositories/nfcRequestReceipts';

export function nfcRequestAdvertisement(request: NostrReceiveRequest): string | undefined {
  if (request.recipient || request.state !== 'pending') return;
  const original = PaymentRequest.fromEncodedRequest(request.creqString);
  if (
    original.id !== request.id ||
    original.amount !== request.amount ||
    original.unit !== request.unit ||
    original.mints?.length !== 1 ||
    normalizePaymentMint(original.mints[0]) !== normalizePaymentMint(request.mintUrl) ||
    original.nut10
  )
    throw new Error('Request terms do not match the saved request');
  return new PaymentRequest(
    [],
    original.id,
    original.amount,
    original.unit,
    original.mints,
    original.description,
    original.singleUse,
  ).toEncodedRequest();
}

export function validateNfcOffer(request: NostrReceiveRequest, requestId: string, token: string) {
  const metadata = getTokenMetadata(token);
  if (
    request.id !== requestId ||
    request.recipient ||
    !['pending', 'received'].includes(request.state) ||
    metadata.unit !== request.unit ||
    metadata.unit !== 'sat' ||
    normalizePaymentMint(metadata.mint) !== normalizePaymentMint(request.mintUrl) ||
    !Number.isSafeInteger(metadata.amount) ||
    metadata.amount < request.amount ||
    metadata.incompleteProofs.length === 0
  )
    throw new Error('NFC payment does not match this unrestricted request');
  const proofs = metadata.incompleteProofs
    .map((proof) => JSON.stringify([proof.amount, proof.C, proof.secret]))
    .sort();
  if (new Set(proofs).size !== proofs.length) throw new Error('Duplicate NFC payment proofs');
  return {
    metadata,
    fingerprint: bytesToHex(
      sha256(
        new TextEncoder().encode(
          JSON.stringify([normalizePaymentMint(metadata.mint), metadata.unit, proofs]),
        ),
      ),
    ),
  };
}

interface ReceiveState {
  status: 'idle' | 'receiving' | 'review';
  requestId?: string;
  message?: string;
}

/** The native slot remains authoritative until an exact successful local receipt exists. */
export class NfcReceiveCoordinator {
  private ready = false;
  private running?: Promise<void>;
  private again = false;
  private forceAgain = false;
  private attempted = new Set<string>();
  private listeners = new Set<() => void>();
  private state: ReceiveState = { status: 'idle' };
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getSnapshot = () => this.state;
  private update(state: ReceiveState) {
    this.state = state;
    this.listeners.forEach((listener) => listener());
  }
  setReady(ready: boolean) {
    this.ready = ready;
    if (ready) void this.processPending();
  }
  retry = () => this.processPending(true);
  processPending(force = false): Promise<void> {
    if (this.running) {
      this.again = true;
      this.forceAgain ||= force;
      return this.running;
    }
    const drain = async () => {
      let retry = force;
      do {
        this.again = false;
        await this.process(retry);
        retry = this.forceAgain;
        this.forceAgain = false;
      } while (this.again && this.ready);
    };
    this.running = drain().finally(() => {
      this.running = undefined;
      if (this.again && this.ready) {
        const retry = this.forceAgain;
        this.again = false;
        this.forceAgain = false;
        void this.processPending(retry);
      }
    });
    return this.running;
  }
  private allowed() {
    const { initService } = require('./initService') as typeof import('./initService');
    const { useSettingsStore } =
      require('~/state/settingsStore') as typeof import('~/state/settingsStore');
    const { useAuthStore } = require('~/state/authStore') as typeof import('~/state/authStore');
    const { AppState } = require('react-native') as typeof import('react-native');
    return (
      this.ready &&
      AppState.currentState === 'active' &&
      initService.isInitialized() &&
      useSettingsStore.getState().initialized &&
      (!useSettingsStore.getState().biometricEnabled || useAuthStore.getState().isAuthenticated)
    );
  }
  private async process(force: boolean): Promise<void> {
    let requestId: string | undefined;
    try {
      if (!this.allowed()) return;
      const pending = await nfcService.getPendingPayment();
      if (!pending || !this.allowed()) return;
      requestId = pending.requestId;
      // Synchronously stop advertising before any redemption work starts.
      this.update({ status: 'receiving', requestId });
      await nfcService.pauseRequestSession();
      await useNostrRequestStore.getState().loadPendingRequests();
      const request = useNostrRequestStore
        .getState()
        .requests.find((entry) => entry.id === requestId);
      if (!request) throw new Error('Saved NFC request is unavailable');
      const token = cleanToken(pending.content);
      const { metadata, fingerprint } = validateNfcOffer(request, pending.requestId, token);
      await reserveNfcReceipt(fingerprint, request.id);
      let receipt = await findTokenReceiveReceipt(token);
      if (receipt) {
        const { initService } = require('./initService') as typeof import('./initService');
        const manager = initService.getManager();
        const decoded = await manager.wallet.decodeToken(token);
        const wallet = await (
          manager as unknown as { walletService: WalletService }
        ).walletService.getWallet(metadata.mint);
        const fee = wallet.getFeesForProofs(decoded.proofs);
        if (!Number.isSafeInteger(fee) || fee < 0 || metadata.amount - fee !== request.amount)
          throw new Error('Saved NFC receipt net amount does not match the request');
      }
      if (!receipt) {
        if (request.state !== 'pending')
          throw new Error('This request already has a different payment');
        if (!force && this.attempted.has(fingerprint))
          throw new Error('Review the saved NFC payment to retry');
        this.attempted.add(fingerprint);
        const { mintManager } = require('./mintManager') as typeof import('./mintManager');
        if (!(await mintManager.isMintTrusted(metadata.mint)))
          throw new Error('Approve this mint in Mints before retrying');
        const { initService } = require('./initService') as typeof import('./initService');
        const { refreshReceiveKeysets } =
          require('./cashuReceiveKeysets') as typeof import('./cashuReceiveKeysets');
        const manager = initService.getManager();
        await refreshReceiveKeysets(
          manager,
          initService.getRepo().keysetRepository,
          metadata.mint,
          token,
        );
        const decoded = await manager.wallet.decodeToken(token);
        const wallet = await (
          manager as unknown as { walletService: WalletService }
        ).walletService.getWallet(metadata.mint);
        const fee = wallet.getFeesForProofs(decoded.proofs);
        if (!Number.isSafeInteger(fee) || fee < 0 || metadata.amount - fee !== request.amount)
          throw new Error('NFC payment net amount does not match the request');
        // Recheck after network boundaries; QR may have completed in the meantime.
        await useNostrRequestStore.getState().loadPendingRequests();
        if (!this.allowed()) throw new Error('Unlock the wallet to review this NFC payment');
        if (
          useNostrRequestStore.getState().requests.find((entry) => entry.id === requestId)
            ?.state !== 'pending'
        )
          throw new Error('This request already has a payment');
        const { walletService } = require('./walletService') as typeof import('./walletService');
        try {
          await walletService.receive(token);
        } catch {
          // An uncertain response or a concurrent QR receive can still have committed.
          if (!(await findTokenReceiveReceipt(token)))
            throw new Error('NFC payment saved. Check connectivity and retry');
        }
        receipt = await findTokenReceiveReceipt(token);
      }
      if (!receipt || receipt.createdAt < request.createdAt)
        throw new Error('No matching successful local receipt is available');
      const receiptRequest = (receipt.metadata as Record<string, unknown> | undefined)?.requestId;
      if (receipt.createdAt < pending.receivedAt && receiptRequest !== request.id)
        throw new Error('This receipt predates the NFC payment offer');
      if (receiptRequest && receiptRequest !== request.id)
        throw new Error('Receipt belongs to another request');
      if (!this.allowed()) throw new Error('Unlock the wallet to finish verifying this payment');
      await completeNfcReceipt(fingerprint, request.id, receipt.id);
      await useNostrRequestStore.getState().markReceived(request.id);
      if (!(await nfcService.acknowledgePayment(pending.id)))
        throw new Error('Receipt verified; saved payment acknowledgement needs retry');
      const { useWalletStore } =
        require('~/state/walletStore') as typeof import('~/state/walletStore');
      void useWalletStore
        .getState()
        .refreshBalance()
        .catch(() => undefined);
      this.update({ status: 'idle', requestId: request.id });
    } catch {
      this.update({
        status: 'review',
        requestId,
        message: 'NFC payment saved. Review its request, mint and connection, then retry.',
      });
    }
  }
}

export const nfcReceiveCoordinator = new NfcReceiveCoordinator();
