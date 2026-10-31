export const RECOMMENDED_MINTS = [
  {
    name: 'Minibits Mint',
    mintUrl: 'https://mint.minibits.cash/Bitcoin',
  },
  {
    name: 'LemonFizz Mint',
    mintUrl: 'https://mint.lemonfizz.st',
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

export function getMintPlaceholders(connectedMints: Array<{ mintUrl: string }>): RecommendedMint[] {
  return connectedMints.length === 0 ? [...RECOMMENDED_MINTS] : [];
}
