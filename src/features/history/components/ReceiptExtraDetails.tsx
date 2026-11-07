import React, { useState } from 'react';
import { YStack } from 'tamagui';
import { AppButton } from '~/shared/ui/AppButton';
import { ListTable, ListTableRow } from '~/shared/ui/ListTable';
import type { ReceiptField } from '../receiptDetails';

export function ReceiptExtraDetails({ fields }: { fields: ReceiptField[] }) {
  const [open, setOpen] = useState(false);
  if (!fields.length) return null;
  return (
    <YStack gap="$2">
      <AppButton
        variant="default"
        emphasis="secondary"
        size="small"
        fullWidth={false}
        self="center"
        onPress={() => setOpen(!open)}
        accessibilityState={{ expanded: open }}
      >
        {open ? 'Hide details' : 'Show details'}
      </AppButton>
      {open && (
        <ListTable variant="filled">
          {fields.map((field) => (
            <ListTableRow
              key={field.label}
              label={field.label}
              value={field.value}
              multiline
              isCopyable={!!field.copyValue}
              copyValue={field.copyValue}
            />
          ))}
        </ListTable>
      )}
    </YStack>
  );
}
