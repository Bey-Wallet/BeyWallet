import { create } from 'zustand';
import type { LightningReceipt } from '~/storage/sqlite/repositories/LightningAddressRepository';

export const lightningAddressDefaults = {
  loaded: false,
  enabled: false,
  autoCollect: true,
  receivingMint: '',
  connection: 'Disabled',
  lastChecked: 0,
  pending: [] as LightningReceipt[],
};
export const useLightningAddressStore = create(() => ({ ...lightningAddressDefaults }));
