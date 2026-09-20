/**
 * Core types — re-exports from coco-cashu-core + app-level interfaces
 */

// Re-export everything the UI/stores might need from coco-cashu-core
export type {
  CoreProof,
  CoreEvents,
  Mint,
  Keyset,
  Counter,
  MintQuote,
  MeltQuote,
  HistoryEntry,
  MintHistoryEntry,
  MeltHistoryEntry,
  SendHistoryEntry,
  ReceiveHistoryEntry,
  Repositories,
  ProofRepository,
  MintRepository,
  KeysetRepository,
  CounterRepository,
  MintQuoteRepository,
  MeltQuoteRepository,
  HistoryRepository,
  ProofState,
  Logger,
  CocoConfig,
} from 'coco-cashu-core';

export type { Manager } from 'coco-cashu-core';

// Re-export cashu-ts types used in the UI
export type {
  Token,
  Proof,
  MintQuoteResponse,
  MeltQuoteResponse,
  MintQuoteState,
  MeltQuoteState,
  MintKeys,
  MintKeyset,
} from '@cashu/cashu-ts';

/** App-level mint info for UI display */
export interface MintInfo {
  mintUrl: string;
  name?: string;
  nickname?: string;
  description?: string;
  icon?: string;
  trusted: boolean;
}

/** Result from decoding a token for preview */
export interface DecodedTokenPreview {
  mint: string;
  amount: number;
  unit: string;
  proofs: any[];
  memo?: string;
  raw?: any;
}
