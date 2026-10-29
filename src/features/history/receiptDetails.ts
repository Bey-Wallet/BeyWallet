import { bech32 } from 'bech32';
import { Buffer } from 'buffer';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import { historyMetadata, historyStatusLabel, isOnchainHistory } from './transactionPresentation';

export interface ReceiptField {
  label: string;
  value: string;
  copyValue?: string;
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
  const transfer = !!metadata.transferId;
  const lightning = !onchain && !transfer && ['mint', 'melt'].includes(entry.type);
  const request = text(snapshot.request) || text(entry.paymentRequest);
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
  const add = (label: string, value: unknown, copy = true) => {
    const full = text(value);
    if (full)
      extra.push({ label, value: copy ? short(full) : full, ...(copy ? { copyValue: full } : {}) });
  };
  add('Transaction ID', entry.id);
  add('Quote ID', entry.quoteId);
  add('Operation ID', entry.operationId);
  add('Mint URL', entry.mintUrl);
  add(
    'Method',
    transfer ? 'Transfer' : onchain ? 'Bitcoin on-chain' : lightning ? 'Lightning' : 'Ecash',
    false,
  );
  add('Direction', ['send', 'melt'].includes(entry.type) ? 'Outgoing' : 'Incoming', false);
  if (snapshot.state) add('Quote state', snapshot.state, false);
  if (Number.isFinite(snapshot.amount))
    add('Quote amount', `${snapshot.amount} ${entry.unit}`, false);
  if (lightning) {
    add('Invoice', request);
    add('Payment hash', decoded.paymentHash);
    add('Description hash', decoded.descriptionHash);
    add('Payment proof', proof);
  }
  const expiry = snapshot.expiry ?? decoded.expiry;
  if (expiry && Number.isFinite(expiry) && expiry > 0 && expiry < 253402300800)
    add('Expiry', new Date(expiry * 1000).toLocaleString(), false);
  const maximumFee = snapshot.fee_reserve ?? metadata.feeReserve;
  if (Number.isFinite(maximumFee) && maximumFee >= 0)
    add('Maximum fee', `${maximumFee} sat`, false);
  const recipient =
    text(metadata.recipient) || text(metadata.lnAddress) || text(snapshot.recipient);
  const contact = text(metadata.nostrUsername) || text(metadata.nostrPubkey);
  const address = onchain ? text(metadata.address) || text(entry.paymentRequest) : undefined;
  return {
    method: transfer
      ? 'Transfer'
      : onchain
        ? 'Bitcoin on-chain'
        : lightning
          ? 'Lightning'
          : 'Ecash',
    status: historyStatusLabel(entry) || 'Unverified',
    recipient: recipient || contact,
    description: text(metadata.description) || text(decoded.description),
    proof,
    address,
    extra,
  };
}
