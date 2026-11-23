import { randomUUID } from 'expo-crypto';
import type { LightningPayment } from './lightningPayment';

type Review = {
  walletId: string;
  payment: LightningPayment;
  quote: Awaited<ReturnType<LightningPayment['preview']>>;
  timer: ReturnType<typeof setTimeout>;
};

// Only an opaque ID crosses navigation. The prepared operation stays in memory
// until confirmation takes ownership; abandoned handoffs release their proofs.
const reviews = new Map<string, Review>();

export function discardLightningReview(id: string) {
  const review = reviews.get(id);
  if (!review) return;
  reviews.delete(id);
  clearTimeout(review.timer);
  void review.payment.dispose().catch(() => {});
}

export function saveLightningReview(
  walletId: string,
  payment: LightningPayment,
  quote: Review['quote'],
) {
  const id = randomUUID();
  const timer = setTimeout(() => discardLightningReview(id), 60_000);
  reviews.set(id, { walletId, payment, quote, timer });
  return id;
}

export function readLightningReview(id: string | undefined, walletId: string | null) {
  const review = id ? reviews.get(id) : undefined;
  if (
    !review ||
    !walletId ||
    review.walletId !== walletId ||
    (review.quote.expiry && review.quote.expiry <= Date.now() / 1000)
  )
    return null;
  return review;
}

export function claimLightningReview(id: string, walletId: string | null) {
  const review = readLightningReview(id, walletId);
  if (!review) {
    discardLightningReview(id);
    return null;
  }
  clearTimeout(review.timer);
  reviews.delete(id);
  return review;
}

export function clearLightningReviews(release = true) {
  for (const [id, review] of reviews) {
    if (release) discardLightningReview(id);
    else clearTimeout(review.timer);
  }
  reviews.clear();
}
