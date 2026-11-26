import { hapticService } from '~/services/platform/hapticService';
import { useWalletStore } from '~/state/walletStore';
import { mintUrlKey } from '~/shared/utils/mintUrl';
import { mintHealthUrl } from '~/services/api/mintHealthService';

/** Connects a mint after the user confirms the trust review. */
export async function connectMint(url: string) {
  try {
    mintHealthUrl(url);
  } catch (error) {
    hapticService.reject();
    throw error;
  }
  useWalletStore.setState({ error: null });
  await useWalletStore.getState().addMint(url, { trusted: true });
  const state = useWalletStore.getState();
  if (state.error) throw new Error(state.error);
  if (!state.mints.some((mint) => mintUrlKey(mint.mintUrl) === mintUrlKey(url) && mint.trusted)) {
    throw new Error('Could not connect to this mint. Please try again.');
  }
  hapticService.completion();
}
