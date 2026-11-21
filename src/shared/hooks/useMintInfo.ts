import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { mintHealthService, mintHealthUrl } from '~/services/api/mintHealthService';
import { queueMintMetadata, type MintMetadataPriority } from '~/services/api/mintMetadataQueue';

export function mintInfoQueryOptions(url: string, priority: MintMetadataPriority = 'visible') {
  let canonical: string | null = null;
  try {
    canonical = mintHealthUrl(url);
  } catch {
    // Invalid URLs must not start requests or crash a list row.
  }
  return {
    queryKey: ['mint-metadata', canonical ?? url],
    queryFn: async ({ signal }: { signal: AbortSignal }): Promise<Record<string, any>> =>
      queueMintMetadata(() => mintHealthService.mintInfo(canonical ?? url, signal), signal, {
        key: canonical ?? url,
        priority,
      }),
    // Do not synchronously read every disk entry when scanning the directory.
    initialData:
      canonical && priority !== 'background'
        ? () => mintHealthService.cachedMintInfo(canonical!)?.data
        : undefined,
    // Disk hints paint immediately, but never count as a new online health check.
    initialDataUpdatedAt: 0,
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
    priority = 'visible',
  }: {
    enabled?: boolean;
    refetchOnMount?: boolean | 'always';
    priority?: MintMetadataPriority;
  } = {},
) {
  const options = mintInfoQueryOptions(url, priority);
  const canonical = options.queryKey[1];
  useEffect(() => {
    if (enabled && options.enabled) queueMintMetadata.promote(canonical, priority);
  }, [canonical, priority, enabled, options.enabled]);
  return useQuery({ ...options, enabled: options.enabled && enabled, refetchOnMount });
}
