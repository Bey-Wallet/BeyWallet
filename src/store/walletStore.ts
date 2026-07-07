import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { sqliteStorage } from './sqliteStorage';
import {
    initService,
    walletService,
    mintManager,
    nostrService,
    quotesService,
} from '../services/core';
import type { MintInfo } from '../services/core';
import { useSettingsStore } from './settingsStore';
import { DEFAULT_MINT } from './constants';
import { InteractionManager, DeviceEventEmitter } from 'react-native';
import { seedService } from '../services/seedService';
import { Mint as CashuMint, Wallet, OutputData } from '@cashu/cashu-ts';

export type MintRestoreStatus = 'pending' | 'scanning' | 'done' | 'error';

export interface MintRestoreEntry {
    mintUrl: string;
    status: MintRestoreStatus;
    restoredBalance: number;
    error?: string;
}

interface WalletState {
    activeMintUrl: string | null;
    balance: number;
    isInitializing: boolean;
    error: string | null;
    mints: MintInfo[];
    refreshCounter: number;
    balances: Record<string, number>;
    isRestoring: boolean;
    restoringMintUrl: string | null;
    restoreQueue: string[];
    scannerResult: string | null;
    isRefreshing: boolean;
    isCheckingPendingOnchain: boolean;
    mintRestoreStatuses: MintRestoreEntry[];

    // Actions
    initialize: () => Promise<void>;
    setActiveMint: (url: string) => void;
    addMint: (url: string, options?: { trusted?: boolean }) => Promise<void>;
    trustMint: (url: string) => Promise<void>;
    untrustMint: (url: string) => Promise<void>;
    removeMint: (url: string) => Promise<void>;
    setMintNickname: (url: string, nickname: string) => Promise<void>;
    fetchMintInfo: (url: string) => Promise<any>;
    refreshBalance: () => Promise<void>;
    refreshMintList: () => Promise<void>;
    restoreFromSeed: (mintUrl: string) => Promise<void>;
    restoreAllMints: (extraMintUrls?: string[]) => Promise<void>;
    setScannerResult: (result: string | null) => void;
    syncMintsToNostr: () => Promise<void>;
    autoCheckPendingOnchainQuotes: () => Promise<void>;
}



