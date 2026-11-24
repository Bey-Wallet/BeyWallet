import React, { useRef, useState, useContext, useEffect } from 'react';
import { TechnicalDetailsMenuContext } from '~/shared/ui/TechnicalDetailsMenuContext';
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

export function ReceiptExtraDetails({ fields }: { fields: ReceiptField[] }) {
  const menu = useContext(TechnicalDetailsMenuContext);
  const sheet = useRef<BUISheetRef>(null);
  const toast = useAppToast();
  const [sharing, setSharing] = useState(false);
  const shareLock = useRef(false);
  const hasFields = fields.length > 0;
  useEffect(() => {
    if (menu?.open && hasFields) sheet.current?.present();
  }, [menu?.open, hasFields]);
  if (!hasFields) return null;
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
      <BUISheet
        ref={sheet}
        title="Technical details"
        navigation="back"
        onBack={() => sheet.current?.dismiss()}
        onClose={() => menu?.close()}
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
    </YStack>
  );
}
