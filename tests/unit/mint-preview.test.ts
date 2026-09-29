import { parseMintPreview } from '~/shared/utils/mintPreview';

describe('mint preview parser', () => {
  it('extracts trust-relevant mint metadata and capabilities', () => {
    const preview = parseMintPreview('https://mint.example/', {
      name: 'Example Mint',
      description: 'Community mint',
      icon_url: '/icon.png',
      motd: 'Maintenance on Sunday',
      version: 'Nutshell/0.20.0',
      pubkey: '02'.repeat(33),
      contact: [{ method: 'email', info: 'operator@example.com' }],
      nuts: {
        4: {
          methods: [{ method: 'bolt11', unit: 'sat', min_amount: 1, max_amount: 100_000 }],
        },
        5: {
          methods: [
            { method: 'bolt11', unit: 'sat', min_amount: 2, max_amount: 50_000 },
            { method: 'onchain', unit: 'sat', min_amount: 10_000, max_amount: 500_000 },
          ],
        },
        7: { supported: true },
      },
    });

    expect(preview).toMatchObject({
      name: 'Example Mint',
      hostname: 'mint.example',
      mintUrl: 'https://mint.example',
      icon: 'https://mint.example/icon.png',
      isSecure: true,
      contact: 'email: operator@example.com',
      paymentMethods: ['Lightning', 'On-chain'],
      mintingLimits: '1–100,000 sat',
      paymentLimits: '2–500,000 sat',
      supportedNuts: 3,
    });
  });

  it('flags HTTP mints and safely falls back when optional metadata is absent', () => {
    expect(parseMintPreview('http://local-mint.test', {})).toMatchObject({
      name: 'local-mint.test',
      hostname: 'local-mint.test',
      isSecure: false,
      paymentMethods: [],
      supportedNuts: 0,
    });
  });
});
