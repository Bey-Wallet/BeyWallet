import { SimplePool, Filter } from 'nostr-tools';
import { getNostrQueryRelays } from '~/state/nostrRelayStore';
import { mintHealthService, mintHealthUrl } from './mintHealthService';

export type MintRecommendation = {
  url: string;
  reviewsCount: number;
  averageRating: number | null;
  name?: string;
  description?: string;
  icon?: string;
  error?: boolean;
  isTestnet?: boolean;
  status?: string | null;
  reliabilityScore?: number | null;
};

function canonicalUrl(raw: unknown): string | null {
  try {
    return typeof raw === 'string' ? mintHealthUrl(raw) : null;
  } catch {
    return null;
  }
}

const DEFAULT_RELAYS = [
  'wss://relay.cashumints.space',
  'wss://nos.lol',
  'wss://relay.azzamo.net',
  'wss://relay.snort.social',
  'wss://relay.primal.net',
  'wss://relay.damus.io',
  'wss://relay.8333.space/',
];

const MINT_INFO_KIND = 38172;
const RECOMMENDATION_KIND = 38000;

const FEATURED_MINTS = [
  'https://8333.space:3338',
  'https://mint.minibits.cash/Bitcoin',
  'https://legend.lnbits.com/cashu/api/v1/4gr93mame836988',
  'https://mint.probatio.money:3338',
];

export const mintRecommendationService = {
  /**
   * Merge MintRadar's complete wallet list with NIP-87 relay discovery.
   */
  discoverMints: async (limit = Infinity): Promise<MintRecommendation[]> => {
    // Start independently: a failed relay must not discard MintRadar's list.
    const radarPromise = mintHealthService
      .radarList()
      .catch(() => mintHealthService.cachedRadarList()?.data ?? []);
    const pool = new SimplePool();
    const relays = getNostrQueryRelays(DEFAULT_RELAYS);
    const recommendationsMap = new Map<string, MintRecommendation>();

    // Pre-fill with featured mints for robustness
    FEATURED_MINTS.forEach((url) => {
      let name = url;
      try {
        name = new URL(url).hostname;
      } catch (e) {
        // ignore
      }
      recommendationsMap.set(url, {
        url,
        reviewsCount: 1, // Give them a slight boost
        averageRating: 5.0,
        name: name,
      });
    });

    try {
      // 1. Fetch Mint Information (Kind 38172)
      const infoFilter: Filter = {
        kinds: [MINT_INFO_KIND],
        limit: 50,
      };

      const [infoResult, reviewResult] = await Promise.allSettled([
        pool.querySync(relays, infoFilter, { maxWait: 8000 }),
        pool.querySync(relays, { kinds: [RECOMMENDATION_KIND], limit: 100 }, { maxWait: 8000 }),
      ]);
      const infoEvents = infoResult.status === 'fulfilled' ? infoResult.value : [];

      infoEvents.forEach((event) => {
        const url = canonicalUrl(event.tags.find((t) => t[0] === 'u')?.[1]);
        if (url) {
          const existing = recommendationsMap.get(url) || {
            url,
            reviewsCount: 0,
            averageRating: null,
          };

          try {
            const content = JSON.parse(event.content);
            if (typeof content?.name === 'string' && content.name.trim())
              existing.name = content.name;
            if (typeof content?.description === 'string')
              existing.description = content.description;
            if (typeof content?.icon === 'string') existing.icon = content.icon;
          } catch (e) {
            // Not JSON or legacy content
          }

          recommendationsMap.set(url, existing);
        }
      });

      // 2. Fetch Recommendations/Reviews (Kind 38000)
      const recEvents = reviewResult.status === 'fulfilled' ? reviewResult.value : [];

      const reviewsByUrl: Record<string, number[]> = {};

      recEvents.forEach((event) => {
        const uTags = event.tags.filter((t) => t[0] === 'u');
        const ratingTag = event.tags.find((t) => t[0] === 'rating');
        const rating = ratingTag ? parseInt(ratingTag[1]) : null;

        uTags.forEach((tag) => {
          const url = canonicalUrl(tag[1]);
          if (url) {
            if (!reviewsByUrl[url]) reviewsByUrl[url] = [];
            if (rating !== null) reviewsByUrl[url].push(rating);

            if (!recommendationsMap.has(url)) {
              recommendationsMap.set(url, {
                url,
                reviewsCount: 0,
                averageRating: null,
              });
            }

            const rec = recommendationsMap.get(url)!;
            rec.reviewsCount++;
          }
        });
      });

      // Calculate average ratings
      for (const [url, ratings] of Object.entries(reviewsByUrl)) {
        const rec = recommendationsMap.get(url);
        if (rec && ratings.length > 0) {
          rec.averageRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;
        }
      }
    } catch (error) {
      console.error('Error discovering mints:', error);
    } finally {
      pool.close(relays);
    }

    const radarMints = await radarPromise;
    radarMints.forEach((mint) => {
      const existing = recommendationsMap.get(mint.url);
      recommendationsMap.set(mint.url, {
        ...existing,
        url: mint.url,
        name: mint.name || existing?.name || new URL(mint.url).hostname,
        reviewsCount: mint.reviewsCount,
        averageRating: mint.averageRating,
        status: mint.status,
        reliabilityScore: mint.score,
        isTestnet: mint.isTest,
      });
    });
    const statusOrder = (mint: MintRecommendation) =>
      mint.status === 'online' ? 0 : mint.status ? 2 : 1;
    return Array.from(recommendationsMap.values())
      .sort(
        (a, b) =>
          statusOrder(a) - statusOrder(b) ||
          (b.reliabilityScore ?? -1) - (a.reliabilityScore ?? -1) ||
          b.reviewsCount - a.reviewsCount ||
          (a.name || a.url).localeCompare(b.name || b.url),
      )
      .slice(0, limit);
  },
};
