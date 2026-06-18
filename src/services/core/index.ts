/**
 * Core services barrel export.
 *
 * This is the single entry point for all wallet core functionality.
 * Import from '@/services/core' or '../services/core'.
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
export { initService } from './initService';
export { walletService } from './walletService';
export { mintManager } from './mintManager';
export { quotesService } from './quotesService';
export { eventService, CORE_EVENT_NAMES } from './eventService';
export { historyService } from './historyService';
export { proofService } from './proofService';
export type { DleqVerificationResult } from './proofService';
export { recoveryService } from './recoveryService';
export { nostrService } from './nostrService';
export { consolidationService } from './consolidationService';
export type { FragmentationAnalysis, ConsolidationResult } from './consolidationService';
export { expiryService } from './expiryService';

// ─── Utilities ────────────────────────────────────────────────
export {
    cleanToken,
    decodeToken,
    encodeToken,
    encodeTokenV3,
    encodeTokenV4,
    encodePeanut,
    extractPeanut,
} from './tokenUtils';

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
} from './types';
