import React, { forwardRef } from 'react';
import type { BUISheetRef } from '~/shared/ui/BUI/BUISheet';
import { InfoSheet } from './InfoSheet';

export const TransferInfoSheet = forwardRef<BUISheetRef, { busy?: boolean }>(
  function TransferInfoSheet({ busy = false }, ref) {
    return <InfoSheet ref={ref} topic="transfer" busy={busy} />;
  },
);
