import type { FeedbackSeverity } from './feedbackCatalog';

export interface InteractionNotice {
  title: string;
  severity: FeedbackSeverity;
  duration?: number;
  body?: string;
  essentialDescription?: boolean;
}

export const toastDurations = {
  brief: 1_000,
  normal: 3_000,
  error: 4_000,
  review: 5_000,
  action: 6_000,
} as const;

export function interactionToastOptions(notice: InteractionNotice) {
  return {
    kind: notice.severity,
    duration:
      notice.duration ??
      (notice.severity === 'error'
        ? toastDurations.error
        : notice.severity === 'warning'
          ? toastDurations.review
          : toastDurations.normal),
    message: notice.essentialDescription ? notice.body : undefined,
    customData: {
      kind: notice.severity,
      essentialDescription: notice.essentialDescription === true,
    },
  };
}
