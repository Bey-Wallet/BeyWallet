import { useQuery, useQueryClient } from '@tanstack/react-query';
import { mintRecommendationService } from '~/services/api/mintRecommendationService';

const discoveryKey = ['all-mint-recommendations', 'radar-and-nip87'] as const;

export function useMintDiscovery() {
  const client = useQueryClient();
  return useQuery({
    queryKey: discoveryKey,
    queryFn: ({ signal }) =>
      mintRecommendationService.discoverMints(Infinity, {
        signal,
        initialMints: client.getQueryData(discoveryKey),
        onUpdate: (mints) => {
          if (!signal.aborted) client.setQueryData(discoveryKey, mints);
        },
      }),
    staleTime: 5 * 60 * 1000,
  });
}
