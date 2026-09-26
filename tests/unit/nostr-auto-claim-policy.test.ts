import { initService } from '~/services/wallet/initService';
import { mintManager } from '~/services/wallet/mintManager';

jest.mock('~/services/wallet/initService', () => ({
  initService: {
    getManager: jest.fn(),
  },
}));

describe('Nostr auto-claim mint policy', () => {
  const getManager = initService.getManager as jest.Mock;

  beforeEach(() => {
    getManager.mockReturnValue({
      mint: {
        getAllTrustedMints: jest
          .fn()
          .mockResolvedValue([
            { mintUrl: 'https://mint.minibits.cash/Bitcoin/' },
            { mintUrl: 'https://mint.example.com' },
          ]),
      },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('accepts an already-trusted mint despite URL casing or a trailing slash', async () => {
    await expect(mintManager.isMintTrusted('HTTPS://MINT.MINIBITS.CASH/Bitcoin')).resolves.toBe(
      true,
    );
  });

  it('does not auto-trust an unknown mint', async () => {
    await expect(mintManager.isMintTrusted('https://attacker.example')).resolves.toBe(false);
  });
});
