import React, { useRef, useState } from 'react';
import { YStack } from 'tamagui';
import { AppButton } from '~/shared/ui/AppButton';
import { ListTable, ListTableRow } from '~/shared/ui/ListTable';
import type { ReceiptField } from '../receiptDetails';
import { BUISheet, type BUISheetRef } from '~/shared/ui/BUI/BUISheet';
import { Copy } from '~/shared/icons';
import { copyWithFeedback } from '~/shared/utils/copyWithFeedback';
import { useAppToast } from '~/shared/hooks/useAppToast';
import { interactionCopy } from '~/services/feedback/interactionCopy';

export function ReceiptExtraDetails({
  fields,
  presentation = 'inline',
}: {
  fields: ReceiptField[];
  presentation?: 'inline' | 'sheet';
}) {
  const [open, setOpen] = useState(false);
  const sheet = useRef<BUISheetRef>(null);
  const toast = useAppToast();
  if (!fields.length) return null;
  const rows = (
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
  );
  return (
    <YStack gap="$2">
      <AppButton
        variant="default"
        emphasis="secondary"
        size="small"
        fullWidth={false}
        self="center"
        onPress={() => {
          if (presentation === 'sheet') {
            setOpen(true);
            sheet.current?.present();
          } else setOpen(!open);
        }}
        accessibilityState={{ expanded: open }}
      >
        {presentation === 'sheet' ? 'Technical details' : open ? 'Hide details' : 'Show details'}
      </AppButton>
      {presentation === 'sheet' ? (
        <BUISheet
          ref={sheet}
          title="Technical details"
          navigation="back"
          onBack={() => sheet.current?.dismiss()}
          onClose={() => setOpen(false)}
        >
          {rows}
          <AppButton
            haptic
            emphasis="primary"
            size="large"
            fullWidth
            icon={<Copy size={22} />}
            onPress={async () => {
              const text = fields
                .map((field) => `${field.label}: ${field.copyValue || field.value}`)
                .join('\n\n');
              if (await copyWithFeedback(text, toast))
                toast.showFeedback(interactionCopy.copiedToClipboard);
            }}
          >
            Copy details
          </AppButton>
        </BUISheet>
      ) : open ? (
        rows
      ) : null}
    </YStack>
  );
}
