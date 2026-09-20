/**
 * Core services barrel export.
 *
 * This is the single entry point for all wallet core functionality.
 * Import from '~/services/wallet'.
 *
 * Architecture:
 *   initService      — Manager lifecycle (init, create, reset, cleanup)
 *   walletService    — Send (two-step), receive, balance, restore
 *   mintManager      — Mint CRUD, trust, info, keyset repair
 *   quotesService    — Mint quotes (LN→ecash), melt quotes (ecash→LN, two-step)
 *   eventService     — Typed CoreEvent subscriptions
 *   historyService   — Paginated transaction history
 *   proofService     — Proof state checks and queries
 *   recoveryService  — Reserved/inflight proof recovery
 *   tokenUtils       — Token encode/decode/clean utilities
 */

// ─── Services ─────────────────────────────────────────────────
export { initService } from '~/services/wallet/initService';
export { walletService } from '~/services/wallet/walletService';
export { mintManager } from '~/services/wallet/mintManager';
export { quotesService } from '~/services/wallet/quotesService';
export { eventService, CORE_EVENT_NAMES } from '~/services/wallet/eventService';
export { historyService } from '~/services/wallet/historyService';
export { proofService } from '~/services/wallet/proofService';
export type { DleqVerificationResult } from '~/services/wallet/proofService';
export { recoveryService } from '~/services/wallet/recoveryService';
export { nostrService } from '~/services/wallet/nostrService';
export { consolidationService } from '~/services/wallet/consolidationService';
export type { FragmentationAnalysis, ConsolidationResult } from '~/services/wallet/consolidationService';
export { expiryService } from '~/services/wallet/expiryService';

// ─── Utilities ────────────────────────────────────────────────
export {
  cleanToken,
  decodeToken,
  decodePaymentRequest,
  encodeToken,
  encodeTokenV3,
  encodeTokenV4,
  encodePeanut,
  extractPeanut,
} from '~/services/wallet/tokenUtils';

// ─── Types ────────────────────────────────────────────────────
export type {
  MintInfo,
  DecodedTokenPreview,
  CoreProof,
  CoreEvents,
  Mint,
  Keyset,
  Counter,
  HistoryEntry,
  MintHistoryEntry,
  MeltHistoryEntry,
  SendHistoryEntry,
  ReceiveHistoryEntry,
  ProofState,
  Token,
  Proof,
  MintQuoteResponse,
  MeltQuoteResponse,
  MintQuoteState,
  MeltQuoteState,
} from '~/services/wallet/types';
