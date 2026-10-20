import { useQuery } from '@tanstack/react-query';
import { mintRecommendationService } from '~/services/api/mintRecommendationService';

export function useMintDiscovery() {
  return useQuery({
    queryKey: ['all-mint-recommendations', 'radar-and-nip87'],
    queryFn: () => mintRecommendationService.discoverMints(),
    staleTime: 5 * 60 * 1000,
  });
}
