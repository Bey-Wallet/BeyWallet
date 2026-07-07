/**
 * Mint manager — mint CRUD, trust management, info, multi-unit support.
 *
 * Uses Manager.mint (MintApi) and direct repo access for keyset repair.
 */

import { initService } from './initService';
import type { MintInfo } from './types';

function mgr() {
    return initService.getManager();
}

export const mintManager = {
    // ─── Mint CRUD ────────────────────────────────────────────

    /**
     * Add a mint and optionally trust it.
     * Fetches mint info and keysets automatically.
     */
    addMint: async (mintUrl: string, options?: { trusted?: boolean }): Promise<void> => {
        await mgr().mint.addMint(mintUrl, options);
        console.log(`[MintManager] Mint added: ${mintUrl}, trusted: ${options?.trusted ?? false}`);
    },

    /**
     * Trust an existing mint.
     */
    trustMint: async (mintUrl: string): Promise<void> => {
        await mgr().mint.trustMint(mintUrl);
        console.log(`[MintManager] Mint trusted: ${mintUrl}`);
    },

    /**
     * Untrust a mint (cached info remains).
     */
    untrustMint: async (mintUrl: string): Promise<void> => {
        await mgr().mint.untrustMint(mintUrl);
        console.log(`[MintManager] Mint untrusted: ${mintUrl}`);
    },

    /**
     * Remove a mint from the device entirely.
     */
    removeMint: async (mintUrl: string): Promise<void> => {
        const repo = initService.getRepo();
        if ((mgr().mint as any).removeMint) {
            await (mgr().mint as any).removeMint(mintUrl);
        } else {
            await (repo.mintRepository as any).deleteMint?.(mintUrl);
        }

        // Clean up all tables containing the deleted mintUrl to purge data completely
        try {
            const db = (repo as any).db;
            if (db && typeof db.run === 'function') {
                console.log(`[MintManager] Wiping database tables for mint: ${mintUrl}`);
                await db.run('DELETE FROM coco_cashu_keysets WHERE mintUrl = ?', [mintUrl]);
                await db.run('DELETE FROM coco_cashu_counters WHERE mintUrl = ?', [mintUrl]);
                await db.run('DELETE FROM coco_cashu_proofs WHERE mintUrl = ?', [mintUrl]);
                await db.run('DELETE FROM coco_cashu_mint_quotes WHERE mintUrl = ?', [mintUrl]);
                await db.run('DELETE FROM coco_cashu_melt_quotes WHERE mintUrl = ?', [mintUrl]);
                await db.run('DELETE FROM coco_cashu_history WHERE mintUrl = ?', [mintUrl]);
            }
        } catch (dbErr) {
            console.error('[MintManager] Failed to wipe DB tables for removed mint:', dbErr);
        }

        console.log(`[MintManager] Mint removed: ${mintUrl}`);
    },

    /**
     * Check if a mint is trusted.
     */
    isMintTrusted: async (mintUrl: string): Promise<boolean> => {
        return mgr().mint.isTrustedMint(mintUrl);
    },

    // ─── Queries ──────────────────────────────────────────────

    /**
     * Get all registered mints.
     */
    getAllMints: async () => {
        return mgr().mint.getAllMints();
    },

    /**
     * Get all trusted mints.
     */
    getAllTrustedMints: async () => {
        return mgr().mint.getAllTrustedMints();
    },

    /**
     * Get mint info (name, description, supported NUTs, etc.).
     * Adds the mint if not already cached.
     */
    getMintInfo: async (mintUrl: string) => {
        // addMint fetches and caches info
        await mgr().mint.addMint(mintUrl);
        return mgr().mint.getMintInfo(mintUrl);
    },

    // ─── UI Helpers ───────────────────────────────────────────

    /**
     * Build MintInfo[] for UI display with trust status.
     */
    getMintInfoList: async (): Promise<MintInfo[]> => {
        const allMints = await mgr().mint.getAllMints();
        const trustedMints = await mgr().mint.getAllTrustedMints();
        const trustedUrls = new Set(trustedMints.map(m => m.mintUrl));

        return allMints.map(m => {
            const info = (m as any).mintInfo || {};
            return {
                mintUrl: m.mintUrl,
                name: info.name || info.nickname || info.shortname || m.name,
                nickname: (m as any).nickname,
                description: info.description,
                icon: info.icon_url || info.picture,
                trusted: trustedUrls.has(m.mintUrl),
            };
        });
    },

    // ─── Keyset Debugging / Repair ────────────────────────────

    /**
     * Debug: list all keysets for a mint.
     */
    debugKeysets: async (mintUrl: string) => {
        const repo = initService.getRepo();
        const keysets = await repo.keysetRepository.getKeysetsByMintUrl(mintUrl);
        console.log('[MintManager] Keysets for', mintUrl);
        keysets.forEach((k: any) => {
            console.log(`  - ${k.id}: unit=${k.unit}, active=${k.active}, feePpk=${k.feePpk}`);
        });
        return keysets;
    },

    /**
     * Repair corrupted keysets (empty unit values).
     * Returns true if any repairs were made.
     */
    repairMintKeysets: async (mintUrl: string, unit = 'sat'): Promise<boolean> => {
        const repo = initService.getRepo();
        const keysets = await repo.keysetRepository.getKeysetsByMintUrl(mintUrl);

        let repaired = false;
        for (const keyset of keysets) {
            const k = keyset as any;
            if (!k.unit || k.unit === '') {
                console.log(`[MintManager] Fixing keyset ${k.id} (empty unit → ${unit})`);
                await repo.db.run(
                    'UPDATE coco_cashu_keysets SET unit = ? WHERE mintUrl = ? AND id = ?',
                    [unit, mintUrl, k.id]
                );
                repaired = true;
            }
        }

        if (repaired) {
            console.log('[MintManager] Keysets repaired');
        }
        return repaired;
    },

    /**
     * Set a nickname for a mint in the DB.
     */
    setMintNickname: async (mintUrl: string, nickname: string): Promise<void> => {
        const repo = initService.getRepo();
        await (repo.mintRepository as any).setMintNickname?.(mintUrl, nickname);
    },

    /**
     * Get the fee per-proof-per-kilo (feePpk) for a mint's active keyset.
     * Returns 0 if no fee or mint not found.
     */
    getFeePpk: async (mintUrl: string): Promise<number> => {
        try {
            const repo = initService.getRepo();
            const keysets = await repo.keysetRepository.getKeysetsByMintUrl(mintUrl);
            // Find the active keyset, or the first one
            const active = keysets.find((k: any) => k.active) || keysets[0];
            return (active as any)?.feePpk || 0;
        } catch {
            return 0;
        }
    },

    /**
     * Estimate the total fee for a transaction given a number of input proofs.
     * Fee formula (NUT-02): ceil(numInputs * feePpk / 1000)
     */
    estimateFee: async (mintUrl: string, numInputs: number): Promise<number> => {
        const feePpk = await mintManager.getFeePpk(mintUrl);
        if (feePpk <= 0 || numInputs <= 0) return 0;
        return Math.ceil(numInputs * feePpk / 1000);
    },
};
