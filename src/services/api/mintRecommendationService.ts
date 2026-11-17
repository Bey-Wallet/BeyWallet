import { SimplePool, type Event, type Filter } from 'nostr-tools';
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

type DiscoveryOptions = {
  onUpdate?: (mints: MintRecommendation[]) => void;
  signal?: AbortSignal;
  initialMints?: MintRecommendation[];
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
  discoverMints: async (
    limit = Infinity,
    { onUpdate, signal, initialMints = [] }: DiscoveryOptions = {},
  ): Promise<MintRecommendation[]> => {
    const pool = new SimplePool();
    const relays = getNostrQueryRelays(DEFAULT_RELAYS);
    const recommendationsMap = new Map<string, MintRecommendation>();
    for (const mint of initialMints) {
      const url = canonicalUrl(mint.url);
      if (url) recommendationsMap.set(url, { ...mint, url });
    }
    const radarByUrl = new Map<string, MintRecommendation>();
    let updateTimer: ReturnType<typeof setTimeout> | undefined;
    const snapshot = () =>
      [...recommendationsMap.values()].map((mint) => ({
        ...mint,
        ...radarByUrl.get(mint.url),
        name: radarByUrl.get(mint.url)?.name || mint.name,
      }));
    const publish = () => {
      clearTimeout(updateTimer);
      updateTimer = undefined;
      if (!signal?.aborted) onUpdate?.(snapshot().slice(0, limit));
    };
    const scheduleUpdate = () => {
      // Batch relay bursts so discovery does not re-render on every event.
      if (onUpdate && !updateTimer && !signal?.aborted) updateTimer = setTimeout(publish, 100);
    };
    const mergeRadar = (mints: Awaited<ReturnType<typeof mintHealthService.radarList>>) => {
      for (const mint of mints) {
        const url = canonicalUrl(mint.url);
        if (!url) continue;
        if (!recommendationsMap.has(url))
          recommendationsMap.set(url, { url, reviewsCount: 0, averageRating: null });
        radarByUrl.set(url, {
          url,
          name: mint.name || undefined,
          reviewsCount: mint.reviewsCount,
          averageRating: mint.averageRating,
          status: mint.status,
          reliabilityScore: mint.score,
          isTestnet: mint.isTest,
        });
      }
    };

    // Pre-fill with featured mints for robustness
    FEATURED_MINTS.forEach((url) => {
      if (recommendationsMap.has(url)) return;
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

    // Saved/featured rows are immediately usable; network results append in arrival order.
    mergeRadar(mintHealthService.cachedRadarList()?.data ?? []);
    publish();

    const collect = (filter: Filter, consume: (event: Event) => void): Promise<void> => {
      if (!onUpdate)
        return pool.querySync(relays, filter, { maxWait: 8000 }).then((events) => {
          events.forEach(consume);
        });
      return new Promise((resolve) => {
        let subscription: ReturnType<SimplePool['subscribeEose']> | undefined;
        let finished = false;
        const finish = () => {
          if (finished) return;
          finished = true;
          clearTimeout(timeout);
          signal?.removeEventListener('abort', finish);
          subscription?.close();
          resolve();
        };
        const timeout = setTimeout(finish, 8000);
        signal?.addEventListener('abort', finish);
        if (signal?.aborted) {
          finish();
          return;
        }
        try {
          subscription = pool.subscribeEose(relays, filter, {
            maxWait: 8000,
            onevent: (event) => {
              if (finished || signal?.aborted) return;
              consume(event);
              scheduleUpdate();
            },
            onclose: finish,
          });
          if (finished) subscription.close();
        } catch {
          finish();
        }
      });
    };

    try {
      // 1. Fetch Mint Information (Kind 38172)
      const infoFilter: Filter = {
        kinds: [MINT_INFO_KIND],
        limit: 50,
      };

      const infoPromise = collect(infoFilter, (event) => {
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
      const reviewsByUrl: Record<string, number[]> = {};
      const seenReviews = new Set<string>();
      const reviewsPromise = collect({ kinds: [RECOMMENDATION_KIND], limit: 100 }, (event) => {
        if (event.id && seenReviews.has(event.id)) return;
        if (event.id) seenReviews.add(event.id);
        const uTags = event.tags.filter((t) => t[0] === 'u');
        const ratingTag = event.tags.find((t) => t[0] === 'rating');
        const rating = ratingTag ? parseInt(ratingTag[1]) : null;

        uTags.forEach((tag) => {
          const url = canonicalUrl(tag[1]);
          if (url) {
            if (!reviewsByUrl[url]) {
              reviewsByUrl[url] = [];
              const previous = recommendationsMap.get(url);
              if (previous) previous.reviewsCount = FEATURED_MINTS.includes(url) ? 1 : 0;
            }
            if (rating !== null && Number.isFinite(rating)) reviewsByUrl[url].push(rating);

            if (!recommendationsMap.has(url)) {
              recommendationsMap.set(url, {
                url,
                reviewsCount: 0,
                averageRating: null,
              });
            }

            const rec = recommendationsMap.get(url)!;
            rec.reviewsCount++;
            const ratings = reviewsByUrl[url];
            if (ratings.length > 0)
              rec.averageRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;
          }
        });
      });

      const radarPromise = mintHealthService
        .radarList(signal)
        .then((mints) => {
          if (signal?.aborted) return;
          mergeRadar(mints);
          publish();
        })
        .catch(() => {
          // Keep the already displayed cache and relay discoveries on provider failure.
        });
      await Promise.allSettled([infoPromise, reviewsPromise, radarPromise]);
    } catch (error) {
      console.error('Error discovering mints:', error);
    } finally {
      clearTimeout(updateTimer);
      pool.close(relays);
    }
    if (signal?.aborted)
      throw Object.assign(new Error('Discovery cancelled'), { name: 'AbortError' });
    publish();
    // Interactive discovery keeps row positions stable, including when refresh finishes.
    if (onUpdate) return snapshot().slice(0, limit);
    const statusOrder = (mint: MintRecommendation) =>
      mint.status === 'online' ? 0 : mint.status ? 2 : 1;
    return snapshot()
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
