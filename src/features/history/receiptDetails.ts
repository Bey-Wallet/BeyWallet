import { bech32 } from 'bech32';
import { Buffer } from 'buffer';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import { historyMetadata, historyStatusLabel, isOnchainHistory } from './transactionPresentation';
import type { MintTransferRecord } from '~/storage/sqlite/repositories/MintTransferRepository';
import {
  normalizeBitcoinAddress,
  onchainNetwork,
  onchainNetworkDisplay,
  transactionIdFromOutpoint,
} from '~/shared/utils/onchain';

export interface ReceiptField {
  section?:
    | 'Transaction'
    | 'Quote'
    | 'Payment'
    | 'Request'
    | 'Transfer'
    | 'Source quote'
    | 'Destination quote';
  label: string;
  value: string;
  copyValue?: string;
  /** Copy-all form for plain values such as timestamps; does not enable row copying. */
  fullValue?: string;
}
export interface ReceiptEntry {
  id: string;
  type: string;
  amount: number;
  unit: string;
  mintUrl: string;
  createdAt: number;
  state?: string;
  metadata?: unknown;
  paymentRequest?: string;
  quoteId?: string;
  operationId?: string;
}
export interface ReceiptSnapshot {
  request?: string;
  payment_preimage?: string | null;
  expiry?: number;
  fee_reserve?: number;
  state?: string;
  recipient?: string;
  amount?: number;
  operationId?: string;
  operationState?: string;
  quoteId?: string;
  swapFee?: number;
  cashuRequest?: string;
  amountPaid?: number;
  amountIssued?: number;
  outpoint?: string;
  transfer?: MintTransferRecord;
  transferSource?: ReceiptSnapshot;
  transferDestination?: ReceiptSnapshot;
}
const text = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;
const short = (value: string) =>
  value.length > 24 ? `${value.slice(0, 10)}…${value.slice(-8)}` : value;

/** Unknown and actionable states stay in a full screen; only terminal receipts use sheets. */
export function needsFullScreenReceipt(entry: ReceiptEntry, transferState?: string): boolean {
  const metadata = historyMetadata(entry);
  if (
    metadata.requiresAction === true ||
    metadata.needsReview === true ||
    metadata.requiresReview === true
  )
    return true;
  if (metadata.transferId)
    return !['completed', 'failed'].includes(transferState?.toLowerCase() || '');
  return !['Confirmed', 'Claimed', 'Refunded', 'Failed', 'Expired', 'Cancelled'].includes(
    historyStatusLabel(entry),
  );
}

/** Display-only BOLT11 metadata. Never used to authorize or validate a payment. */
export function invoiceDisplayDetails(request?: string) {
  const result: {
    description?: string;
    descriptionHash?: string;
    paymentHash?: string;
    expiry?: number;
  } = {};
  if (!request || request.length > 20000) return result;
  try {
    const { prefix, words } = bech32.decode(request.replace(/^lightning:/i, ''), 20000);
    if (!/^ln(bc|tb|tbs|bcrt)(\d+[munp]?)?$/.test(prefix) || words.length < 111) return result;
    const end = words.length - 104;
    const timestamp = words.slice(0, 7).reduce((n, word) => n * 32 + word, 0);
    let expiry = 3600;
    for (let offset = 7; offset < end;) {
      if (offset + 3 > end) return {};
      const tag = words[offset];
      const length = words[offset + 1] * 32 + words[offset + 2];
      offset += 3;
      if (offset + length > end) return {};
      const data = words.slice(offset, offset + length);
      offset += length;
      if (tag === 13) result.description = Buffer.from(bech32.fromWords(data)).toString('utf8');
      if ((tag === 1 || tag === 23) && length === 52) {
        const hex = Buffer.from(bech32.fromWords(data)).toString('hex');
        if (tag === 1) result.paymentHash = hex;
        else result.descriptionHash = hex;
      }
      if (tag === 6) expiry = data.reduce((n, word) => n * 32 + word, 0);
    }
    if (Number.isSafeInteger(timestamp + expiry)) result.expiry = timestamp + expiry;
    if (result.descriptionHash) delete result.description;
    return result;
  } catch {
    return {};
  }
}

