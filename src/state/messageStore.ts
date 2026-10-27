import { create } from 'zustand';
import type { ChatMessage } from '~/storage/sqlite/repositories/MessageRepository';
let generation = 0;
let flight: { dirty: boolean; promise: Promise<void> } | null = null;

export const useMessageStore = create<{
  recent: ChatMessage[];
  unread: Record<string, number>;
  revision: number;
  refresh: () => Promise<void>;
  clear: () => void;
}>((set, get) => ({
  recent: [],
  unread: {},
  revision: 0,
  refresh: () => {
    if (flight) {
      flight.dirty = true;
      return flight.promise;
    }
    const currentGeneration = generation;
    const current = { dirty: true, promise: Promise.resolve() };
    flight = current;
    current.promise = Promise.resolve()
      .then(async () => {
        const { initService } =
          require('~/services/wallet/initService') as typeof import('~/services/wallet/initService');
        const repository = initService.getRepo().messageRepository;
        while (current.dirty && currentGeneration === generation) {
          current.dirty = false;
          const [recent, unread] = await Promise.all([repository.recent(), repository.unread()]);
          if (currentGeneration !== generation) return;
          const state = get();
          const sameRecent = JSON.stringify(state.recent) === JSON.stringify(recent);
          const sameUnread =
            Object.keys(state.unread).length === Object.keys(unread).length &&
            Object.keys(unread).every((key) => unread[key] === state.unread[key]);
          if (!sameRecent || !sameUnread) set({ recent, unread, revision: state.revision + 1 });
        }
      })
      .finally(() => {
        if (flight === current) flight = null;
      });
    return current.promise;
  },
  clear: () => {
    generation++;
    flight = null;
    set({ recent: [], unread: {}, revision: 0 });
  },
}));
