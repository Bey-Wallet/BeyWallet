import type { NostrInboxItem } from '~/state/nostrInboxStore';
import type { ChatMessage } from '~/storage/sqlite/repositories/MessageRepository';
import type { NostrReceiveRequest, RequestPayment } from '~/state/nostrRequestStore';
import { findRequestPayment } from '~/state/nostrRequestStore';
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
  requestPayment?: RequestPayment;
}

export type ConversationActivity = ConversationActivityBase &
  ({ kind: 'text'; text: string } | { kind: 'payment' });

export function buildConversationActivity(
  npub: string,
  messages: ChatMessage[],
  inbox: NostrInboxItem[],
  history: PersonHistoryEntry[],
  accepted: boolean,
  lifecycle: { requests: NostrReceiveRequest[]; payments: RequestPayment[] } = {
    requests: [],
    payments: [],
  },
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
                    ? payment.failure?.code === 'receipt_unverified'
                      ? 'Receipt unverified'
                      : 'Claim failed'
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
  ]
    .map((activity): ConversationActivity => {
      if (activity.message?.paymentType === 'request' && activity.message.requestId) {
        const request = lifecycle.requests.find(
          (request) => request.id === activity.message!.requestId,
        );
        const response =
          request &&
          inbox.find(
            (item) =>
              item.type !== 'request' &&
              item.requestId === request.id &&
              normalizeNpub(item.senderPubkey) === npub,
          );
        const status =
          request?.state === 'received'
            ? 'Received'
            : request?.state === 'cancelled'
              ? 'Cancelled'
              : request?.state === 'expired'
                ? 'Expired'
                : activity.message.publication === 'sending'
                  ? 'Sending'
                  : activity.message.publication === 'failed'
                    ? 'Send failed'
                    : response?.status === 'contact_required'
                      ? 'Pending contact acceptance'
                      : response?.status === 'approval_required'
                        ? 'Mint approval needed'
                        : response?.status === 'claiming'
                          ? 'Receiving'
                          : response?.status === 'failed'
                            ? response.failure?.code === 'receipt_unverified'
                              ? 'Receipt unverified'
                              : 'Claim failed'
                            : 'Awaiting payment';
        return { ...activity, status, mintUrl: request?.mintUrl };
      }
      if (activity.payment?.type === 'request') {
        const item = activity.payment;
        const payment = findRequestPayment(item, lifecycle.payments);
        if (payment)
          return {
            ...activity,
            requestPayment: payment,
            requiresAction: false,
            status:
              payment.state === 'paid'
                ? 'Paid'
                : payment.state === 'rolled_back'
                  ? 'Reclaimed'
                  : payment.state === 'preparing'
                    ? 'Preparing payment'
                    : payment.published
                      ? 'Awaiting claim'
                      : 'Delivery unconfirmed',
          };
        if (item.status === 'claimed')
          return { ...activity, status: 'Paid', requiresAction: false };
      }
      return activity;
    })
    .sort(
      (a, b) =>
        a.time - b.time ||
        (a.message?.receivedAt ?? a.time) - (b.message?.receivedAt ?? b.time) ||
        a.id.localeCompare(b.id),
    );
}
