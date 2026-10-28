import { digestStringAsync, CryptoDigestAlgorithm } from 'expo-crypto';
import type { FeedbackEvent } from './feedbackCoordinator';

export function deliveryIdentifier(event: FeedbackEvent) {
  return digestStringAsync(
    CryptoDigestAlgorithm.SHA256,
    JSON.stringify([event.walletId, event.entity.type, event.entity.id, event.state]),
  );
}
