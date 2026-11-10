import React, { forwardRef } from 'react';
import { Text, YStack } from 'tamagui';
import { BUISheet, type BUISheetRef } from '~/shared/ui/BUI/BUISheet';
import { appTypography } from '~/shared/theme/appearance';
import { infoSheetContent, type InfoTopic } from './infoSheetContent';

export const InfoSheet = forwardRef<
  BUISheetRef,
  {
    topic: InfoTopic;
    busy?: boolean;
    onClose?: () => void;
  }
>(function InfoSheet({ topic, busy = false, onClose }, ref) {
  const content = infoSheetContent[topic];
  return (
    <BUISheet
      ref={ref}
      title={content.title}
      headerVariant="modal"
      canDismiss={!busy}
      onClose={onClose}
    >
      <YStack gap="$3">
        {content.paragraphs.map((paragraph) => (
          <Text key={paragraph} {...appTypography.body2} color="$gray10">
            {paragraph}
          </Text>
        ))}
      </YStack>
    </BUISheet>
  );
});