/** Explicit allowlist: never serialize tokens, proofs, keys, or arbitrary metadata. */
export function buildReceiptDetails(entry: ReceiptEntry, snapshot: ReceiptSnapshot = {}) {
  const metadata = historyMetadata(entry);
  const onchain = isOnchainHistory(entry);
  const transfer = !!metadata.transferId || !!snapshot.transfer;
  const lightning = !onchain && !transfer && ['mint', 'melt'].includes(entry.type);
  const request = text(snapshot.request) || text(entry.paymentRequest);
  // Receipt exports accept public payment requests, never bearer-token payloads.
  const onchainAddress = onchain ? request?.replace(/^bitcoin:/i, '').split('?')[0] : undefined;
  const publicRequest =
    lightning && request && /^(lightning:)?ln(bc|tb|bcrt)[a-z0-9]+$/i.test(request)
      ? request
      : onchainAddress && /^(bc1|tb1|bcrt1|[13mn2])[a-z0-9]+$/i.test(onchainAddress)
        ? onchainAddress
        : undefined;
  const decoded = lightning ? invoiceDisplayDetails(request) : {};
  const candidateProof = text(snapshot.payment_preimage);
  const proof =
    candidateProof &&
    /^[0-9a-f]{64}$/i.test(candidateProof) &&
    decoded.paymentHash &&
    bytesToHex(sha256(hexToBytes(candidateProof))) === decoded.paymentHash
      ? candidateProof
      : undefined;
  const extra: ReceiptField[] = [];
  const add = (
    section: ReceiptField['section'],
    label: string,
    value: unknown,
    copy = true,
    shorten = true,
  ) => {
    const full = text(value);
    if (full)
      extra.push({
        section,
        label,
        value: copy && shorten ? short(full) : full,
        ...(copy ? { copyValue: full } : {}),
      });
  };
  const date = (section: ReceiptField['section'], label: string, millis?: number) => {
    if (!millis || !Number.isFinite(millis) || millis <= 0 || millis >= 8640000000000000) return;
    const value = new Date(millis);
    extra.push({ section, label, value: value.toLocaleString(), fullValue: value.toISOString() });
  };
  const amount = (value: unknown) =>
    typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
      ? `${value.toLocaleString()} ${entry.unit}`
      : 'Unavailable';
  const status = historyStatusLabel(entry) || 'Unverified';
  const method = transfer
    ? 'Transfer'
    : onchain
      ? 'Bitcoin on-chain'
      : lightning
        ? 'Lightning'
        : 'Ecash';
  if (entry.id && entry.id !== entry.quoteId) add('Transaction', 'Transaction ID', entry.id);
  add('Transaction', 'Operation ID', entry.operationId || snapshot.operationId);
  add(
    'Transaction',
    'Method',
    lightning && /^lightning:ln|^ln(bc|tb|bcrt)/i.test(request || '')
      ? 'Lightning (BOLT11)'
      : method,
    false,
  );
  add(
    'Transaction',
    'Direction',
    transfer ? 'Between mints' : ['send', 'melt'].includes(entry.type) ? 'Outgoing' : 'Incoming',
    false,
  );
  add('Transaction', 'Status', status, false);
  add('Transaction', 'Operation state', snapshot.operationState || metadata.operationState, false);
  date('Transaction', 'Date', entry.createdAt);
  add('Transaction', 'Amount', amount(entry.amount), false);
  add('Transaction', 'Fee', amount(metadata.actualFee ?? metadata.fee), false);
  add('Transaction', 'Mint URL', entry.mintUrl, true, false);
  if (snapshot.transfer) {
    const record = snapshot.transfer;
    add('Transfer', 'Transfer ID', record.id);
    add('Transfer', 'Transfer state', record.state, false);
    add('Transfer', 'Stage', record.stage, false);
    add('Transfer', 'Source mint URL', record.sourceMintUrl, true, false);
    add('Transfer', 'Destination mint URL', record.targetMintUrl, true, false);
    add('Transfer', 'Source quote ID', record.meltQuoteId);
    add('Transfer', 'Destination quote ID', record.mintQuoteId);
    add('Transfer', 'Maximum fee', amount(record.feeReserve), false);
    add('Transfer', 'Fee paid', amount(record.feePaid), false);
    if (Number.isSafeInteger(record.amount + record.feeReserve) && record.feeReserve >= 0)
      add('Transfer', 'Maximum total', amount(record.amount + record.feeReserve), false);
    if (record.feePaid != null && Number.isSafeInteger(record.feePaid) && record.feePaid >= 0)
      add('Transfer', 'Total', amount(record.amount + record.feePaid), false);
    if (record.expiresAt && record.expiresAt > 0 && record.expiresAt < 253402300800)
      date('Transfer', 'Review expiry', record.expiresAt * 1000);
    const appendQuote = (
      section: 'Source quote' | 'Destination quote',
      incoming: boolean,
      quoteId: string | null,
      saved?: ReceiptSnapshot,
    ) => {
      if (!quoteId) return;
      const fields = buildReceiptDetails(
        {
          id: '',
          type: incoming ? 'mint' : 'melt',
          amount: record.amount,
          unit: entry.unit,
          mintUrl: incoming ? record.targetMintUrl : record.sourceMintUrl,
          createdAt: 0,
          quoteId,
          state: saved?.state,
        },
        {
          request: saved?.request,
          state: saved?.state,
          amount: saved?.amount,
          expiry: saved?.expiry,
          fee_reserve: saved?.fee_reserve,
          payment_preimage: incoming ? undefined : saved?.payment_preimage,
        },
      ).extra;
      extra.push(
        ...fields
          .filter((field) => field.section === 'Quote' || field.section === 'Payment')
          .map((field) => ({ ...field, section })),
      );
    };
    appendQuote('Source quote', false, record.meltQuoteId, snapshot.transferSource);
    appendQuote('Destination quote', true, record.mintQuoteId, snapshot.transferDestination);
  }
  const quoteId = entry.quoteId || snapshot.quoteId;
  if (quoteId) {
    add('Quote', 'Quote ID', quoteId);
    add('Quote', 'Type', entry.type === 'mint' ? 'Mint quote' : 'Melt quote', false);
    add('Quote', 'Request', publicRequest);
    add('Quote', 'State', snapshot.state || 'Unavailable', false);
    add('Quote', 'Quote amount', amount(snapshot.amount), false);
    if (entry.type === 'melt') {
      add(
        'Quote',
        'Fee reserve',
        amount(snapshot.fee_reserve ?? (onchain ? metadata.feeReserve : undefined)),
        false,
      );
      if (snapshot.swapFee != null) add('Quote', 'Mint swap fee', amount(snapshot.swapFee), false);
    }
  }
  const expiry = snapshot.expiry ?? decoded.expiry;
  if (quoteId) {
    if (expiry && Number.isFinite(expiry) && expiry > 0 && expiry < 253402300800)
      date('Quote', 'Expiry', expiry * 1000);
    else add('Quote', 'Expiry', expiry === 0 ? 'Never' : 'Unavailable', false);
  }
  if (lightning) {
    if (!quoteId) add('Payment', 'Invoice', publicRequest);
    add('Payment', 'Payment hash', decoded.paymentHash);
    add('Payment', 'Description hash', decoded.descriptionHash);
    add('Payment', 'Payment proof', proof);
  }
  if (onchain) {
    const destination = normalizeBitcoinAddress(text(metadata.address) || publicRequest || '');
    if (/^(bc1|tb1|bcrt1|[13mn2])[a-z0-9]+$/i.test(destination)) {
      add('Payment', 'Network', onchainNetworkDisplay(onchainNetwork(destination)), false);
      add('Payment', entry.type === 'mint' ? 'Address' : 'Destination', destination, true, false);
    }
    if (entry.type === 'mint') {
      add('Quote', 'Amount paid', amount(snapshot.amountPaid), false);
      add('Quote', 'Amount issued', amount(snapshot.amountIssued), false);
    }
    const outpoint = text(snapshot.outpoint);
    const txid = text(metadata.txid) || transactionIdFromOutpoint(outpoint || '');
    if (txid && /^[a-f0-9]{64}$/i.test(txid)) add('Payment', 'Transaction ID', txid);
    if (outpoint && transactionIdFromOutpoint(outpoint)) add('Payment', 'Outpoint', outpoint);
    add('Payment', 'Blockchain confirmations', 'Not verified', false);
  }
  if (snapshot.cashuRequest && /^(cashu:)?creq[A-Z]/.test(snapshot.cashuRequest)) {
    add('Request', 'Request ID', metadata.requestId);
    add('Request', 'Method', 'Cashu Request', false);
    add('Request', 'Request', snapshot.cashuRequest);
  }
  const recipient =
    text(metadata.recipient) || text(metadata.lnAddress) || text(snapshot.recipient);
  const contact = text(metadata.nostrUsername) || text(metadata.nostrPubkey);
  const address = onchain ? text(metadata.address) || text(entry.paymentRequest) : undefined;
  return {
    method,
    status,
    recipient: recipient || contact,
    description: text(metadata.description) || text(decoded.description),
    proof,
    address,
    extra,
  };
}

/** One public journal snapshot serves the live Transfer and its reopened History receipt. */
export function buildTransferReceiptDetails(
  record: MintTransferRecord,
  quotes?: {
    source?: ReceiptSnapshot;
    destination?: ReceiptSnapshot;
  },
) {
  return buildReceiptDetails(
    {
      id: '',
      type: 'swap',
      amount: record.amount,
      unit: 'sat',
      mintUrl: record.sourceMintUrl,
      createdAt: record.createdAt,
      operationId: record.operationId || undefined,
      state:
        record.state === 'completed'
          ? 'completed'
          : record.state === 'failed'
            ? 'failed'
            : record.state === 'discarded'
              ? 'cancelled'
              : 'pending',
      metadata: {
        transferId: record.id,
        ...(record.feePaid != null ? { fee: record.feePaid } : {}),
      },
    },
    { transfer: record, transferSource: quotes?.source, transferDestination: quotes?.destination },
  );
}
