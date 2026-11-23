import React from 'react';
import { usePaymentTechnicalDetails } from './usePaymentTechnicalDetails';
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
  time,
  feeSats,
  extraDetailsPresentation = 'sheet',
}: {
  mintUrl?: string;
  quoteId?: string;
  invoice?: string;
  recipient?: string | null;
  incoming: boolean;
  state: string;
  amount: number;
  time?: number;
  feeSats?: number;
  extraDetailsPresentation?: 'inline' | 'sheet';
}) {
  const detail = usePaymentTechnicalDetails(
    {
      id: '',
      type: incoming ? 'mint' : 'melt',
      state,
      amount,
      unit: 'sat',
      mintUrl: mintUrl || '',
      createdAt: time || 0,
      quoteId,
      paymentRequest: invoice,
      metadata: feeSats != null ? { fee: feeSats } : undefined,
    },
    { recipient: recipient || undefined },
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
    extraDetails: (
      <ReceiptExtraDetails fields={detail.extra} presentation={extraDetailsPresentation} />
    ),
  };
}
