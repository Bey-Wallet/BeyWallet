import type { QueryClient } from '@tanstack/react-query';
import { bitcoinService } from '~/services/api/bitcoinService';
import { SUPPORTED_CURRENCIES } from '~/services/wallet/currencyService';

/** Restore display quotes before any screen mounts; old quotes still refetch. */
export function hydrateBitcoinPriceCache(client: QueryClient) {
  client.setQueryDefaults(['bitcoinPrice'], {
    gcTime: Infinity,
    staleTime: 30_000,
  });
  for (const { code } of SUPPORTED_CURRENCIES) {
    const cached = bitcoinService.getCachedPrice(code);
    if (cached) {
      client.setQueryData(['bitcoinPrice', code], cached, { updatedAt: cached.updatedAt * 1000 });
    }
  }
}
