import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSettingsStore } from '~/state/settingsStore';
import { readLightningReceiptSnapshot } from '~/services/wallet/lightningReceiptContext';
import { buildReceiptDetails } from '~/features/history/receiptDetails';
import { ReceiptExtraDetails } from '~/features/history/components/ReceiptExtraDetails';
import { ListTableRow } from '~/shared/ui/ListTable';

export function useLightningReceipt({
  mintUrl,
  quoteId,
  invoice,
  recipient,
  incoming,
  state,
  amount,
}: {
  mintUrl?: string;
  quoteId?: string;
  invoice?: string;
  recipient?: string | null;
  incoming: boolean;
  state: string;
  amount: number;
}) {
  const wallet = useSettingsStore((settings) => settings.npub);
  const { data } = useQuery({
    queryKey: ['lightningReceipt', wallet, mintUrl, quoteId, state],
    enabled: !!mintUrl && !!quoteId,
    queryFn: () => readLightningReceiptSnapshot(wallet, mintUrl!, quoteId!, incoming),
  });
  const detail = buildReceiptDetails(
    {
      id: '',
      type: incoming ? 'mint' : 'melt',
      state,
      amount,
      unit: 'sat',
      mintUrl: mintUrl || '',
      createdAt: 0,
      quoteId,
      paymentRequest: invoice,
    },
    { ...data, recipient: recipient || data?.recipient },
  );
  return {
    rows: (
      <>
        <ListTableRow label="Method" value="Lightning" />
        {detail.recipient && <ListTableRow label="Recipient" value={detail.recipient} />}
        {detail.description && (
          <ListTableRow label="Description" value={detail.description} multiline />
        )}
      </>
    ),
    extraDetails: <ReceiptExtraDetails fields={detail.extra} />,
  };
}
