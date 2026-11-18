import React, { useCallback, useState } from 'react';
import { ConnectedMintSheet } from '../components/ConnectedMintSheet';

export function useConnectedMintSheet() {
  const [mintUrl, setMintUrl] = useState<string | null>(null);
  const close = useCallback(() => setMintUrl(null), []);
  return {
    openMint: setMintUrl,
    mintSheet: <ConnectedMintSheet mintUrl={mintUrl} onClose={close} />,
  };
}
