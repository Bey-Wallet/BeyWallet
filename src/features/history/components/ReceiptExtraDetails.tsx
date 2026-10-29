import React, { useState } from 'react';
import { YStack } from 'tamagui';
import { ChevronDown, ChevronUp } from '@tamagui/lucide-icons';
import { ListTable, ListTableRow } from '~/shared/ui/ListTable';
import type { ReceiptField } from '../receiptDetails';

export function ReceiptExtraDetails({ fields }: { fields: ReceiptField[] }) {
  const [open, setOpen] = useState(false);
  if (!fields.length) return null;
  return (
    <YStack gap="$2">
      <ListTable variant="outlined">
        <ListTableRow
          label={open ? 'Hide details' : 'Show details'}
          onPress={() => setOpen(!open)}
          expanded={open}
          rightContent={
            open ? (
              <ChevronUp size={20} color="$gray10" />
            ) : (
              <ChevronDown size={20} color="$gray10" />
            )
          }
        />
      </ListTable>
      {open && (
        <ListTable variant="outlined">
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
