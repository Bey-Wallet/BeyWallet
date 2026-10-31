import React from 'react';
import { Text, XStack, YStack } from 'tamagui';
import { Copy } from '@tamagui/lucide-icons';
import { AppPressable } from '~/shared/ui/AppPressable';
import { copyWithFeedback } from '~/shared/utils/copyWithFeedback';
import { useAppToast } from '~/shared/hooks/useAppToast';
import { interactionCopy } from '~/services/feedback/interactionCopy';

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
    <XStack px="$page" py={6} minHeight={copyValue ? 48 : 32} gap="$3" items="center">
      <Text color="$gray10" fontSize={14} lineHeight={20} maxWidth="40%">
        {label}
      </Text>
      <Text
        color="$color"
        fontSize={14}
        fontWeight="500"
        lineHeight={20}
        flex={1}
        textAlign="right"
        numberOfLines={copyValue ? 1 : undefined}
        ellipsizeMode="middle"
      >
        {value}
      </Text>
      {copyValue && <Copy size={20} color="$gray10" aria-hidden />}
    </XStack>
  );
  return (
    <YStack>
      <YStack height={2} width="100%" bg="$background" />
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
