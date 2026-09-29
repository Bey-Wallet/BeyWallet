export interface MintPreviewInfo {
  name: string;
  description?: string;
  mintUrl: string;
  hostname: string;
  icon?: string;
  motd?: string;
  version?: string;
  contact?: string;
  publicKey?: string;
  supportedNuts: number;
  paymentMethods: string[];
  mintingLimits?: string;
  paymentLimits?: string;
  isSecure: boolean;
}

function cleanText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  return text ? text.slice(0, maxLength) : undefined;
}

function getMethods(nut: unknown): Array<Record<string, unknown>> {
  if (!nut || typeof nut !== 'object' || (nut as { disabled?: boolean }).disabled === true)
    return [];
  const methods = (nut as { methods?: unknown }).methods;
  return Array.isArray(methods)
    ? methods.filter(
        (method): method is Record<string, unknown> => !!method && typeof method === 'object',
      )
    : [];
}

function formatLimits(methods: Array<Record<string, unknown>>): string | undefined {
  const minimums = methods
    .map((method) => method.min_amount)
    .filter(
      (value): value is number =>
        typeof value === 'number' && Number.isSafeInteger(value) && value >= 0,
    );
  const maximums = methods
    .map((method) => method.max_amount)
    .filter(
      (value): value is number =>
        typeof value === 'number' && Number.isSafeInteger(value) && value >= 0,
    );
  if (minimums.length === 0 && maximums.length === 0) return undefined;

  const unit = cleanText(methods.find((method) => method.unit)?.unit, 12) || 'sat';
  const minimum = minimums.length > 0 ? Math.min(...minimums) : undefined;
  const maximum = maximums.length > 0 ? Math.max(...maximums) : undefined;
  if (minimum !== undefined && maximum !== undefined) {
    return `${minimum.toLocaleString()}–${maximum.toLocaleString()} ${unit}`;
  }
  if (maximum !== undefined) return `Up to ${maximum.toLocaleString()} ${unit}`;
  return `From ${minimum!.toLocaleString()} ${unit}`;
}

export function parseMintPreview(mintUrl: string, data: Record<string, unknown>): MintPreviewInfo {
  const normalized = mintUrl.replace(/\/+$/, '');
  const parsedUrl = new URL(normalized);
  const nuts =
    data.nuts && typeof data.nuts === 'object' ? (data.nuts as Record<string, unknown>) : {};
  const mintMethods = getMethods(nuts['4']);
  const meltMethods = getMethods(nuts['5']);
  const methodNames = new Set(
    [...mintMethods, ...meltMethods]
      .map((method) => cleanText(method.method, 24)?.toLowerCase())
      .filter((method): method is string => !!method),
  );
  const paymentMethods: string[] = [];
  if (methodNames.has('bolt11')) paymentMethods.push('Lightning');
  if (methodNames.has('bolt12')) paymentMethods.push('BOLT 12');
  if (methodNames.has('onchain')) paymentMethods.push('On-chain');

  const contacts = Array.isArray(data.contact) ? data.contact : [];
  const contact = contacts
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return undefined;
      const method = cleanText((entry as Record<string, unknown>).method, 24);
      const info = cleanText((entry as Record<string, unknown>).info, 120);
      return info ? (method ? `${method}: ${info}` : info) : undefined;
    })
    .find(Boolean);
  const rawIcon =
    cleanText(data.icon_url, 500) ||
    cleanText(data.picture, 500) ||
    cleanText(data.icon, 500) ||
    undefined;
  let icon: string | undefined;
  if (rawIcon) {
    try {
      icon = new URL(rawIcon, `${parsedUrl.origin}/`).toString();
    } catch {
      icon = undefined;
    }
  }

  return {
    name: cleanText(data.name, 80) || cleanText(data.shortname, 80) || parsedUrl.hostname,
    description:
      cleanText(data.description, 500) || cleanText(data.description_long, 500) || undefined,
    mintUrl: normalized,
    hostname: parsedUrl.hostname,
    icon,
    motd: cleanText(data.motd, 500),
    version: cleanText(data.version, 80),
    contact,
    publicKey: cleanText(data.pubkey, 200),
    supportedNuts: Object.keys(nuts).length,
    paymentMethods,
    mintingLimits: formatLimits(mintMethods),
    paymentLimits: formatLimits(meltMethods),
    isSecure: parsedUrl.protocol === 'https:',
  };
}
