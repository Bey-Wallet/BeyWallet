import { SimplePool, Filter } from 'nostr-tools';

export type MintRecommendation = {
    url: string;
    reviewsCount: number;
    averageRating: number | null;
    name?: string;
    description?: string;
    icon?: string;
    error?: boolean;
    isTestnet?: boolean;
};

const DEFAULT_RELAYS = [
    "wss://relay.damus.io",
    "wss://relay.8333.space/",
    "wss://nos.lol",
    "wss://relay.primal.net",
];

const MINT_INFO_KIND = 38172;
const RECOMMENDATION_KIND = 38000;

const FEATURED_MINTS = [
    "https://8333.space:3338",
    "https://mint.minibits.cash/Bitcoin",
    "https://legend.lnbits.com/cashu/api/v1/4gr93mame836988",
    "https://mint.probatio.money:3338"
];

export const mintRecommendationService = {
    /**
     * Discovers mints by fetching recommendations and info from Nostr relays.
     */
    discoverMints: async (limit = 20): Promise<MintRecommendation[]> => {
        const pool = new SimplePool();
        const recommendationsMap = new Map<string, MintRecommendation>();

        // Pre-fill with featured mints for robustness
        FEATURED_MINTS.forEach(url => {
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

            const infoEvents = await pool.querySync(DEFAULT_RELAYS, infoFilter);

            infoEvents.forEach(event => {
                const url = event.tags.find(t => t[0] === 'u')?.[1];
                if (url && url.startsWith('http')) {
                    const existing = recommendationsMap.get(url) || {
                        url,
                        reviewsCount: 0,
                        averageRating: null,
                    };

                    try {
                        const content = JSON.parse(event.content);
                        existing.name = content.name || existing.name;
                        existing.description = content.description || existing.description;
                        existing.icon = content.icon || existing.icon;
                    } catch (e) {
                        // Not JSON or legacy content
                    }

                    recommendationsMap.set(url, existing);
                }
            });

            // 2. Fetch Recommendations/Reviews (Kind 38000)
            const recFilter: Filter = {
                kinds: [RECOMMENDATION_KIND],
                limit: 100,
            };

            const recEvents = await pool.querySync(DEFAULT_RELAYS, recFilter);

            const reviewsByUrl: Record<string, number[]> = {};

            recEvents.forEach(event => {
                const uTags = event.tags.filter(t => t[0] === 'u');
                const ratingTag = event.tags.find(t => t[0] === 'rating');
                const rating = ratingTag ? parseInt(ratingTag[1]) : null;

                uTags.forEach(tag => {
                    const url = tag[1];
                    if (url && url.startsWith('http')) {
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

            // Convert to array and sort by review count
            return Array.from(recommendationsMap.values())
                .sort((a, b) => b.reviewsCount - a.reviewsCount)
                .slice(0, limit);

        } catch (error) {
            console.error('Error discovering mints:', error);
            return [];
        } finally {
            pool.close(DEFAULT_RELAYS);
        }
    },

    /**
     * Fetches details for a specific mint to augment recommendation data if needed.
     */
    fetchMintMetadata: async (url: string) => {
        try {
            const response = await fetch(`${url.replace(/\/$/, '')}/v1/info`, {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
            });
            if (response.ok) {
                return await response.json();
            }
        } catch (e) {
            console.error(`Failed to fetch metadata for ${url}`, e);
        }
        return null;
    }
};
