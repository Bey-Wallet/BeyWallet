import { SimplePool, type Event } from 'nostr-tools';
import {
  preparePaymentRequestPublication,
  publishPaymentRequest,
} from '~/services/wallet/paymentRequestPublisher';

describe('payment request publication', () => {
  const publication = () =>
    preparePaymentRequestPublication('{}', '12'.repeat(32), '34'.repeat(32));
  it('does not fall back to kind 4 when NIP-17 fails', async () => {
    const publish = jest.fn((relays, event) => [
      event.kind === 4 ? Promise.resolve() : Promise.reject(new Error('rejected')),
    ]);
    const close = jest.fn();
    await expect(
      publishPaymentRequest(publication(), () => ({ publish, close }) as unknown as SimplePool),
    ).rejects.toThrow('unconfirmed');
    expect(publish).toHaveBeenCalledTimes(2);
    expect(publish.mock.calls.every((call) => call[1].kind === 1059)).toBe(true);
    expect(publish.mock.calls[0][1]).toBe(publish.mock.calls[1][1]);
  });
  it('returns the exact accepted event and relay', async () => {
    const prepared = publication();
    const publish = jest.fn(() => [Promise.resolve()]);
    const result = await publishPaymentRequest(
      prepared,
      () => ({ publish, close: jest.fn() }) as unknown as SimplePool,
    );
    expect(result).toEqual({ eventId: prepared.event.id, acceptedRelays: [prepared.relays[0]] });
  });
  it('bounds two attempts to 20 seconds, reusing the encrypted event', async () => {
    jest.useFakeTimers();
    const publish = jest.fn((_relays: string[], _event: Event) => [new Promise(() => {})]);
    const prepared = publication();
    const result = publishPaymentRequest(
      prepared,
      () => ({ publish, close: jest.fn() }) as unknown as SimplePool,
    );
    const assertion = expect(result).rejects.toThrow('unconfirmed');
    await jest.advanceTimersByTimeAsync(20_000);
    await assertion;
    expect(publish).toHaveBeenCalledTimes(2);
    expect(publish.mock.calls[0][1]).toBe(publish.mock.calls[1][1]);
    jest.useRealTimers();
  });
});
