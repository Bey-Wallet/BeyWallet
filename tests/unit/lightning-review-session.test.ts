import type { LightningPayment } from '~/services/wallet/lightningPayment';
import {
  saveLightningReview,
  readLightningReview,
  claimLightningReview,
  clearLightningReviews,
} from '~/services/wallet/lightningReviewSession';

jest.mock('expo-crypto', () => ({ randomUUID: () => 'review-id' }));

const payment = () => ({ dispose: jest.fn(async () => {}) }) as unknown as LightningPayment;
const quote = () => ({
  operationId: 'operation-id',
  quote: 'quote-id',
  amount: 20,
  fee_reserve: 2,
  expiry: Date.now() / 1000 + 120,
});
beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  clearLightningReviews();
  jest.useRealTimers();
});

it('transfers ownership of the exact prepared operation once', () => {
  const controller = payment();
  const preview = quote();
  const id = saveLightningReview('wallet', controller, preview);
  expect(readLightningReview(id, 'wallet')?.payment).toBe(controller);
  expect(readLightningReview(id, 'wallet')?.payment).toBe(controller);
  expect(claimLightningReview(id, 'wallet')?.quote).toBe(preview);
  expect(claimLightningReview(id, 'wallet')).toBeNull();
  jest.advanceTimersByTime(60_000);
  expect(controller.dispose).not.toHaveBeenCalled();
});

it('releases abandoned preparations', () => {
  const controller = payment();
  const id = saveLightningReview('wallet', controller, quote());
  jest.advanceTimersByTime(60_000);
  expect(readLightningReview(id, 'wallet')).toBeNull();
  expect(controller.dispose).toHaveBeenCalledTimes(1);
});

it('rejects expired or different-wallet reviews and releases their proofs', () => {
  const controller = payment();
  const id = saveLightningReview('wallet', controller, quote());
  expect(claimLightningReview(id, 'another-wallet')).toBeNull();
  expect(controller.dispose).toHaveBeenCalledTimes(1);
  const expired = payment();
  const expiredId = saveLightningReview('wallet', expired, { ...quote(), expiry: 1 });
  expect(claimLightningReview(expiredId, 'wallet')).toBeNull();
  expect(expired.dispose).toHaveBeenCalledTimes(1);
});

it('clears unclaimed reviews when wallet memory is reset', () => {
  const controller = payment();
  const id = saveLightningReview('wallet', controller, quote());
  clearLightningReviews();
  expect(readLightningReview(id, 'wallet')).toBeNull();
  expect(controller.dispose).toHaveBeenCalledTimes(1);
});

it('can erase memory after services stop without restarting wallet operations', () => {
  const controller = payment();
  const id = saveLightningReview('wallet', controller, quote());
  clearLightningReviews(false);
  jest.advanceTimersByTime(60_000);
  expect(readLightningReview(id, 'wallet')).toBeNull();
  expect(controller.dispose).not.toHaveBeenCalled();
});
