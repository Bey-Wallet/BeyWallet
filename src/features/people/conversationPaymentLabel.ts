import type { ConversationPaymentInput } from './conversationPaymentInput';

/** Display labels only; recognition never establishes a payment outcome. */
export function conversationPaymentLabel(item: {
  type?: string;
  paymentInput?: ConversationPaymentInput;
}): string {
  const type = item.paymentInput?.type ?? item.type;
  if (type === 'Ecash request' || item.paymentInput?.route === 'cashu_request')
    return 'Ecash request';
  if (type === 'Ecash' || item.paymentInput?.route === 'cashu_token') return 'Ecash token';
  if (type === 'Lightning · Invoice') return 'Lightning invoice';
  if (type === 'Lightning · Address') return 'Lightning address';
  if (type === 'Lightning · LNURL') return 'LNURL payment';
  if (type === 'Lightning · BOLT12') return 'BOLT12 offer';
  if (type?.startsWith('Bitcoin') || item.paymentInput?.route === 'onchain')
    return 'Bitcoin payment';
  if (type?.startsWith('Lightning') || item.paymentInput?.route === 'lightning')
    return 'Lightning payment';
  return 'Payment';
}
