/**
 * useNip05Lookup — live NIP-05 username lookup for bey.cash
 *
 * Fetches the user's bey.cash username by querying the NIP-05 well-known
 * endpoint and matching the returned pubkey against the local npub.
 *
 * Falls back to the locally stored nip05 if the remote fetch fails.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { nip19 } from 'nostr-tools';
import { Buffer } from 'buffer';
import { useSettingsStore } from '~/store/settingsStore';

const DOMAIN = 'bey.cash';
const NIP05_URL = `https://${DOMAIN}/.well-known/nostr.json`;

/** Convert npub → hex pubkey */
function npubToHex(npub: string): string | null {
    if (!npub) return null;
    if (/^[0-9a-fA-F]{64}$/.test(npub)) return npub;
    try {
        const decoded = nip19.decode(npub);
        if (decoded.type === 'npub') {
            const data = decoded.data as unknown;
            if (typeof data === 'string') return data.toLowerCase();
            if (data instanceof Uint8Array) return Buffer.from(data).toString('hex');
        }
    } catch { /* ignore */ }
    return null;
}

export interface Nip05Result {
    /** Full NIP-05: "username@bey.cash" */
    nip05: string | null;
    /** Just the username part (before @) */
    username: string | null;
    /** Loading state */
    loading: boolean;
    /** Whether the lookup succeeded from remote */
    isRemote: boolean;
    /** Refresh the lookup */
    refresh: () => void;
}

/**
 * Hook to look up the bey.cash username for the current wallet's npub.
 *
 * 1. First tries to return the locally stored nip05 instantly
 * 2. Then queries the bey.cash NIP-05 endpoint in the background
 * 3. If found remotely, updates the local store so it persists
 *
 * @param autoRefreshMs — auto-refresh interval (0 to disable, default 0)
 */
export function useNip05Lookup(autoRefreshMs = 0): Nip05Result {
    const npub = useSettingsStore(state => state.npub);
    const storedNip05 = useSettingsStore(state => state.nip05);
    const setNip05 = useSettingsStore(state => state.setNip05);

    const [username, setUsername] = useState<string | null>(null);
    const [nip05, setNip05State] = useState<string | null>(storedNip05);
    const [loading, setLoading] = useState(false);
    const [isRemote, setIsRemote] = useState(false);
    const fetchedRef = useRef(false);

    // Initialize from stored value
    useEffect(() => {
        if (storedNip05) {
            setNip05State(storedNip05);
            const parts = storedNip05.split('@');
            if (parts.length === 2) setUsername(parts[0]);
        }
    }, [storedNip05]);

    const doLookup = useCallback(async () => {
        if (!npub) return;

        const hexPub = npubToHex(npub);
        if (!hexPub) return;

        setLoading(true);

        try {
            // Fetch all names from bey.cash NIP-05 endpoint
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);

            const res = await fetch(`${NIP05_URL}?_t=${Date.now()}`, {
                signal: controller.signal,
                headers: { Accept: 'application/json' },
            });
            clearTimeout(timeoutId);

            if (!res.ok) {
                console.log(`[NIP-05] bey.cash returned ${res.status}`);
                return;
            }

            const data = await res.json();
            const names: Record<string, string> = data?.names || {};

            // Find our pubkey in the names
            let foundUsername: string | null = null;
            for (const [name, pubkey] of Object.entries(names)) {
                if (pubkey.toLowerCase() === hexPub.toLowerCase()) {
                    foundUsername = name;
                    break;
                }
            }

            if (foundUsername) {
                const fullNip05 = `${foundUsername}@${DOMAIN}`;
                console.log(`[NIP-05] ✅ Found: ${fullNip05}`);

                setUsername(foundUsername);
                setNip05State(fullNip05);
                setIsRemote(true);

                // Persist to local store if changed
                if (storedNip05 !== fullNip05) {
                    setNip05(fullNip05);
                }
            } else {
                console.log(`[NIP-05] No bey.cash username found for this npub`);
                // If no remote match but we had a stored bey.cash nip05, clear it
                if (storedNip05 && storedNip05.endsWith(`@${DOMAIN}`)) {
                    // The registration may have been removed
                    // Don't clear - might just be relay lag
                }
            }
        } catch (err) {
            console.log('[NIP-05] Lookup failed (may be offline):', err);
        } finally {
            setLoading(false);
        }
    }, [npub, storedNip05, setNip05]);

    // Initial fetch on mount
    useEffect(() => {
        if (!fetchedRef.current && npub) {
            fetchedRef.current = true;
            doLookup();
        }
    }, [npub, doLookup]);

    // Optional auto-refresh
    useEffect(() => {
        if (!autoRefreshMs || autoRefreshMs <= 0) return;
        const interval = setInterval(doLookup, autoRefreshMs);
        return () => clearInterval(interval);
    }, [autoRefreshMs, doLookup]);

    return {
        nip05,
        username,
        loading,
        isRemote,
        refresh: doLookup,
    };
}
