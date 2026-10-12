import { SimplePool, nip19, type Event } from 'nostr-tools';
import {
  preparePaymentRequestPublication,
  publishPaymentRequest,
} from '~/services/wallet/paymentRequestPublisher';

describe('payment request publication', () => {
  afterEach(() => jest.useRealTimers());
  const publication = () =>
    preparePaymentRequestPublication('{}', '12'.repeat(32), '34'.repeat(32));
  const hintedPublication = () =>
    preparePaymentRequestPublication(
      '{}',
      nip19.nprofileEncode({ pubkey: '12'.repeat(32), relays: ['wss://recipient.example'] }),
      '34'.repeat(32),
    );

  it('keeps connections open after a fast fallback ACK until the recipient ACK settles', async () => {
    const prepared = hintedPublication();
    let acknowledge!: () => void;
    const close = jest.fn();
    const publish = jest.fn(() => [
      new Promise<void>((resolve) => {
        acknowledge = resolve;
      }),
      ...prepared.relays.slice(1).map(() => Promise.resolve()),
    ]);
    const result = publishPaymentRequest(
      prepared,
      () => ({ publish, close }) as unknown as SimplePool,
    );
    await Promise.resolve();
    await Promise.resolve();
    expect(close).not.toHaveBeenCalled();
    acknowledge();
    expect((await result).acceptedRelays).toContain('wss://recipient.example');
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('cannot confirm delivery from fallback ACKs when the recipient rejects both attempts', async () => {
    const prepared = hintedPublication();
    const close = jest.fn();
    const publish = jest.fn(() => [
      Promise.reject(new Error('recipient rejected')),
      ...prepared.relays.slice(1).map(() => Promise.resolve()),
    ]);
    await expect(
      publishPaymentRequest(prepared, () => ({ publish, close }) as unknown as SimplePool),
    ).rejects.toThrow('unconfirmed');
    expect(close).toHaveBeenCalledTimes(2);
    expect(publish.mock.calls[0]).toEqual(publish.mock.calls[1]);
  });

  it('does not treat resolved nostr-tools connection failures as relay ACKs', async () => {
    const prepared = hintedPublication();
    const publish = jest.fn(() => [
      Promise.resolve('connection failure: relay connection timed out'),
      ...prepared.relays.slice(1).map(() => Promise.resolve('')),
    ]);
    const close = jest.fn();
    await expect(
      publishPaymentRequest(prepared, () => ({ publish, close }) as unknown as SimplePool),
    ).rejects.toThrow('unconfirmed');
    expect(publish).toHaveBeenCalledTimes(2);
    expect(close).toHaveBeenCalledTimes(2);
  });

  it('handles late rejection after the deadline and retries the identical ciphertext', async () => {
    jest.useFakeTimers();
    const prepared = hintedPublication();
    let rejectLate!: (error: Error) => void;
    const close = jest.fn();
    const publish = jest.fn((_relays: string[], _event: Event) => [
      new Promise<void>((_, reject) => {
        rejectLate = reject;
      }),
      ...prepared.relays.slice(1).map(() => Promise.resolve()),
    ]);
    const result = publishPaymentRequest(
      prepared,
      () => ({ publish, close }) as unknown as SimplePool,
    );
    const assertion = expect(result).rejects.toThrow('unconfirmed');
    await jest.advanceTimersByTimeAsync(20_000);
    await assertion;
    rejectLate(new Error('closed connection'));
    await Promise.resolve();
    expect(close).toHaveBeenCalledTimes(2);
    expect(publish.mock.calls[0][1]).toBe(publish.mock.calls[1][1]);
  });

  it('accepts a recipient ACK at the deadline even if a fallback never settles', async () => {
    jest.useFakeTimers();
    const prepared = hintedPublication();
    const close = jest.fn();
    const publish = jest.fn(() => [Promise.resolve(), new Promise<void>(() => {})]);
    const result = publishPaymentRequest(
      prepared,
      () => ({ publish, close }) as unknown as SimplePool,
    );
    await jest.advanceTimersByTimeAsync(10_000);
    expect(await result).toEqual({
      eventId: prepared.event.id,
      acceptedRelays: ['wss://recipient.example'],
    });
    expect(close).toHaveBeenCalledTimes(1);
  });
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
