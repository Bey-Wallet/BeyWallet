import { create } from 'zustand';
import {
  MintRecommendation,
  mintRecommendationService,
} from '../services/mintRecommendationService';

interface MintRecommendationState {
  recommendations: MintRecommendation[];
  isLoading: boolean;
  error: string | null;
  lastFetched: number | null;

  // Actions
  fetchRecommendations: (force?: boolean) => Promise<void>;
}

export const useMintRecommendationStore = create<MintRecommendationState>((set, get) => ({
  recommendations: [],
  isLoading: false,
  error: null,
  lastFetched: null,

  fetchRecommendations: async (force = false) => {
    const { lastFetched, isLoading } = get();
    const now = Date.now();

    // Don't fetch if already loading or fetched in the last 5 minutes (unless forced)
    if (isLoading || (!force && lastFetched && now - lastFetched < 5 * 60 * 1000)) {
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const recommendations = await mintRecommendationService.discoverMints();
      set({
        recommendations,
        isLoading: false,
        lastFetched: now,
      });
    } catch (err: any) {
      set({
        error: err.message || 'Failed to fetch mint recommendations',
        isLoading: false,
      });
    }
  },
}));
