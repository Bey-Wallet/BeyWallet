import React, { useRef, useState } from 'react';
import { Text, XStack, YStack } from 'tamagui';
import { Share } from 'react-native';
import { AppButton } from '~/shared/ui/AppButton';
import { ListTable, ListTableRow } from '~/shared/ui/ListTable';
import type { ReceiptField } from '../receiptDetails';
import { BUISheet, type BUISheetRef } from '~/shared/ui/BUI/BUISheet';
import { Copy, Share2 } from '~/shared/icons';
import { copyWithFeedback } from '~/shared/utils/copyWithFeedback';
import { useAppToast } from '~/shared/hooks/useAppToast';
import { interactionCopy } from '~/services/feedback/interactionCopy';
import { appTypography } from '~/shared/theme/appearance';

export function ReceiptExtraDetails({
  fields,
  presentation = 'sheet',
}: {
  fields: ReceiptField[];
  presentation?: 'inline' | 'sheet';
}) {
  const [open, setOpen] = useState(false);
  const sheet = useRef<BUISheetRef>(null);
  const toast = useAppToast();
  const [sharing, setSharing] = useState(false);
  const shareLock = useRef(false);
  if (!fields.length) return null;
  const sections = [...new Set(fields.map((field) => field.section || 'Transaction'))].map(
    (title) => ({
      title,
      fields: fields.filter((field) => (field.section || 'Transaction') === title),
    }),
  );
  const exportText = sections
    .map((section) =>
      [
        section.title,
        ...section.fields.map(
          (field) => `${field.label}: ${field.copyValue || field.fullValue || field.value}`,
        ),
      ].join('\n'),
    )
    .join('\n\n');
  const rows = sections.map((section) => (
    <YStack key={section.title} gap="$2">
      <Text {...appTypography.body2} color="$gray10">
        {section.title}
      </Text>
      <ListTable compact variant="filled">
        {section.fields.map((field) => (
          <ListTableRow
            key={`${section.title}:${field.label}`}
            label={field.label}
            value={field.value}
            multiline
            expandValue
            isCopyable={!!field.copyValue}
            copyValue={field.copyValue}
          />
        ))}
      </ListTable>
    </YStack>
  ));
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
          <XStack gap="$3">
            <AppButton
              haptic
              emphasis="secondary"
              size="medium"
              fullWidth={false}
              flex={1}
              minWidth={0}
              icon={<Copy size={18} />}
              onPress={async () => {
                if (await copyWithFeedback(exportText, toast))
                  toast.showFeedback(interactionCopy.copiedToClipboard);
              }}
            >
              Copy
            </AppButton>
            <AppButton
              haptic
              size="medium"
              fullWidth={false}
              flex={1}
              minWidth={0}
              emphasis="secondary"
              icon={<Share2 size={18} />}
              disabled={sharing}
              onPress={async () => {
                if (shareLock.current) return;
                shareLock.current = true;
                setSharing(true);
                try {
                  await Share.share({ title: 'Payment details', message: exportText });
                } catch {
                  toast.showFeedback(interactionCopy.shareFailed);
                } finally {
                  shareLock.current = false;
                  setSharing(false);
                }
              }}
            >
              Share
            </AppButton>
          </XStack>
        </BUISheet>
      ) : open ? (
        rows
      ) : null}
    </YStack>
  );
}
