import { create } from 'zustand';
import { bitcoinService, BitcoinPriceData } from '~/services/api/bitcoinService';
import { appLogger } from '~/shared/utils/appLogger';

interface BitcoinState {
  data: BitcoinPriceData | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: number | null;

  // Actions
  fetchPrice: () => Promise<void>;
  loadFromCache: () => Promise<void>;
}

export const useBitcoinStore = create<BitcoinState>((set, get) => ({
  data: null,
  isLoading: false,
  error: null,
  lastUpdated: null,

  fetchPrice: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await bitcoinService.fetchPrice();
      set({ data, isLoading: false, lastUpdated: Date.now() });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  loadFromCache: async () => {
    try {
      const data = await bitcoinService.getFromDb();
      if (data) {
        set({ data, lastUpdated: data.updatedAt * 1000 });
      }
    } catch (err) {
      appLogger.warn('[BitcoinStore] Error loading cache:', err, 'app_runtime');
    }
  },
}));
