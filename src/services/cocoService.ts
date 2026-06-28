import { initializeCoco, Manager, getDecodedToken, getEncodedToken } from 'coco-cashu-core';
import { getEncodedTokenV4 } from '@cashu/cashu-ts';
import { ExpoSqliteRepositories } from '../store/test';
import * as SQLite from 'expo-sqlite';
import { seedService } from './seedService';
import { AppState, AppStateStatus } from 'react-native';

let cocoManager: Manager | null = null;
let repo: ExpoSqliteRepositories | null = null;
let appStateSubscription: any = null;

export const cocoService = {
    /**
     * Internal helper to clean token strings (remove prefixes, whitespace, etc.)
     * Also handles "Peanut" tokens (hidden in variation selectors)
     */
    _cleanToken: (tokenString: any): string => {
        if (!tokenString) return '';

        let clean = '';

        // Handle potential array of numbers or Buffer
        if (Array.isArray(tokenString)) {
            // Convert character codes to string
            clean = String.fromCharCode(...tokenString).trim();
        } else if (typeof tokenString !== 'string') {
            try {
                // Try toString fallback (handles Buffer, etc.)
                clean = tokenString.toString().trim();

                // If it still looks like [object ...], it failed to be useful
                if (clean.startsWith('[object')) {
                    return '';
                }
            } catch (e) {
                return '';
            }
        } else {
            clean = tokenString.trim();
        }

        // 1. Try to extract Peanut data (variation selectors)
        const peanut = cocoService._extractPeanut(clean);
        if (peanut) {
            console.log('[CocoService] Extracted Peanut data from token');
            clean = peanut;
        }

        // 2. Remove common prefixes
        if (clean.toLowerCase().startsWith('cashu:')) {
            clean = clean.substring(6);
        } else if (clean.toLowerCase().startsWith('lightning:')) {
            clean = clean.substring(10);
        } else if (clean.toLowerCase().startsWith('creq:')) {
            clean = clean.substring(5);
        }

        // 3. Match standard cashu/creq token patterns (A=V3, B=V4)
        // cashuA..., cashuB..., creqA..., creqB...
        const cashuMatch = clean.match(/(cashu|creq)[A-Za-z0-9+/=_-]+/);
        if (cashuMatch) {
            return cashuMatch[0];
        }

        return clean;
    },

    /**
     * Extracts hidden Cashu tokens from "Peanut" format (Variation Selectors)
     */
    _extractPeanut: (text: string): string | null => {
        try {
            let decoded: string[] = [];
            const chars = Array.from(text);
            if (!chars.length) return null;

            const fromVariationSelector = (char: string): string | null => {
                const codePoint = char.codePointAt(0);
                if (!codePoint) return null;

                // Handle Variation Selectors (VS1-VS16): U+FE00 to U+FE0F
                if (codePoint >= 0xfe00 && codePoint <= 0xfe0f) {
                    return String.fromCharCode(codePoint - 0xfe00);
                }

                // Handle Variation Selectors Supplement (VS17-VS256): U+E0100 to U+E01EF
                if (codePoint >= 0xe0100 && codePoint <= 0xe01ef) {
                    return String.fromCharCode(codePoint - 0xe0100 + 16);
                }

                return null;
            };

            for (const char of chars) {
                const byteValue = fromVariationSelector(char);
                if (byteValue === null && decoded.length > 0) {
                    break;
                } else if (byteValue === null) {
                    continue;
                }
                decoded.push(byteValue);
            }

            const result = decoded.join('');
            return result.length > 0 ? result : null;
        } catch (e) {
            return null;
        }
    },

    /**
     * Initializes the CocoManager with an EXISTING wallet.
     * Does NOT create a new wallet if none exists.
     * Use createWallet() for new wallet creation.
     */
    init: async (): Promise<Manager> => {
        if (cocoManager) {
            console.log('[CocoService] Already initialized');
            return cocoManager;
        }

        console.log('[CocoService] Checking for existing mnemonic...');
        const mnemonic = await seedService.getMnemonic();
        if (!mnemonic) {
            throw new Error('No wallet exists. Use createWallet() first.');
        }

        console.log('[CocoService] Mnemonic found, initializing...');
        return cocoService._initializeWithMnemonic(mnemonic);
    },

    /**
     * Creates a new wallet with the provided mnemonic.
     * Used during onboarding flow.
     */
    createWallet: async (mnemonic: string): Promise<Manager> => {
        if (cocoManager) {
            console.log('[CocoService] Manager already exists, resetting...');
            cocoService.reset();
        }

        console.log('[CocoService] Saving new mnemonic...');
        await seedService.saveMnemonic(mnemonic);
        console.log('[CocoService] Mnemonic saved, initializing wallet...');

        return cocoService._initializeWithMnemonic(mnemonic);
    },

    /**
     * Internal method to initialize with a mnemonic.
     */
    _initializeWithMnemonic: async (mnemonic: string): Promise<Manager> => {
        const seed = await seedService.deriveSeed(mnemonic);
        console.log('[CocoService] Seed derived');

        // Initializing Expo SQLite repository
        console.log('[CocoService] Opening database...');
        const db = await SQLite.openDatabaseAsync('coco_wallet.db');
        const repositoriesInstance = new ExpoSqliteRepositories({ database: db });

        console.log('[CocoService] Initializing repositories...');
        await repositoriesInstance.init();
        console.log('[CocoService] Repositories initialized');

        console.log('[CocoService] Initializing CocoManager with full config...');
        cocoManager = await initializeCoco({
            // Storage adapter - persists proofs, quotes, mints, etc.
            repo: repositoriesInstance,

            // BIP-39 seed getter - never persisted by coco, called when needed
            seedGetter: async () => new Uint8Array(seed),

            // Watchers configuration - auto-update quote and proof states
            watchers: {
                mintQuoteWatcher: {
                    disabled: false,
                    watchExistingPendingOnStart: true, // Resume watching pending quotes on init
                },
                proofStateWatcher: {
                    disabled: false, // Auto-check proof states
                },
            },

            // Processors configuration - auto-redeem paid mint quotes
            processors: {
                mintQuoteProcessor: {
                    disabled: false,
                    processIntervalMs: 5000, // Check every 5 seconds
                    maxRetries: 3,
                    baseRetryDelayMs: 1000,
                    initialEnqueueDelayMs: 500,
                },
            },
        });
        console.log('[CocoService] CocoManager ready with watchers and processors');

        repo = repositoriesInstance;

        // Setup app state listener for pause/resume subscriptions
        cocoService._setupAppStateListener();

        return cocoManager;
    },

    /**
     * Setup listener to pause/resume subscriptions based on app state.
     * This saves battery when app is in background.
     */
    _setupAppStateListener: () => {
        // Remove existing listener if any
        if (appStateSubscription) {
            appStateSubscription.remove();
        }

        appStateSubscription = AppState.addEventListener('change', async (nextAppState: AppStateStatus) => {
            if (!cocoManager) return;

            try {
                if (nextAppState === 'background' || nextAppState === 'inactive') {
                    console.log('[CocoService] App going to background, pausing subscriptions...');
                    await cocoManager.pauseSubscriptions();
                } else if (nextAppState === 'active') {
                    console.log('[CocoService] App coming to foreground, resuming subscriptions...');
                    await cocoManager.resumeSubscriptions();
                }
            } catch (err) {
                console.error('[CocoService] Error managing subscriptions:', err);
            }
        });
    },

    /**
     * Checks if a wallet exists (without initializing).
     */
    walletExists: async (): Promise<boolean> => {
        return seedService.walletExists();
    },

    /**
     * Returns the repositories instance.
     */
    getRepo: (): ExpoSqliteRepositories => {
        if (!repo) {
            throw new Error('Repositories not initialized');
        }
        return repo;
    },

    /**
     * Debug method to check keysets in database.
     */
    debugKeysets: async (mintUrl: string) => {
        if (!repo) {
            throw new Error('Repositories not initialized');
        }
        const keysets = await repo.keysetRepository.getKeysetsByMintUrl(mintUrl);
        console.log('[CocoService Debug] Keysets for', mintUrl);
        keysets.forEach((k: any) => {
            console.log(`  - ${k.id}: unit=${k.unit}, active=${k.active}, feePpk=${k.feePpk}`);
        });
        return keysets;
    },

    /**
     * Repair keysets for a mint by setting proper unit values.
     * This fixes corrupted keysets that were stored without units.
     * Returns true if any repairs were made (caller should reinit manager).
     */
    repairMintKeysets: async (mintUrl: string, unit = 'sat'): Promise<boolean> => {
        if (!repo) {
            throw new Error('Repositories not initialized');
        }
        console.log(`[CocoService] Checking keysets for ${mintUrl}...`);

        const keysets = await repo.keysetRepository.getKeysetsByMintUrl(mintUrl);

        let repaired = false;
        for (const keyset of keysets) {
            const k = keyset as any;
            if (!k.unit || k.unit === '') {
                console.log(`  Fixing keyset ${k.id} (empty unit -> ${unit})...`);
                // Update the keyset with proper unit
                await repo.db.run(
                    'UPDATE coco_cashu_keysets SET unit = ? WHERE mintUrl = ? AND id = ?',
                    [unit, mintUrl, k.id]
                );
                repaired = true;
            }
        }

        if (repaired) {
            console.log('[CocoService] Keysets repaired!');
        } else {
            console.log('[CocoService] All keysets already have correct units.');
        }

        return repaired;
    },

    /**
     * Returns the CocoManager instance.
     * Throws if not initialized.
     */
    getManager: (): Manager => {
        if (!cocoManager) {
            throw new Error('CocoManager not initialized');
        }
        return cocoManager;
    },

    /**
     * Checks if manager is initialized.
     */
    isInitialized: (): boolean => {
        return cocoManager !== null;
    },

    /**
     * Resets the manager (for logout or dev purposes).
     */
    reset: () => {
        if (appStateSubscription) {
            appStateSubscription.remove();
            appStateSubscription = null;
        }
        cocoManager = null;
        repo = null;
    },

    /**
     * Add and trust a mint. Required before wallet operations.
     * @param mintUrl - The mint URL to add and trust
     * @param options - { trusted: boolean } - whether to trust immediately
     */
    addMint: async (mintUrl: string, options?: { trusted?: boolean }): Promise<void> => {
        if (!cocoManager) {
            throw new Error('CocoManager not initialized');
        }
        await cocoManager.mint.addMint(mintUrl, options);
        console.log(`[CocoService] Mint added: ${mintUrl}, trusted: ${options?.trusted ?? false}`);
    },

    /**
     * Trust an existing mint.
     */
    trustMint: async (mintUrl: string): Promise<void> => {
        if (!cocoManager) {
            throw new Error('CocoManager not initialized');
        }
        await cocoManager.mint.trustMint(mintUrl);
        console.log(`[CocoService] Mint trusted: ${mintUrl}`);
    },

    /**
     * Get all trusted mints.
     */
    getTrustedMints: async (): Promise<any[]> => {
        if (!cocoManager) {
            throw new Error('CocoManager not initialized');
        }
        return cocoManager.mint.getAllTrustedMints();
    },

    /**
     * Get balances for all mints.
     */
    getBalances: async (): Promise<{ [mintUrl: string]: number }> => {
        if (!cocoManager) {
            throw new Error('CocoManager not initialized');
        }
        const balances = await cocoManager.wallet.getBalances();
        console.log('[CocoService] getBalances result:', JSON.stringify(balances));
        return balances;
    },

    /**
     * Restore wallet from seed for a specific mint.
     * This recovers proofs and counters based on the BIP-39 seed.
     */
    restoreFromSeed: async (mintUrl: string): Promise<void> => {
        if (!cocoManager) {
            throw new Error('CocoManager not initialized');
        }
        console.log(`[CocoService] Restoring wallet from seed for mint: ${mintUrl}`);
        await cocoManager.wallet.restore(mintUrl);
        console.log('[CocoService] Wallet restored');
    },

    /**
     * Get mint info (name, description, etc.) for preview.
     * This fetches and caches mint info without trusting.
     */
    getMintInfo: async (mintUrl: string): Promise<any> => {
        if (!cocoManager) {
            throw new Error('CocoManager not initialized');
        }
        // Add the mint to fetch and cache its info
        await cocoManager.mint.addMint(mintUrl);
        // Now retrieve the cached info
        const info = await cocoManager.mint.getMintInfo(mintUrl);
        return info;
    },

    /**
     * Untrust a mint (cached info remains).
     */
    untrustMint: async (mintUrl: string): Promise<void> => {
        if (!cocoManager) {
            throw new Error('CocoManager not initialized');
        }
        await cocoManager.mint.untrustMint(mintUrl);
        console.log(`[CocoService] Mint untrusted: ${mintUrl}`);
    },

    /**
     * Check if a mint is trusted.
     */
    isMintTrusted: async (mintUrl: string): Promise<boolean> => {
        if (!cocoManager) {
            throw new Error('CocoManager not initialized');
        }
        return cocoManager.mint.isTrustedMint(mintUrl);
    },

    // ==========================================
    // MINTING (Sats → Ecash via Lightning)
    // ==========================================

    /**
     * Create a mint quote (Lightning invoice to pay).
     * @param mintUrl - The mint to create quote from
     * @param amount - Amount in sats
     * @returns Quote with invoice to pay
     */
    createMintQuote: async (mintUrl: string, amount: number) => {
        if (!cocoManager) {
            throw new Error('CocoManager not initialized');
        }
        console.log(`[CocoService] Creating mint quote: ${amount} sats (unit: sat) from ${mintUrl}`);
        const quote = await cocoManager.quotes.createMintQuote(mintUrl, amount);
        console.log(`[CocoService] ✅ Mint quote created: ${quote.quote}`);
        return quote;
    },

    /**
     * Manually redeem a paid mint quote.
     * Note: With watchers enabled, this happens automatically.
     */
    redeemMintQuote: async (mintUrl: string, quoteId: string) => {
        if (!cocoManager) {
            throw new Error('CocoManager not initialized');
        }
        console.log(`[CocoService] Redeeming mint quote: ${quoteId}`);
        await cocoManager.quotes.redeemMintQuote(mintUrl, quoteId);
        console.log('[CocoService] Mint quote redeemed');
    },

    // ==========================================
    // RECEIVING (Ecash Token → Balance)
    // ==========================================

    /**
     * Receive an ecash token and add proofs to wallet.
     * @param token - Encoded cashu token string or Token object
     */
    receive: async (token: string) => {
        if (!cocoManager) {
            throw new Error('CocoManager not initialized');
        }
        const cleanToken = cocoService._cleanToken(token);
        console.log('[CocoService] Receiving token:', cleanToken.substring(0, 50) + '...');
        try {
            await cocoManager.wallet.receive(cleanToken);
            console.log('[CocoService] Token received successfully');
        } catch (err: any) {
            console.error('[CocoService] Receive failed:', err.message, err);
            throw err;
        }
    },

    /**
     * Decode a token to preview its contents (mint, amount, etc.)
     * @param tokenString - Encoded cashu token string
     */
    decodeToken: (tokenString: string) => {
        const cleanToken = cocoService._cleanToken(tokenString);

        try {
            return getDecodedToken(cleanToken);
        } catch (err: any) {
            console.warn('[CocoService] Standard getDecodedToken failed, trying manual fallback...', err.message);

            // Manual fallback for V3/V4 (cashuA, cashuB, creqA, creqB)
            try {
                let base64Part = '';
                if (cleanToken.startsWith('cashuA') || cleanToken.startsWith('cashuB')) {
                    base64Part = cleanToken.substring(6);
                } else if (cleanToken.startsWith('creqA') || cleanToken.startsWith('creqB')) {
                    base64Part = cleanToken.substring(5);
                }

                if (base64Part) {
                    // Normalize base64 (handle url-safe base64 used in V4)
                    const normalizedB64 = base64Part.replace(/-/g, '+').replace(/_/g, '/');

                    // V4 tokens (B) use CBOR, V3 (A) use JSON
                    if (cleanToken.includes('B')) {
                        // For V4, we really should use the library, but if it fails...
                        // We might just be getting a "version not supported" because of its prefix
                        // Let's try to just re-decode it with 'cashuA' prefix to see if it's actually V3 but labeled wrong?
                        // (Unlikely, but worth a shot if we have a weird token)
                    }

                    const decodedStr = Buffer.from(normalizedB64, 'base64').toString('utf8');
                    const json = JSON.parse(decodedStr);

                    if (json.token && Array.isArray(json.token)) {
                        const first = json.token[0];
                        return {
                            token: json.token,
                            mint: first.mint,
                            proofs: first.proofs,
                            unit: first.unit || 'sat'
                        };
                    }
                }
            } catch (fallbackErr) {
                console.error('[CocoService] Manual fallback also failed:', fallbackErr);
            }

            // Check for creq specific error
            if (cleanToken.startsWith('creq')) {
                throw new Error('This is a Cashu Request (creq). Receiving creq tokens is not yet supported in this tab.');
            }

            // Check for common non-cashu formats to provide better errors
            const lower = cleanToken.toLowerCase();
            if (lower.startsWith('lnbc') || lower.startsWith('lightning:lnbc')) {
                throw new Error('This looks like a Lightning Invoice. Please use the "Send" tab to pay invoices.');
            }
            if (lower.startsWith('lnurl')) {
                throw new Error('This looks like an LNURL. LNURL deposits are not yet supported in this flow.');
            }

            if (err.message?.includes('version')) {
                throw new Error(`The scanned token version is not supported by this wallet. Please use a V3 or V4 token.`);
            }
            throw new Error('Invalid or unsupported cashu token format.');
        }
    },

    // ==========================================
    // SENDING (Balance → Ecash Token)
    // ==========================================


    /**
     * Send tokens from a mint directly (no prepare/execute saga).
     * @param mintUrl - The mint to send from
     * @param amount - Amount to send in sats
     * @returns The token to share with recipient
     */
    send: async (mintUrl: string, amount: number) => {
        if (!cocoManager) {
            throw new Error('CocoManager not initialized');
        }
        console.log(`[CocoService] Sending (Custom): ${amount} sats from ${mintUrl}`);

        // Use custom service to fix strict unit/keyset issues
        const token = await customSendService.send(mintUrl, amount);

        console.log('[CocoService] Send complete, token created');

        // Ensure token is saved in metadata for easy retrieval
        try {
            // Find the latest 'send' entry that matches this transaction
            const history = await cocoService.getRepo().historyRepository.getPaginatedHistoryEntries(1, 0);
            const latest = history[0] as any; // Cast to any to safely access all properties including those not in base HistoryEntry

            // Check if it looks like our transaction (mint, amount, type)
            if (latest && latest.type === 'send' && latest.mintUrl === mintUrl && latest.amount === amount) {
                // Check if we need to update metadata
                if (!latest.metadata?.token) {
                    console.log('[CocoService] Backfilling token into history metadata');
                    await cocoService.getRepo().historyRepository.updateHistoryEntry({
                        mintUrl: latest.mintUrl,
                        type: 'send',
                        amount: latest.amount,
                        unit: latest.unit,
                        operationId: latest.operationId,
                        state: latest.state,
                        token: latest.token,
                        metadata: { ...(latest.metadata || {}), token: token }
                    } as any);
                }
            }
        } catch (e) {
            console.warn('[CocoService] Failed to backfill token metadata:', e);
        }

        return token;
    },

    /**
     * Encode a token object to shareable string.
     * Uses V4 by default (compact CBOR), falls back to V3.
     */
    encodeToken: (token: any): string => {
        return cocoService.encodeTokenV4(token);
    },

    /**
     * Encode as V4 (CBOR)
     */
    encodeTokenV4: (token: any): string => {
        try {
            return getEncodedTokenV4(token);
        } catch (e) {
            console.warn('[CocoService] Failed to encode as V4, falling back to V3', e);
            return getEncodedToken(token);
        }
    },

    /**
     * Encode as V3 (JSON)
     */
    encodeTokenV3: (token: any): string => {
        return getEncodedToken(token);
    },

    /**
     * Encodes a token string into the "Peanut" format (Variation Selectors)
     */
    encodeTokenPeanut: (tokenStr: string): string => {
        return (
            "🥜" +
            Array.from(tokenStr)
                .map((char) => {
                    const byteValue = char.charCodeAt(0);
                    if (byteValue >= 0 && byteValue <= 15) {
                        return String.fromCodePoint(0xfe00 + byteValue);
                    }
                    if (byteValue >= 16 && byteValue <= 255) {
                        return String.fromCodePoint(0xe0100 + (byteValue - 16));
                    }
                    return "";
                })
                .join("")
        );
    },

    // ==========================================
    // HISTORY
    // ==========================================

    /**
     * Get paginated transaction history.
     * @param limit - Number of entries to fetch
     * @param offset - Offset for pagination
     */
    getHistory: async (limit = 25, offset = 0) => {
        if (!cocoManager) {
            throw new Error('CocoManager not initialized');
        }
        return cocoManager.history.getPaginatedHistory(offset, limit);
    },



    // ==========================================
    // EVENT SUBSCRIPTIONS
    // ==========================================

    /**
     * Subscribe to a coco event.
     * Events: 'mint-quote:redeemed', 'receive:created', 'send:created', 'history:updated'
     */
    on: (event: any, callback: (...args: any[]) => void) => {
        if (!cocoManager) {
            throw new Error('CocoManager not initialized');
        }
        return cocoManager.on(event, callback);
    },

    /**
     * Unsubscribe from a coco event.
     */
    off: (event: any, callback: (...args: any[]) => void) => {
        if (!cocoManager) {
            throw new Error('CocoManager not initialized');
        }
        cocoManager.off(event, callback);
    },

    /**
     * Check the status of proofs from a token.
     * Returns the states (e.g. 'UNSPENT', 'SPENT', 'PENDING')
     */
    checkProofStates: async (tokenString: string) => {
        // TODO: Re-implement checkProofStates using cocoManager or correct CashuMint import
        console.warn('[CocoService] checkProofStates is currently disabled due to build issues.');
        return [];
        /*
        const decoded = cocoService.decodeToken(tokenString);
        if (!decoded || !decoded.token || decoded.token.length === 0) {
            throw new Error('Could not decode token for status check');
        }

        const allResults: any[] = [];
        for (const entry of decoded.token) {
            try {
                // const mint = new CashuMint(entry.mint);
                // const results = await mint.check(entry.proofs);
                // allResults.push(...results);
            } catch (err) {
                console.warn(`[CocoService] Failed to check status at ${entry.mint}:`, err);
            }
        }

        return allResults;
        */
    },
};