export const useWalletStore = create<WalletState>()(
    persist(
        (set, get) => ({
            activeMintUrl: null,
            balance: 0,
            isInitializing: false,
            error: null,
            mints: [],
            refreshCounter: 0,
            balances: {},
            isRestoring: false,
            restoringMintUrl: null,
            restoreQueue: [],
            scannerResult: null,
            isRefreshing: false,
            isCheckingPendingOnchain: false,
            mintRestoreStatuses: [],


            initialize: async () => {
                set({ isInitializing: true, error: null });
                console.log('[WalletStore] Starting initialization...');
                try {
                    const walletExists = await initService.walletExists();
                    if (!walletExists) {
                        console.log('[WalletStore] No wallet exists, skipping initialization');
                        set({ isInitializing: false });
                        return;
                    }

                    const manager = await initService.init();

                    // Ensure the user's default mint exists and is trusted
                    const userDefaultMint = useSettingsStore.getState().defaultMintUrl || DEFAULT_MINT;
                    const existingMints = await manager.mint.getAllMints();
                    const hasDefault = existingMints.some(m => m.mintUrl === userDefaultMint);

                    if (!hasDefault) {
                        await mintManager.addMint(userDefaultMint, { trusted: true });
                    } else {
                        const isTrusted = await manager.mint.isTrustedMint(userDefaultMint);
                        if (!isTrusted) {
                            await mintManager.trustMint(userDefaultMint);
                        }
                    }

                    // Set active mint if not set
                    if (!get().activeMintUrl) {
                        const userDefaultMint = useSettingsStore.getState().defaultMintUrl || DEFAULT_MINT;
                        set({ activeMintUrl: userDefaultMint });
                    }

                    // Parallelize balance refresh + mint info fetch for speed
                    const [, mintInfos] = await Promise.all([
                        get().refreshBalance(),
                        mintManager.getMintInfoList(),
                    ]);

                    const allMints = await manager.mint.getAllMints();

                    set({
                        isInitializing: false,
                        mints: mintInfos,
                    });

                    // Defer keyset repair to background — never blocks startup
                    // Handles real money safely: repair still runs, just after UI is visible
                    InteractionManager.runAfterInteractions(async () => {
                        try {
                            const repairResults = await Promise.all(
                                allMints.map(mint => mintManager.repairMintKeysets(mint.mintUrl, 'sat'))
                            );
                            if (repairResults.some(r => r === true)) {
                                console.log('[WalletStore] Keysets repaired in background, refreshing...');
                                await get().refreshBalance();
                                const freshMintInfos = await mintManager.getMintInfoList();
                                set({ mints: freshMintInfos });
                            }
                        } catch (e) {
                            console.warn('[WalletStore] Background keyset repair error:', e);
                        }
                    });
                    console.log('[WalletStore] Initialization complete');
                } catch (err: any) {
                    console.error('[WalletStore] Initialization failed:', err);
                    set({ error: err.message, isInitializing: false });
                }
            },

            setActiveMint: (url: string) => {
                set({ activeMintUrl: url });
                get().refreshBalance();
            },

            addMint: async (url: string, options?: { trusted?: boolean }) => {
                try {
                    // Fast path — only trust the mint, same as Sovran's addMint
                    await mintManager.addMint(url, options);

                    const mintInfos = await mintManager.getMintInfoList();

                    set({
                        activeMintUrl: url,
                        mints: mintInfos,
                    });

                    get().refreshBalance();

                    // Defer heavy background work AFTER all sheet animations settle
                    // This matches Sovran — addMint never blocks the UI thread
                    InteractionManager.runAfterInteractions(() => {
                        console.log(`[WalletStore] 🔄 Background: repair keysets for: ${url}`);
                        mintManager.repairMintKeysets(url, 'sat').catch(console.warn);
                        get().syncMintsToNostr();
                    });
                } catch (err: any) {
                    console.error('[WalletStore] Failed to add mint:', err);
                    set({ error: err.message });
                }
            },

            trustMint: async (url: string) => {
                try {
                    await mintManager.trustMint(url);
                    const mintInfos = await mintManager.getMintInfoList();
                    set({ mints: mintInfos });
                    InteractionManager.runAfterInteractions(() => {
                        get().syncMintsToNostr();
                    });
                } catch (err: any) {
                    console.error('[WalletStore] Failed to trust mint:', err);
                    set({ error: err.message });
                }
            },

            refreshBalance: async () => {
                try {
                    set({ isRefreshing: true, error: null });
                    if (!initService.isInitialized()) {
                        set({ balance: 0, isRefreshing: false });
                        return;
                    }

                    const activeUrl = get().activeMintUrl;
                    if (!activeUrl) {
                        set({ balance: 0, isRefreshing: false });
                        return;
                    }

                    // Single DB call — derive active mint balance from the map
                    const balances = await walletService.getBalances();
                    const balance = balances[activeUrl] ?? 0;

                    set({ balance, balances, refreshCounter: get().refreshCounter + 1, isRefreshing: false });

                    // Auto-check and redeem pending on-chain quotes in the background
                    InteractionManager.runAfterInteractions(() => {
                        get().autoCheckPendingOnchainQuotes().catch(err => {
                            console.warn('[WalletStore] Background pending on-chain quote check failed:', err);
                        });
                        get().cleanSpentProofs().catch(err => {
                            console.warn('[WalletStore] Background spent proofs clean failed:', err);
                        });
                    });
                } catch (err: any) {
                    console.error('[WalletStore] Error refreshing balance:', err);
                    set({ error: err.message, isRefreshing: false });
                }
            },

            restoreFromSeed: async (mintUrl: string) => {
                const state = get();
                if (state.restoreQueue.includes(mintUrl)) return;

                set({ restoreQueue: [...state.restoreQueue, mintUrl] });

                if (state.isRestoring || state.restoreQueue.length > 1) {
                    console.log(`[WalletStore] ${mintUrl} added to background sync queue`);
                    return;
                }

                while (get().restoreQueue.length > 0) {
                    const nextUrl = get().restoreQueue[0];
                    try {
                        set({ isRestoring: true, restoringMintUrl: nextUrl });

                        // Wait for all React Native animations/sheet transitions to complete
                        // before starting heavy restore work — same philosophy as Sovran
                        await new Promise<void>(resolve =>
                            InteractionManager.runAfterInteractions(resolve)
                        );
                        // Extra buffer so sheet dismiss animation fully completes
                        await new Promise(resolve => setTimeout(resolve, 1000));

                        console.log(`[WalletStore] 🔄 Deterministic Restore: ${nextUrl}`);

                        // Ensure we have all current keysets for this mint
                        await mintManager.addMint(nextUrl, { trusted: true });

                        // Perform NIP-06 deterministic restore (10 min safety timeout)
                        const timeoutPromise = new Promise((_, reject) =>
                            setTimeout(() => reject(new Error('Deep restore timed out after 10 minutes')), 600000)
                        );

                        await Promise.race([
                            walletService.restore(nextUrl),
                            timeoutPromise
                        ]);

                        console.log(`[WalletStore] ✅ Restore complete for: ${nextUrl}`);

                    } catch (err: any) {
                        console.warn(`[WalletStore] ⚠️ Restore partial/failed for ${nextUrl}:`, err?.message);
                    } finally {
                        // Rescue any valid proofs stuck in 'inflight' state
                        await walletService.restoreInflightProofs(nextUrl);

                        // Refresh balances to show restored funds — no reinit needed,
                        // the SDK's watchers continue working without a restart
                        await get().refreshBalance();

                        set(s => ({
                            restoreQueue: s.restoreQueue.filter(u => u !== nextUrl),
                            isRestoring: false,
                            restoringMintUrl: null
                        }));

                        // Yield before processing next mint in queue
                        await new Promise(resolve => setTimeout(resolve, 300));
                    }
                }
            },

            untrustMint: async (url: string) => {
                try {
                    await mintManager.untrustMint(url);
                    await get().refreshMintList();
                    InteractionManager.runAfterInteractions(() => {
                        get().syncMintsToNostr();
                    });
                } catch (err: any) {
                    console.error('[WalletStore] Failed to untrust mint:', err);
                    set({ error: err.message });
                }
            },

            removeMint: async (url: string) => {
                try {
                    await mintManager.removeMint(url);
                    await get().refreshMintList();
                    if (get().activeMintUrl === url) {
                        const userDefaultMint = useSettingsStore.getState().defaultMintUrl || DEFAULT_MINT;
                        // Don't set active if the newly removed mint WAS the default mint
                        if (url !== userDefaultMint) {
                            set({ activeMintUrl: userDefaultMint });
                        } else {
                            const nextActive = get().mints.find(m => m.mintUrl !== url)?.mintUrl;
                            set({ activeMintUrl: nextActive || null });
                        }
                    }
                    await get().refreshBalance();
                    InteractionManager.runAfterInteractions(() => {
                        get().syncMintsToNostr();
                    });
                } catch (err: any) {
                    console.error('[WalletStore] Failed to remove mint:', err);
                    set({ error: err.message });
                }
            },

            fetchMintInfo: async (url: string) => {
                try {
                    return await mintManager.getMintInfo(url);
                } catch (err: any) {
                    console.error('[WalletStore] Failed to fetch mint info:', err);
                    throw err;
                }
            },

            refreshMintList: async () => {
                try {
                    set({ isRefreshing: true });
                    const mintInfos = await mintManager.getMintInfoList();
                    set({ mints: mintInfos, isRefreshing: false });
                } catch (err: any) {
                    console.error('[WalletStore] Failed to refresh mint list:', err);
                    set({ isRefreshing: false });
                }
            },

            setMintNickname: async (url: string, nickname: string) => {
                try {
                    await mintManager.setMintNickname(url, nickname);
                    await get().refreshMintList();
                } catch (err: any) {
                    console.error('[WalletStore] Failed to set mint nickname:', err);
                    set({ error: err.message });
                }
            },

            /**
             * Restore all mints: DEFAULT_MINT + all trusted mints already in DB
             * + any extra mint URLs passed in (e.g. from a backup file).
             * Populates mintRestoreStatuses for progress UI.
             */
            restoreAllMints: async (extraMintUrls: string[] = []) => {
                // Feature/Popular mints to check by default to aid discovery
                const FEATURED_MINTS = [
                    "https://mint.minibits.cash/Bitcoin",
                    "https://testnut.cashu.space",
                    "https://nofee.testnut.cashu.space"
                ];

                // Build deduplicated list of mints to restore
                const urlSet = new Set<string>([DEFAULT_MINT, ...FEATURED_MINTS, ...extraMintUrls]);
                try {
                    const trustedMints = await mintManager.getAllTrustedMints();
                    for (const m of trustedMints) urlSet.add(m.mintUrl);
                } catch (e) {
                    console.warn('[WalletStore] Could not fetch trusted mints for restore:', e);
                }

                const mintUrls = Array.from(urlSet);

                // Initialise status entries
                set({
                    mintRestoreStatuses: mintUrls.map(url => ({
                        mintUrl: url,
                        status: 'pending',
                        restoredBalance: 0,
                    })),
                    isRestoring: true,
                });

                // Process sequentially to prevent DB locking and UI freezes from heavy crypto operations
                for (const mintUrl of mintUrls) {
                    // Mark as scanning
                    set(s => ({
                        mintRestoreStatuses: s.mintRestoreStatuses.map(e =>
                            e.mintUrl === mintUrl ? { ...e, status: 'scanning' } : e
                        ),
                        restoringMintUrl: mintUrl, // purely aesthetic, tracks the last one
                    }));

                    try {
                        // Ensure mint is added and trusted before restoring
                        await mintManager.addMint(mintUrl, { trusted: true });
                        
                        // Restore with a strict 25-second timeout to prevent unresponsive or slow mints from blocking onboarding forever
                        const restorePromise = walletService.restore(mintUrl);
                        await Promise.race([
                            restorePromise,
                            new Promise((_, reject) =>
                                setTimeout(() => reject(new Error('Restore timeout')), 25000)
                            ),
                        ]);

                        // Get restored balance for this mint
                        const allBalances = await walletService.getBalances();
                        const restoredBalance = allBalances[mintUrl] ?? 0;

                        set(s => ({
                            mintRestoreStatuses: s.mintRestoreStatuses.map(e =>
                                e.mintUrl === mintUrl
                                    ? { ...e, status: 'done', restoredBalance }
                                    : e
                            ),
                        }));
                    } catch (err: any) {
                        console.warn(`[WalletStore] Restore failed for ${mintUrl}:`, err?.message);
                        set(s => ({
                            mintRestoreStatuses: s.mintRestoreStatuses.map(e =>
                                e.mintUrl === mintUrl
                                    ? { ...e, status: 'error', error: err?.message }
                                    : e
                            ),
                        }));
                    }
                    
                    // Small delay to let the UI breathe and update animations between heavy tasks
                    await new Promise(resolve => setTimeout(resolve, 300));
                }

                // Re-initialize the core Manager to pick up all restored counters and proofs
                // FAST path to keep UI alive
                console.log('[WalletStore] Batch restore complete. Syncing Manager...');
                await initService.reinitFast();

                // Final refresh
                await get().refreshBalance();
                const mintInfos = await mintManager.getMintInfoList();
                set({ isRestoring: false, restoringMintUrl: null, mints: mintInfos });
                console.log('[WalletStore] ✅ All mints restored');
            },

            setScannerResult: (result: string | null) => {
                set({ scannerResult: result });
            },

            syncMintsToNostr: async () => {
                try {
                    console.log('[WalletStore] Starting mint sync to Nostr...');
                    // Get all trusted mints
                    const trustedMints = await mintManager.getAllTrustedMints();
                    const urlsToBackup = new Set<string>(trustedMints.map(m => m.mintUrl));
                    
                    // Also include any untrusted mints that have a balance > 0
                    const allBalances = await walletService.getBalances();
                    for (const [url, balance] of Object.entries(allBalances)) {
                        if (balance > 0) {
                            urlsToBackup.add(url);
                        }
                    }

                    const mintUrls = Array.from(urlsToBackup);
                    if (mintUrls.length === 0) {
                        return;
                    }

                    const mnemonic = await seedService.getMnemonic();
                    if (!mnemonic) {
                        console.warn('[WalletStore] No mnemonic found, skipping Nostr backup');
                        return;
                    }

                    const keys = await seedService.getNostrKeys(mnemonic);
                    // keys.pubkey is already a hex string
                    const success = await nostrService.backupMintsToNostr(mintUrls, keys.privkey, keys.pubkey);
                    if (success) {
                        DeviceEventEmitter.emit('nostr:sync-success', { npub: keys.npub });
                    }
                } catch (err: any) {
                    console.error('[WalletStore] Failed to sync mints to Nostr:', err?.message || err);
                }
            },

            autoCheckPendingOnchainQuotes: async () => {
                const activeUrl = get().activeMintUrl;
                if (!activeUrl || !initService.isInitialized() || get().isCheckingPendingOnchain) return;

                set({ isCheckingPendingOnchain: true });
                try {
                    const repo = initService.getRepo();
                    const history = await repo.historyRepository.getPaginatedHistoryEntries(100, 0);
                    
                    // 1. Process Pending Deposits (Mints)
                    const pendingOnchainMints = history.filter(
                        h => h.type === 'mint' && h.state === 'pending' && h.metadata?.via === 'onchain'
                    );

                    for (const entry of pendingOnchainMints) {
                        try {
                            console.log(`[WalletStore] Auto-checking pending on-chain deposit quote ${entry.quoteId} for mint ${entry.mintUrl}`);
                            const status = await quotesService.checkOnchainMintQuote(entry.mintUrl, entry.quoteId);
                            const delta = status.amount_paid - status.amount_issued;
                            if (delta > 0 && entry.metadata?.privKey) {
                                console.log(`[WalletStore] Pending on-chain quote ${entry.quoteId} has been paid! Redeeming ${delta} sats...`);
                                await quotesService.redeemOnchainMintQuote(entry.mintUrl, entry.quoteId, entry.metadata.privKey);
                                get().refreshBalance();
                            }
                        } catch (err) {
                            console.warn(`[WalletStore] Failed checking pending quote ${entry.quoteId}:`, err);
                        }
                    }

                    // 2. Process Pending Withdrawals (Melts)
                    const pendingOnchainMelts = history.filter(
                        h => h.type === 'melt' && h.state === 'pending' && h.metadata?.via === 'onchain'
                    );

                    for (const entry of pendingOnchainMelts) {
                        try {
                            console.log(`[WalletStore] Auto-checking pending on-chain melt quote ${entry.quoteId} for mint ${entry.mintUrl}`);
                            const status = await quotesService.checkOnchainMeltQuote(entry.mintUrl, entry.quoteId);
                            
                            if (status.state === 'PAID') {
                                console.log(`[WalletStore] Pending on-chain melt ${entry.quoteId} was paid! Finalizing...`);
                                const m = initService.getManager() as any;

                                // Claim change proofs if any
                                if (status.change && status.change.length > 0 && entry.metadata?.changeOutputs) {
                                    const wallet = new Wallet(new CashuMint(entry.mintUrl));
                                    await wallet.loadMint();
                                    const keyset = wallet.getKeyset(status.change[0].id);
                                    
                                    const outputData = entry.metadata.changeOutputs.map((h: any) => {
                                        // Deserialize Uint8Array from hex string
                                        const secretBytes = new Uint8Array(h.secret.match(/.{1,2}/g).map((byte: string) => parseInt(byte, 16)));
                                        return new OutputData(
                                            h.blindedMessage,
                                            BigInt(h.blindingFactor),
                                            secretBytes
                                        );
                                    });

                                    const changeProofs = status.change.map((sig: any, idx: number) => {
                                        return outputData[idx].toProof(sig, keyset);
                                    });

                                    const changeCoreProofs = changeProofs.map((p: any) => ({
                                        ...p,
                                        mintUrl: entry.mintUrl,
                                        state: 'ready' as const
                                    }));
                                    await repo.proofRepository.saveProofs(entry.mintUrl, changeCoreProofs);
                                    console.log(`[WalletStore] Claimed ${changeProofs.length} change proofs`);
                                }

                                // Mark inputs as spent
                                if (entry.metadata?.inputs) {
                                    const secrets = entry.metadata.inputs.map((p: any) => p.secret);
                                    await m.proofService.setProofState(entry.mintUrl, secrets, 'spent');
                                }

                                // Update history
                                await repo.historyRepository.updateHistoryMeltEntry(entry.mintUrl, entry.quoteId, 'paid');
                                get().refreshBalance();
                                
                            } else if (status.state === 'UNPAID') {
                                console.log(`[WalletStore] Pending on-chain melt ${entry.quoteId} failed/unpaid. Reclaiming inputs...`);
                                const m = initService.getManager() as any;

                                // Restore inputs back to ready
                                if (entry.metadata?.inputs) {
                                    const secrets = entry.metadata.inputs.map((p: any) => p.secret);
                                    await m.proofService.setProofState(entry.mintUrl, secrets, 'ready');
                                }

                                // Update history to failed
                                await repo.historyRepository.updateHistoryMeltEntry(entry.mintUrl, entry.quoteId, 'failed');
                                get().refreshBalance();
                            }
                        } catch (err) {
                            console.warn(`[WalletStore] Failed checking pending melt quote ${entry.quoteId}:`, err);
                        }
                    }
                } catch (e) {
                    console.warn('[WalletStore] Failed to auto-check pending on-chain quotes:', e);
                } finally {
                    set({ isCheckingPendingOnchain: false });
                }
            },

            cleanSpentProofs: async () => {
                const activeUrl = get().activeMintUrl;
                if (!activeUrl || !initService.isInitialized()) return;
                
                try {
                    const repo = initService.getRepo();
                    const m = initService.getManager() as any;
                    const readyProofs = await repo.proofRepository.getReadyProofs(activeUrl);
                    if (readyProofs.length === 0) return;

                    console.log(`[WalletStore] Checking spendable state for ${readyProofs.length} ready proofs on ${activeUrl}...`);
                    const wallet = new Wallet(new CashuMint(activeUrl));
                    const states = await wallet.checkProofsStates(readyProofs.map(p => ({ secret: p.secret, amount: p.amount, C: p.C, id: p.id })));
                    
                    const spentSecrets: string[] = [];
                    states.forEach((s, idx) => {
                        if (s.state === 'SPENT') {
                            spentSecrets.push(readyProofs[idx].secret);
                        }
                    });

                    if (spentSecrets.length > 0) {
                        console.log(`[WalletStore] Found ${spentSecrets.length} spent proofs locally. Setting them to spent...`);
                        await m.proofService.setProofState(activeUrl, spentSecrets, 'spent');
                        await get().refreshBalance();
                    } else {
                        console.log('[WalletStore] All local proofs are fresh and unspent!');
                    }
                } catch (e) {
                    console.warn('[WalletStore] Failed to clean spent proofs:', e);
                }
            },

        }),
        {
            name: 'wallet-storage',
            storage: createJSONStorage(() => sqliteStorage),
            partialize: (state) => ({
                activeMintUrl: state.activeMintUrl,
                balance: state.balance,
                balances: state.balances,
                mints: state.mints,
            }),
        }
    )
);
