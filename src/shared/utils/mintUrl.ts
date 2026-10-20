/** Preserve path case, ports and schemes when identifying a mint. */
export function normalizeMintUrl(value: string) {
  const url = new URL(value.trim());
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
    throw new Error('Invalid mint URL');
  url.hash = '';
  return `${url.protocol}//${url.host.toLowerCase()}${url.pathname.replace(/\/+$/, '')}${url.search}`;
}

/** Display matching must tolerate old or incomplete entries without crashing. */
export function mintUrlKey(value: string) {
  try {
    return normalizeMintUrl(value);
  } catch {
    return value.trim().replace(/\/+$/, '');
  }
}
