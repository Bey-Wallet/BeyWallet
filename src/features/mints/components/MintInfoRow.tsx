import React from 'react';
import { YStack } from 'tamagui';
import { BUIPropertyRow } from '~/shared/ui/BUI/BUIPropertyRow';
import { Copy } from '@tamagui/lucide-icons';
import { AppPressable } from '~/shared/ui/AppPressable';
import { copyWithFeedback } from '~/shared/utils/copyWithFeedback';
import { useAppToast } from '~/shared/hooks/useAppToast';
import { interactionCopy } from '~/services/feedback/interactionCopy';
import { MintDivider } from './MintUI';

/** Dense read-only information; copy actions retain a full-size touch target. */
export function MintInfoRow({
  label,
  value,
  copyValue,
}: {
  label: string;
  value: string;
  copyValue?: string;
}) {
  const toast = useAppToast();
  const content = (
    <BUIPropertyRow
      title={label}
      value={value}
      maxValueLines={copyValue ? 1 : 0}
      postfix={copyValue ? <Copy size={20} color="$gray10" aria-hidden /> : undefined}
    />
  );
  return (
    <YStack>
      <MintDivider />
      {copyValue ? (
        <AppPressable
          accessibilityLabel={`Copy ${label.toLowerCase()}`}
          minHeight={48}
          pressStyle={{ opacity: 0.7 }}
          hoverStyle={{ opacity: 0.85 }}
          onPress={async () => {
            if (await copyWithFeedback(copyValue, toast))
              toast.showFeedback(interactionCopy.copiedToClipboard);
          }}
        >
          {content}
        </AppPressable>
      ) : (
        content
      )}
    </YStack>
  );
}
