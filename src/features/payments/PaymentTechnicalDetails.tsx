import React from 'react';
import type { ReceiptEntry, ReceiptSnapshot } from '~/features/history/receiptDetails';
import { ReceiptExtraDetails } from '~/features/history/components/ReceiptExtraDetails';
import { usePaymentTechnicalDetails } from './usePaymentTechnicalDetails';

export function PaymentTechnicalDetails({
  entry,
  snapshot,
}: {
  entry: ReceiptEntry;
  snapshot?: ReceiptSnapshot;
}) {
  const detail = usePaymentTechnicalDetails(entry, snapshot);
  return <ReceiptExtraDetails fields={detail.extra} />;
}
