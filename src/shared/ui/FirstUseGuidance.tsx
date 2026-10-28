import React from 'react';
import { Text, XStack, YStack } from 'tamagui';
import { X } from '@tamagui/lucide-icons';
import { useGuidanceStore, type GuidanceTopic } from '~/state/guidanceStore';
import { appTypography } from '~/shared/theme/appearance';
import { AppIconButton } from './AppIconButton';

const explanations: Record<GuidanceTopic, { title: string; description: string }> = {
  recovery: {
    title: 'Before you recover',
    description:
      'Keep your recovery phrase private and reconnect the mints you used. Recovery checks supported ecash at those mints and may not recover every token. Keep a wallet backup too.',
  },
  offlineTokens: {
    title: 'Offline ecash works like cash',
    description:
      'Share an unlocked token only once: anyone with a copy can spend it. The recipient needs to go online to verify and claim it. Delivery alone does not confirm payment.',
  },
  mintTrust: {
    title: 'Choose mints you trust',
    description:
      'A mint holds the bitcoin backing its ecash. A listing or a healthy status is not a guarantee. Check the operator before adding funds; connecting a mint does not transfer money.',
  },
};

export function FirstUseGuidance({
  topic,
  spaceBelow = false,
}: {
  topic: GuidanceTopic;
  spaceBelow?: boolean;
}) {
  const dismissed = useGuidanceStore((state) => state.dismissed.includes(topic));
  const dismiss = useGuidanceStore((state) => state.dismiss);
  if (dismissed) return null;
  const { title, description } = explanations[topic];
  return (
    <YStack
      rounded="$6"
      bg="$buttonDefaultSecondary"
      p="$3"
      gap="$1"
      mb={spaceBelow ? '$3' : undefined}
    >
      <XStack items="center" gap="$2">
        <Text fontFamily="$body" {...appTypography.label2} color="$color" flex={1}>
          {title}
        </Text>
        <AppIconButton
          variant="default"
          emphasis="ghost"
          size="xsmall"
          shape="circular"
          icon={<X size={22} color="$gray10" />}
          accessibilityLabel={`Dismiss ${title.toLowerCase()} guidance`}
          onPress={() => dismiss(topic)}
        />
      </XStack>
      <Text fontFamily="$body" {...appTypography.body3} color="$gray10">
        {description}
      </Text>
    </YStack>
  );
}
