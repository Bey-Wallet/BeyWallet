import React from 'react';
import { Copy } from '@tamagui/lucide-icons';
import { copyWithFeedback } from '~/shared/utils/copyWithFeedback';
import { useAppToast } from '~/shared/hooks/useAppToast';
import { interactionCopy } from '~/services/feedback/interactionCopy';
import { MintDetailRow } from './MintUI';
import { hapticService } from '~/services/platform/hapticService';

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
  return (
    <MintDetailRow
      label={label}
      value={value}
      rightContent={copyValue ? <Copy size={20} color="$gray10" aria-hidden /> : undefined}
      accessibilityLabel={copyValue ? `Copy ${label.toLowerCase()}` : undefined}
      onPress={
        copyValue
          ? async () => {
              if (await copyWithFeedback(copyValue, toast)) {
                hapticService.acknowledge();
                toast.showFeedback(interactionCopy.copiedToClipboard);
              }
            }
          : undefined
      }
    />
  );
}
