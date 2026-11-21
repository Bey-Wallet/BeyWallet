export type MintMetadataPriority = 'background' | 'visible' | 'interactive';
const ranks = { background: 0, visible: 1, interactive: 2 };
type WaitingRequest = { start: () => void; key?: string; rank: number };

/** Read-only metadata lookups share a small budget; queued offscreen work can be cancelled. */
export function createMintMetadataQueue(concurrency = 4) {
  const waiting: WaitingRequest[] = [];
  let active = 0;
  const drain = () => {
    while (active < concurrency && waiting.length) {
      let next = 0;
      for (let index = 1; index < waiting.length; index++) {
        if (waiting[index].rank > waiting[next].rank) next = index;
      }
      waiting.splice(next, 1)[0].start();
    }
  };
  const aborted = () =>
    Object.assign(new Error('Metadata request cancelled'), { name: 'AbortError' });

  function run<T>(
    request: () => Promise<T>,
    signal: AbortSignal,
    { key, priority = 'visible' }: { key?: string; priority?: MintMetadataPriority } = {},
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (signal.aborted) {
        reject(aborted());
        return;
      }
      const cancel = () => {
        const index = waiting.indexOf(entry);
        if (index < 0) return;
        waiting.splice(index, 1);
        signal.removeEventListener('abort', cancel);
        reject(aborted());
      };
      const entry: WaitingRequest = {
        key,
        rank: ranks[priority],
        start: () => {
          signal.removeEventListener('abort', cancel);
          active++;
          void Promise.resolve()
            .then(() => {
              if (signal.aborted) throw aborted();
              return request();
            })
            .then(resolve, reject)
            .finally(() => {
              active--;
              drain();
            });
        },
      };
      signal.addEventListener('abort', cancel);
      waiting.push(entry);
      drain();
    });
  }
  return Object.assign(run, {
    promote(key: string, priority: MintMetadataPriority) {
      for (const entry of waiting) {
        if (entry.key === key) entry.rank = Math.max(entry.rank, ranks[priority]);
      }
    },
  });
}

export const queueMintMetadata = createMintMetadataQueue();
