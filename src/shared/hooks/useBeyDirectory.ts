import { useQuery } from '@tanstack/react-query';

/** Both search screens share availability, saved results and explicit retry. */
export function useBeyDirectory() {
  return useQuery<Record<string, string>>({
    queryKey: ['bey-directory'],
    networkMode: 'always',
    queryFn: async ({ signal }) => {
      const response = await fetch(`https://bey.cash/.well-known/nostr.json?_t=${Date.now()}`, {
        signal,
      });
      if (!response.ok) throw new Error('Directory unavailable');
      const data = await response.json();
      if (!data?.names || typeof data.names !== 'object' || Array.isArray(data.names))
        throw new Error('Directory unavailable');
      return Object.fromEntries(
        Object.entries(data.names).filter(
          (entry): entry is [string, string] => typeof entry[1] === 'string',
        ),
      );
    },
    staleTime: 5 * 60_000,
    retry: false,
  });
}
