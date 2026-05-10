/**
 * Shared utility: fetch /v1/info metadata with 3-layer icon fallback.
 * Cashu NUT spec uses `icon_url`.
 */

export interface MintMetadata {
    name?: string;
    description?: string;
    icon?: string;       // resolved: icon_url → icon → iconUrl → favicon
    motd?: string;
    units?: string[];
}

const metadataCache = new Map<string, MintMetadata>();

/** Extract favicon url from any mint URL (last-resort icon) */
export function deriveFavicon(mintUrl: string): string {
    try { return `${new URL(mintUrl).origin}/favicon.ico`; } catch { return ''; }
}

export async function fetchMintMeta(url: string): Promise<MintMetadata> {
    const key = url.replace(/\/$/, '');
    if (metadataCache.has(key)) return metadataCache.get(key)!;

    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 6000);
        const res = await fetch(`${key}/v1/info`, {
            signal: controller.signal,
            headers: { Accept: 'application/json' },
        });
        clearTimeout(timer);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        // Cashu NUT spec field is `icon_url`; legacy fallbacks: icon / iconUrl
        const iconFromInfo = data.icon_url || data.icon || data.iconUrl || '';
        const meta: MintMetadata = {
            name: data.name || data.shortname,
            description: data.description || data.description_long,
            icon: iconFromInfo || deriveFavicon(key),
            motd: data.motd,
            units: data.units
                ? (Array.isArray(data.units) ? data.units : Object.keys(data.units))
                : undefined,
        };
        metadataCache.set(key, meta);
        return meta;
    } catch {
        const fallback: MintMetadata = { icon: deriveFavicon(key) };
        metadataCache.set(key, fallback);
        return fallback;
    }
}

export function clearMintMetaCache(url?: string) {
    if (url) metadataCache.delete(url.replace(/\/$/, ''));
    else metadataCache.clear();
}
