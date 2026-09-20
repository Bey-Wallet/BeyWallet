import '~/polyfills';
import * as bip39 from 'bip39';
import * as SecureStore from 'expo-secure-store';
import { Buffer } from 'buffer';
import { getPublicKey } from 'nostr-tools/pure';
import * as nip19 from 'nostr-tools/nip19';

const MNEMONIC_KEY = 'bey_wallet_mnemonic';

export const seedService = {
  /**
   * Generates a new 12-word mnemonic.
   */
  generateMnemonic: (): string => {
    console.log('[SeedService] Generating mnemonic');
    return bip39.generateMnemonic();
  },

  /**
   * Saves the mnemonic to secure storage.
   */
  saveMnemonic: async (mnemonic: string): Promise<void> => {
    console.log('[SeedService] Saving mnemonic');
    if (!bip39.validateMnemonic(mnemonic)) {
      console.error('[SeedService] Invalid mnemonic during save');
      throw new Error('Invalid mnemonic');
    }
    await SecureStore.setItemAsync(MNEMONIC_KEY, mnemonic);
    console.log('[SeedService] Mnemonic saved to SecureStore');
  },

  /**
   * Retrieves the mnemonic from secure storage.
   */
  getMnemonic: async (): Promise<string | null> => {
    console.log('[SeedService] Retrieving mnemonic');
    const m = await SecureStore.getItemAsync(MNEMONIC_KEY);
    console.log('[SeedService] Mnemonic retrieved:', !!m);
    return m;
  },

  /**
   * Derives a seed from the given mnemonic.
   */
  deriveSeed: async (mnemonic: string): Promise<Buffer> => {
    console.log('[SeedService] Deriving seed');
    const seed = await bip39.mnemonicToSeed(mnemonic);
    return Buffer.from(seed);
  },

  /**
   * Derives a deterministic Nostr private key from the mnemonic.
   * We use the first 32 bytes of the BIP39 seed for simplicity and consistency.
   */
  getNostrKeys: async (mnemonic: string) => {
    const seed = await bip39.mnemonicToSeed(mnemonic);
    const privateKeyBytes = new Uint8Array(seed.slice(0, 32));
    const privateKeyHex = Buffer.from(privateKeyBytes).toString('hex');

    const publicKey = getPublicKey(privateKeyBytes);
    const npub = nip19.npubEncode(publicKey);
    const nsec = nip19.nsecEncode(privateKeyBytes);

    return {
      privkey: privateKeyHex,
      pubkey: publicKey,
      npub,
      nsec,
    };
  },

  /**
   * Checks if a wallet already exists (mnemonic saved).
   */
  walletExists: async (): Promise<boolean> => {
    const mnemonic = await SecureStore.getItemAsync(MNEMONIC_KEY);
    return !!mnemonic;
  },

  /**
   * Clears the saved mnemonic (Caution: Use for development/reset only).
   */
  clearWallet: async (): Promise<void> => {
    await SecureStore.deleteItemAsync(MNEMONIC_KEY);
  },
};
