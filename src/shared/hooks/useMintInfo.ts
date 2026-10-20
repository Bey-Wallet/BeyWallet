import { useQuery } from '@tanstack/react-query';
import { mintHealthService, mintHealthUrl } from '~/services/api/mintHealthService';

export function mintInfoQueryOptions(url: string) {
  let canonical: string | null = null;
  try {
    canonical = mintHealthUrl(url);
  } catch {
    // Invalid URLs must not start requests or crash a list row.
  }
  return {
    queryKey: ['mint-metadata', canonical ?? url],
    queryFn: async ({ signal }: { signal: AbortSignal }): Promise<Record<string, any>> =>
      mintHealthService.mintInfo(canonical ?? url, signal),
    enabled: canonical !== null,
    staleTime: 5 * 60 * 1000,
    retry: false as const,
    networkMode: 'always' as const,
  };
}

export function useMintInfo(
  url: string,
  {
    enabled = true,
    refetchOnMount = true,
  }: {
    enabled?: boolean;
    refetchOnMount?: boolean | 'always';
  } = {},
) {
  const options = mintInfoQueryOptions(url);
  return useQuery({ ...options, enabled: options.enabled && enabled, refetchOnMount });
}
