import React, { useState } from 'react';
import { Text, XStack, YStack } from 'tamagui';
import { ChevronDown } from '@tamagui/lucide-icons';
import { ListTableRow } from '~/shared/ui/ListTable';
import { AppButton } from '~/shared/ui/AppButton';
import { RECLAIM_PRESETS } from '~/services/wallet/reclaimPolicy';

export function ReclaimSelector({
  hours,
  onChange,
  disabled,
}: {
  hours: number;
  onChange: (hours: number) => void;
  disabled?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <YStack>
      <ListTableRow
        label="Reclaim after"
        value={RECLAIM_PRESETS.find((p) => p.hours === hours)?.label || 'Off'}
        disabled={disabled}
        onPress={() => setExpanded(!expanded)}
        rightContent={<ChevronDown size={16} color="$gray10" />}
      />
      {expanded && (
        <YStack p="$3" gap="$3">
          <Text color="$gray10">After this time, you can reclaim unclaimed funds.</Text>
          <XStack flexWrap="wrap" gap="$2">
            {RECLAIM_PRESETS.map((p) => (
              <AppButton
                key={p.hours}
                size="small"
                emphasis={p.hours === hours ? 'primary' : 'secondary'}
                disabled={disabled}
                onPress={() => onChange(p.hours)}
              >
                {p.label}
              </AppButton>
            ))}
          </XStack>
        </YStack>
      )}
    </YStack>
  );
}
