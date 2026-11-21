import { getPublicKey } from 'nostr-tools/pure';
import { hexToBytes } from '@noble/hashes/utils.js';
import {
  nostrIdentityService,
  resolveBeyNip05Pubkey,
} from '~/services/wallet/nostrIdentityService';
import { nostrService } from '~/services/wallet/nostrService';

jest.mock('~/services/wallet/nostrService', () => ({
  nostrService: {
    createProfileEvent: jest.fn(),
    publishProfileEvent: jest.fn(),
    republishInboxRelayList: jest.fn(),
  },
}));

const privateKey = '04'.repeat(32);
const publicKey = getPublicKey(hexToBytes(privateKey));
const profileEvent = { id: 'profile-event' } as any;

function response(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe('nostrIdentityService', () => {
  it('bounds a stalled response body and aborts its request', async () => {
    jest.useFakeTimers();
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => new Promise(() => {}),
    } as unknown as Response);
    try {
      const result = resolveBeyNip05Pubkey('alice');
      await jest.advanceTimersByTimeAsync(5_000);
      await expect(result).resolves.toBeNull();
      expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });
  beforeEach(() => {
    jest.clearAllMocks();
    (nostrService.createProfileEvent as jest.Mock).mockResolvedValue(profileEvent);
    (nostrService.publishProfileEvent as jest.Mock).mockResolvedValue(true);
    (nostrService.republishInboxRelayList as jest.Mock).mockResolvedValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('persists success only after the public NIP-05 mapping is verified', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(response({ names: {} }))
      .mockResolvedValueOnce(response({ success: true, nip05: 'alice@bey.cash' }))
      .mockResolvedValueOnce(response({ names: { alice: publicKey } }));

    await expect(
      nostrIdentityService.registerUsername('Alice', publicKey, privateKey),
    ).resolves.toEqual({
      ok: true,
      nip05: 'alice@bey.cash',
      profilePublished: true,
    });

    const registration = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(registration).toMatchObject({
      username: 'alice',
      pubkey: publicKey,
      profileEvent,
    });
    expect(registration.proofEvent).toMatchObject({ kind: 22242, pubkey: publicKey });
    expect(nostrService.publishProfileEvent).toHaveBeenCalledWith(profileEvent);
    expect(nostrService.republishInboxRelayList).toHaveBeenCalledTimes(1);
  });

  it('does not report success when the registry rejects an unverified mapping', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(response({ names: {} }))
      .mockResolvedValueOnce(response({ error: 'registry unavailable' }, false, 503))
      .mockResolvedValueOnce(response({ names: {} }));

    await expect(
      nostrIdentityService.registerUsername('alice', publicKey, privateKey),
    ).resolves.toEqual({ ok: false, error: 'registry unavailable' });
    expect(nostrService.publishProfileEvent).not.toHaveBeenCalled();
  });
});
