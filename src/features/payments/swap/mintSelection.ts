import { mintUrlKey } from '~/shared/utils/mintUrl';

/** An explicit trusted source takes priority without changing the wallet's active mint. */
export function selectTransferSource(
  mints: { mintUrl: string; trusted?: boolean }[],
  balances: Record<string, number>,
  activeMintUrl: string | null,
  requested?: string,
) {
  const trusted = mints.filter((mint) => mint.trusted);
  const matching = (url?: string | null) =>
    typeof url === 'string' && url
      ? trusted.find((mint) => mintUrlKey(mint.mintUrl) === mintUrlKey(url))
      : undefined;
  const active = matching(activeMintUrl);
  return (
    matching(requested)?.mintUrl ??
    (active && (balances[active.mintUrl] ?? 0) > 0 ? active.mintUrl : undefined) ??
    trusted.find((mint) => (balances[mint.mintUrl] ?? 0) > 0)?.mintUrl ??
    active?.mintUrl ??
    trusted[0]?.mintUrl ??
    ''
  );
}
