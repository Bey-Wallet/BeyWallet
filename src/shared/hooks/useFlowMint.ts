import { useEffect, useState } from 'react';
import { useWalletStore } from '~/state/walletStore';

/** A payment owns its mint; selecting it must not alter the home wallet. */
export function useFlowMint() {
  const globalMint = useWalletStore((s) => s.activeMintUrl);
  const [selected, setSelected] = useState<string | null>(globalMint);
  useEffect(() => {
    if (globalMint) setSelected((current) => current ?? globalMint);
  }, [globalMint]);
  const balances = useWalletStore((s) => s.balances);
  const mintUrl = selected ?? globalMint;
  return { mintUrl, setMintUrl: setSelected, balance: mintUrl ? (balances[mintUrl] ?? 0) : 0 };
}
