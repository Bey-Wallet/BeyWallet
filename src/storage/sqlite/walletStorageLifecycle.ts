let generation = 0;

/** Invalidate async UI reads across deletion without importing database or store modules. */
export const walletStorageGeneration = () => generation;
export const invalidateWalletStorageGeneration = () => {
  generation++;
};
