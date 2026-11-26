import React from 'react';
import { useQuery } from '@tanstack/react-query';
import type { MintTransferRecord } from '~/services/wallet/mintTransferService';
import { readLightningReceiptSnapshot } from '~/services/wallet/lightningReceiptContext';
import { useSettingsStore } from '~/state/settingsStore';
import { buildTransferReceiptDetails } from '~/features/history/receiptDetails';
import { ReceiptExtraDetails } from '~/features/history/components/ReceiptExtraDetails';

/** Read the two original local quotes; never create, submit or retry either leg. */
export function TransferTechnicalDetails({ record }: { record: MintTransferRecord }) {
  const wallet = useSettingsStore((state) => state.npub);
  const { data } = useQuery({
    queryKey: [
      'history',
      'transferTechnicalDetails',
      wallet,
      record.id,
      record.state,
      record.stage,
      record.feePaid,
    ],
    enabled: !!wallet && !!record.id,
    networkMode: 'always',
    retry: false,
    queryFn: async () => {
      const [source, destination] = await Promise.all([
        record.meltQuoteId
          ? readLightningReceiptSnapshot(wallet, record.sourceMintUrl, record.meltQuoteId, false)
          : Promise.resolve({}),
        readLightningReceiptSnapshot(wallet, record.targetMintUrl, record.mintQuoteId, true),
      ]);
      return { source, destination };
    },
  });
  return <ReceiptExtraDetails fields={buildTransferReceiptDetails(record, data).extra} />;
}
