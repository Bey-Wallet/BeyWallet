import { useEffect, useRef, useState } from 'react';
import { nostrProfileService, type NostrProfile } from '~/services/api/nostrProfileService';

export function useNostrProfileSearch(query: string) {
  const [results, setResults] = useState<NostrProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const cleaned = query.trim();
    const requestId = ++requestIdRef.current;

    if (!cleaned) {
      setResults([]);
      setIsSearching(false);
      setError(null);
      return;
    }

    setResults([]);
    setIsSearching(true);
    setError(null);

    const timeout = setTimeout(async () => {
      try {
        const profiles = await nostrProfileService.search(cleaned);
        if (requestId === requestIdRef.current) setResults(profiles);
      } catch {
        if (requestId === requestIdRef.current) {
          setResults([]);
          setError('Nostr search is unavailable. Try again.');
        }
      } finally {
        if (requestId === requestIdRef.current) setIsSearching(false);
      }
    }, 350);

    return () => clearTimeout(timeout);
  }, [query]);

  return { results, isSearching, error };
}
