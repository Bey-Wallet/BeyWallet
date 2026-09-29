const MAX_MINT_ROWS = 4;

export const RECOMMENDED_MINTS = [
  {
    name: 'Minibits Mint',
    mintUrl: 'https://mint.minibits.cash/Bitcoin',
  },
  {
    name: 'Mineracks',
    mintUrl: 'https://mint.mineracks.com',
  },
  {
    name: 'Macadamia Mint',
    mintUrl: 'https://mint.macadamia.cash',
  },
  {
    name: 'WesternBTC Mint',
    mintUrl: 'https://mint.westernbtc.com',
  },
] as const;

export type RecommendedMint = (typeof RECOMMENDED_MINTS)[number];

function normalizeMintUrl(url: string): string {
  return url.trim().replace(/\/+$/, '').toLowerCase();
}

export function getMintPlaceholders(connectedMints: Array<{ mintUrl: string }>): RecommendedMint[] {
  const availableSlots = Math.max(0, MAX_MINT_ROWS - connectedMints.length);
  if (availableSlots === 0) return [];

  const connectedUrls = new Set(connectedMints.map((mint) => normalizeMintUrl(mint.mintUrl)));
  return RECOMMENDED_MINTS.filter(
    (mint) => !connectedUrls.has(normalizeMintUrl(mint.mintUrl)),
  ).slice(0, availableSlots);
}
