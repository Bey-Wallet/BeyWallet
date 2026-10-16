import type { NostrInboxItem } from '~/state/nostrInboxStore';
import type { ChatMessage } from '~/storage/sqlite/repositories/MessageRepository';
import { normalizeNpub } from '~/shared/utils/nostr';
import {
  conversationPaymentInput,
  type ConversationPaymentInput,
} from './conversationPaymentInput';
import {
  filterPersonHistory,
  getPersonPaymentStatus,
  parsePersonHistoryMetadata,
  type PersonHistoryEntry,
} from './personHistory';

interface ConversationActivityBase {
  id: string;
  time: number;
  direction: 'incoming' | 'outgoing';
  text?: string;
  amount?: number;
  type?: string;
  status: string;
  requiresAction: boolean;
  message?: ChatMessage;
  payment?: NostrInboxItem;
  history?: PersonHistoryEntry;
  mintUrl?: string;
  paymentInput?: ConversationPaymentInput;
}

export type ConversationActivity = ConversationActivityBase &
  ({ kind: 'text'; text: string } | { kind: 'payment' });

export function buildConversationActivity(
  npub: string,
  messages: ChatMessage[],
  inbox: NostrInboxItem[],
  history: PersonHistoryEntry[],
  accepted: boolean,
): ConversationActivity[] {
  const payments = inbox.filter((item) => normalizeNpub(item.senderPubkey) === npub);
  const paymentIds = new Set([
    ...payments.map((item) => item.id),
    ...messages.filter((item) => item.paymentId).map((item) => item.paymentId),
  ]);
  const entries = filterPersonHistory(history, npub).filter((entry) => {
    const id = parsePersonHistoryMetadata(entry.metadata).nostrEventId;
    return typeof id !== 'string' || !paymentIds.has(id);
  });
  return [
    ...messages.map((message): ConversationActivity => {
      const input = message.paymentId ? undefined : conversationPaymentInput(message.text);
      return {
        id: `m-${message.id}`,
        kind: message.paymentId || input ? 'payment' : 'text',
        time: message.createdAt,
        direction: message.direction,
        text: message.paymentId || input ? '' : message.text,
        paymentInput: input,
        amount: message.paymentAmount,
        type: message.paymentId
          ? message.paymentType === 'request'
            ? 'Ecash request'
            : 'Ecash'
          : input?.type,
        status: input?.error
          ? input.error
          : message.direction === 'outgoing'
            ? message.publication === 'sent'
              ? 'Sent to relay'
              : message.publication === 'sending'
                ? 'Sending'
                : 'Failed'
            : input
              ? !accepted
                ? 'Pending contact acceptance'
                : 'Payment requested'
              : 'Received',
        requiresAction: message.direction === 'incoming' && (!accepted || !!input?.route),
        message,
      };
    }),
    ...payments.map((payment): ConversationActivity => ({
      id: `p-${payment.id}`,
      kind: 'payment',
      time: payment.receivedAt,
      direction: 'incoming',
      amount: payment.amount,
      type: payment.type === 'request' ? 'Ecash request' : 'Ecash',
      mintUrl: payment.mintUrl,
      payment,
      status:
        payment.status === 'claimed'
          ? 'Claimed'
          : payment.status === 'dismissed'
            ? 'Dismissed'
            : !accepted
              ? 'Pending contact acceptance'
              : payment.status === 'approval_required'
                ? 'Mint approval needed'
                : payment.status === 'claiming'
                  ? 'Receiving'
                  : payment.status === 'failed'
                    ? 'Claim failed'
                    : payment.type === 'request'
                      ? 'Payment requested'
                      : 'Pending',
      requiresAction:
        payment.status !== 'claimed' &&
        payment.status !== 'dismissed' &&
        (!accepted ||
          payment.type === 'request' ||
          payment.status === 'approval_required' ||
          (payment.status === 'failed' && payment.failure?.retryable === false)),
    })),
    ...entries.map((entry): ConversationActivity => {
      const metadata = parsePersonHistoryMetadata(entry.metadata);
      const lightning = metadata.via === 'lightning' || metadata.type === 'lightning';
      return {
        id: `h-${entry.id}`,
        kind: 'payment',
        time: entry.createdAt < 1e10 ? entry.createdAt * 1000 : entry.createdAt,
        direction: entry.type === 'send' ? 'outgoing' : 'incoming',
        amount: entry.amount,
        type: lightning ? 'Lightning' : 'Ecash',
        status: getPersonPaymentStatus(entry),
        requiresAction: entry.type === 'receive' && getPersonPaymentStatus(entry) === 'Failed',
        history: entry,
      };
    }),
  ].sort(
    (a, b) =>
      a.time - b.time ||
      (a.message?.receivedAt ?? a.time) - (b.message?.receivedAt ?? b.time) ||
      a.id.localeCompare(b.id),
  );
}
