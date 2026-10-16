import { create } from 'zustand';
import type { ChatMessage } from '~/storage/sqlite/repositories/MessageRepository';
let generation = 0;

export const useMessageStore = create<{
  recent: ChatMessage[];
  unread: Record<string, number>;
  revision: number;
  refresh: () => Promise<void>;
  clear: () => void;
}>((set) => ({
  recent: [],
  unread: {},
  revision: 0,
  refresh: async () => {
    const currentGeneration = generation;
    const { initService } =
      require('~/services/wallet/initService') as typeof import('~/services/wallet/initService');
    const repository = initService.getRepo().messageRepository;
    const [recent, unread] = await Promise.all([repository.recent(), repository.unread()]);
    if (generation !== currentGeneration) return;
    set((state) => ({ recent, unread, revision: state.revision + 1 }));
  },
  clear: () => {
    generation++;
    set({ recent: [], unread: {}, revision: 0 });
  },
}));
