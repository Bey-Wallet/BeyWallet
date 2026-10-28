export type FeedbackSeverity = 'success' | 'info' | 'warning' | 'error';
export const feedbackCatalog = {
  received: {
    title: 'Payment received',
    body: 'Open Bey to view your payment.',
    severity: 'success',
    category: 'payments',
  },
  sent: {
    title: 'Payment sent',
    body: 'Open Bey to view payment details.',
    severity: 'success',
    category: 'payments',
  },
  review: {
    title: 'Payment needs review',
    body: 'Open Bey to review an incoming payment.',
    severity: 'warning',
    category: 'review',
  },
  pending: {
    title: 'Payment pending',
    body: 'Open Bey to check its status.',
    severity: 'info',
    category: 'payments',
  },
  transfer: {
    title: 'Transfer completed',
    body: 'Open Bey to view transfer details.',
    severity: 'success',
    category: 'payments',
  },
  message: {
    title: 'New message',
    body: 'Open Bey to read your message.',
    severity: 'info',
    category: 'messages',
  },
  recovery: {
    title: 'Recovery needs review',
    body: 'Open Bey to review your recovery.',
    severity: 'warning',
    category: 'review',
  },
  prepared: {
    title: 'Ecash ready to share',
    body: 'Open Bey to view payment details.',
    severity: 'info',
    category: 'payments',
  },
} as const;
export type FeedbackKind = keyof typeof feedbackCatalog;
export type FeedbackCategory = (typeof feedbackCatalog)[FeedbackKind]['category'];
