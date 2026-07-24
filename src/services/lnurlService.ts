/**
 * Lightning address and LNURL utilities.
 * Ported from Sovran's coco/utils.ts — handles resolution of
 * Lightning addresses (user@domain.com) and lnurlp:// URLs
 * to bolt11 invoices.
 */

// ─── Regexes ──────────────────────────────────────────────────

const LN_ADDRESS_REGEX =
    /^((?:[^<>()[\]\\.,;:\s@"]+(?:\.[^<>()[\]\\.,;:\s@"]+)*)|(?:".+"))@((?:\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(?:(?:[a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

const LNURLP_REGEX = /^lnurlp:\/\/([\w-]+\.)+[\w-]+(:\d{1,5})?(\/[\w-./?%&=]*)?$/;

// ─── Type Detection ───────────────────────────────────────────

/**
 * Check if a string is a Lightning address (user@domain.com).
 */
export function isLightningAddress(input: string): boolean {
    if (!input) return false;
    return LN_ADDRESS_REGEX.test(input.trim());
}

/**
 * Check if a string is a bolt11 Lightning invoice.
 */
export function isBolt11Invoice(input: string): boolean {
    if (!input) return false;
    const lower = input.trim().toLowerCase();
    return lower.startsWith('lnbc') || lower.startsWith('lntb');
}

/**
 * Check if a string is an LNURL-pay URL.
 */
export function isLnurlp(input: string): boolean {
    if (!input) return false;
    return LNURLP_REGEX.test(input.trim());
}

/**
 * Detect the type of Lightning input.
 */
export type LightningInputType = 'bolt11' | 'address' | 'lnurlp' | 'unknown';

export function detectLightningInputType(input: string): LightningInputType {
    if (!input) return 'unknown';
    const cleaned = input.trim();
    if (isBolt11Invoice(cleaned)) return 'bolt11';
    if (isLightningAddress(cleaned)) return 'address';
    if (isLnurlp(cleaned)) return 'lnurlp';
    return 'unknown';
}

// ─── LNURL Resolution ─────────────────────────────────────────

interface LightningAddr {
    username: string;
    domain: string;
}

function parseLightningAddr(address: string): LightningAddr | null {
    if (!address) return null;
    const result = LN_ADDRESS_REGEX.exec(address.trim());
    return result ? { username: result[1], domain: result[2] } : null;
}

function parseLnurlpUrl(url: string): string | null {
    if (!url) return null;
    if (!LNURLP_REGEX.test(url.toLowerCase())) return null;
    const withoutProtocol = url.replace(/^lnurlp:\/\//i, '');
    const slashIndex = withoutProtocol.indexOf('/');
    const protocol = withoutProtocol.toLowerCase().includes('.onion') ? 'http://' : 'https://';
    if (slashIndex === -1) {
        return `${protocol}${withoutProtocol.toLowerCase()}`;
    }
    const domain = withoutProtocol.slice(0, slashIndex).toLowerCase();
    const path = withoutProtocol.slice(slashIndex);
    return `${protocol}${domain}${path}`;
}

function decodeUrlOrAddress(lnUrlOrAddress: string): string | null {
    const address = parseLightningAddr(lnUrlOrAddress);
    if (address) {
        const { username, domain } = address;
        const protocol = domain.match(/\.onion$/) ? 'http' : 'https';
        return `${protocol}://${domain}/.well-known/lnurlp/${username}`;
    }
    return parseLnurlpUrl(lnUrlOrAddress);
}

interface LnUrlPayParams {
    callback: string;
    minSendable: number; // millisats
    maxSendable: number; // millisats
    tag: string;
}

/**
 * Fetch LNURL pay parameters from a Lightning address or lnurlp URL.
 * Returns min/max sendable amounts (in millisats), callback URL, etc.
 */
export async function getLnurlPayParams(lnUrlOrAddress: string): Promise<LnUrlPayParams | null> {
    const url = decodeUrlOrAddress(lnUrlOrAddress);
    if (!url) return null;

    const response = await fetch(url);
    if (!response.ok) {
        console.warn(`[LNURL] HTTP ${response.status} fetching ${url}`);
        return null;
    }
    const data = await response.json();
    return data as LnUrlPayParams;
}

/**
 * Request a bolt11 invoice from a Lightning address or lnurlp URL.
 *
 * @param lnUrlOrAddress - Lightning address (user@domain.com) or lnurlp:// URL
 * @param amountSats - Amount in satoshis
 * @returns bolt11 Lightning invoice string
 */
export async function requestInvoiceFromLnurl(
    lnUrlOrAddress: string,
    amountSats: number
): Promise<string> {
    const params = await getLnurlPayParams(lnUrlOrAddress);
    if (!params || !params.callback) {
        throw new Error('Invalid LNURL or lightning address');
    }

    const amountMsats = amountSats * 1000;

    if (amountMsats < params.minSendable || amountMsats > params.maxSendable) {
        throw new Error(
            `Amount must be between ${Math.ceil(params.minSendable / 1000)} and ${Math.floor(params.maxSendable / 1000)} sats`
        );
    }

    const separator = params.callback.includes('?') ? '&' : '?';
    const response = await fetch(`${params.callback}${separator}amount=${amountMsats}`);
    const data = await response.json();

    if (!data.pr) {
        throw new Error('No invoice returned from LNURL endpoint');
    }

    return data.pr;
}
