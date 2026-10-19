import React, { useState } from 'react';
import { Input, YStack } from 'tamagui';
import { ChevronDown } from '@tamagui/lucide-icons';
import { ListTableRow } from '~/shared/ui/ListTable';
import { AppButton } from '~/shared/ui/AppButton';

export function PaymentNote({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (text: string) => void;
  disabled?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <YStack>
      <ListTableRow
        label={value ? 'Note' : 'Add note'}
        value={value || undefined}
        disabled={disabled}
        onPress={() => setExpanded(!expanded)}
        rightContent={<ChevronDown size={16} color="$gray10" />}
      />
      {expanded && (
        <YStack p="$3" gap="$2">
          <Input
            accessibilityLabel="Note"
            value={value}
            onChangeText={onChange}
            maxLength={80}
            disabled={disabled}
            placeholder="Add a note (optional)"
          />
          <AppButton
            size="small"
            emphasis="text-only"
            disabled={disabled}
            onPress={() => onChange('')}
          >
            Clear note
          </AppButton>
        </YStack>
      )}
    </YStack>
  );
}
