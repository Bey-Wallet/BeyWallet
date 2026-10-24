import { normalizeBitcoinAddress, transactionIdFromOutpoint } from '~/shared/utils/onchain';

export async function fetchDepositTransactionIds(address: string): Promise<string[]> {
  const destination = normalizeBitcoinAddress(address);
  const base = /^(bc1|[13])/i.test(destination)
    ? 'https://mempool.space/api'
    : /^(tb1|bcrt1)/i.test(destination)
      ? 'https://mutinynet.com/api'
      : /^[mn2]/.test(destination)
        ? 'https://mempool.space/testnet/api'
        : undefined;
  if (!base) return [];
  const response = await fetch(`${base}/address/${encodeURIComponent(destination)}/txs`);
  if (!response.ok) throw new Error('Could not load Bitcoin transactions');
  const transactions = await response.json();
  return Array.from(
    new Set<string>(
      transactions
        .filter((tx: any) =>
          tx.vout?.some((output: any) => output.scriptpubkey_address === destination),
        )
        .map((tx: any) => transactionIdFromOutpoint(tx.txid))
        .filter((txid: string | undefined): txid is string => !!txid),
    ),
  );
}
