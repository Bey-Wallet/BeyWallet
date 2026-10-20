/**
 * Presentation adapter for the shared /v1/info query, with icon fallback.
 * Cashu NUT spec uses `icon_url`.
 */

export interface MintMetadata {
  name?: string;
  description?: string;
  icon?: string; // resolved: icon_url → icon → iconUrl → favicon
  motd?: string;
  units?: string[];
  nuts?: Record<string, any>;
  supportsNut30?: boolean;
}

import { deriveFavicon } from '~/shared/utils/mintIcon';
export { deriveFavicon } from '~/shared/utils/mintIcon';

export function mintMetadataFromInfo(
  data: Record<string, any> | undefined,
  url: string,
): MintMetadata {
  if (!data) return { icon: deriveFavicon(url) };
  // Cashu NUT spec field is `icon_url`; legacy fallbacks: icon / iconUrl
  const iconFromInfo = data.icon_url || data.icon || data.iconUrl || '';

  // Check for NUT-30 onchain support
  const nuts = data.nuts || {};
  const nut30 = nuts['30'] || nuts[30];
  let supportsNut30 = !!(
    nut30 &&
    (nut30.supported || (Array.isArray(nut30.methods) && nut30.methods.length > 0))
  );
  if (!supportsNut30) {
    const nut4 = nuts['4'] || nuts[4];
    const nut5 = nuts['5'] || nuts[5];
    const hasOnchainMint =
      Array.isArray(nut4?.methods) && nut4.methods.some((m: any) => m.method === 'onchain');
    const hasOnchainMelt =
      Array.isArray(nut5?.methods) && nut5.methods.some((m: any) => m.method === 'onchain');
    supportsNut30 = !!(hasOnchainMint && hasOnchainMelt);
  }

  const meta: MintMetadata = {
    name: data.name || data.shortname,
    description: data.description || data.description_long,
    icon: iconFromInfo || deriveFavicon(url),
    motd: data.motd,
    units: data.units
      ? Array.isArray(data.units)
        ? data.units
        : Object.keys(data.units)
      : undefined,
    nuts,
    supportsNut30,
  };
  return meta;
}
