import { initService, mintManager } from '~/services/wallet';

export const mintService = {
  /**
   * Adds a mint to the wallet.
   */
  addMint: async (url: string): Promise<void> => {
    await mintManager.addMint(url);
  },

  /**
   * Returns all mints registered in the wallet.
   */
  getMints: async () => {
    return mintManager.getMints();
  },

  /**
   * Fetches metadata for a mint URL.
   */
  getMintInfo: async (url: string) => {
    return mintManager.getMintInfo(url);
  },

  /**
   * Requests a mint quote (invoice) for depositing funds.
   */
  requestMintQuote: async (url: string, amount: number) => {
    const manager = initService.getManager();
    console.log(`[MintService] Creating mint quote: ${amount} sats (unit: sat) from ${url}`);
    return await manager.quotes.createMintQuote(url, amount);
  },

  /**
   * Checks the status of a mint quote and mints tokens if paid.
   */
  checkAndMint: async (quoteId: string) => {
    const manager = initService.getManager();
    return await manager.quotes.redeemMintQuote(quoteId);
  },
};
