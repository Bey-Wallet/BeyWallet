import { nip19 } from 'nostr-tools';
import { getPublicKey } from 'nostr-tools/pure';
import { Buffer } from 'buffer';
import { nostrDiagnosticsService } from '~/services/wallet/nostrDiagnosticsService';
import { nostrProfileService } from '~/services/api/nostrProfileService';
import { nostrService } from '~/services/wallet/nostrService';

const mockPrivateKey = '03'.repeat(32);
const pubkey = getPublicKey(Buffer.from(mockPrivateKey, 'hex'));
const mockNpub = nip19.npubEncode(pubkey);
let mockRelayEvents: Record<string, any[] | Error> = {};

jest.mock('~/state/settingsStore', () => ({
  useSettingsStore: {
    getState: () => ({ npub: mockNpub, nsec: mockPrivateKey, nip05: 'alice@bey.cash' }),
  },
}));
jest.mock('~/services/api/nostrProfileService', () => ({
  nostrProfileService: { search: jest.fn() },
}));
jest.mock('~/services/wallet/nostrService', () => ({
  RELAYS: ['wss://one.example', 'wss://two.example'],
  NIP17_INBOX_RELAYS: ['wss://inbox.example'],
  nostrService: {
    publishProfile: jest.fn(),
    republishInboxRelayList: jest.fn(),
    reconnectRelays: jest.fn(),
  },
}));
jest.mock('nostr-tools', () => {
  const actual = jest.requireActual('nostr-tools');
  return {
    ...actual,
    SimplePool: jest.fn().mockImplementation(() => ({
      querySync: ([relay]: string[]) => {
        const value = mockRelayEvents[relay];
        return value instanceof Error ? Promise.reject(value) : Promise.resolve(value || []);
      },
      close: jest.fn(),
    })),
  };
});

const search = nostrProfileService.search as jest.Mock;

describe('nostrDiagnosticsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRelayEvents = {};
    search.mockResolvedValue([{ pubkeyHex: pubkey, nip05Verified: true }]);
  });

  it('detects profile, inbox-list, NIP-05, and relay failures separately', async () => {
    mockRelayEvents = {
      'wss://one.example': [
        { kind: 0, pubkey, created_at: 2, content: JSON.stringify({ nip05: 'wrong@bey.cash' }) },
      ],
      'wss://two.example': new Error('offline'),
    };

    await expect(nostrDiagnosticsService.getDiagnostics()).resolves.toMatchObject({
      overall: 'degraded',
      nip05: { matches: true },
      profile: { present: true, nip05Matches: false },
      inboxRelayList: { published: false, matches: false },
      relays: [{ reachable: true }, { reachable: false }],
    });
  });

  it('reports healthy only when the signed profile and inbox relay list match', async () => {
    mockRelayEvents = {
      'wss://one.example': [
        { kind: 0, pubkey, created_at: 2, content: JSON.stringify({ nip05: 'alice@bey.cash' }) },
        {
          kind: 10050,
          pubkey,
          created_at: 3,
          content: '',
          tags: [['relay', 'wss://inbox.example']],
        },
      ],
      'wss://two.example': [],
    };

    await expect(nostrDiagnosticsService.getDiagnostics()).resolves.toMatchObject({
      overall: 'healthy',
      profile: { present: true, nip05Matches: true },
      inboxRelayList: { published: true, matches: true },
    });
  });

  it('uses focused repair actions', async () => {
    (nostrService.publishProfile as jest.Mock).mockResolvedValue(true);
    (nostrService.republishInboxRelayList as jest.Mock).mockResolvedValue(true);
    await expect(nostrDiagnosticsService.repairProfile()).resolves.toBe(true);
    await expect(nostrDiagnosticsService.republishInboxRelayList()).resolves.toBe(true);
    nostrDiagnosticsService.reconnectRelays();
    expect(nostrService.reconnectRelays).toHaveBeenCalled();
  });
});
