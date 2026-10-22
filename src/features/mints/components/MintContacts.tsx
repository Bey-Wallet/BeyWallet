import React from 'react';
import { Text, YStack } from 'tamagui';
import { ListTable, ListTableRow } from '~/shared/ui/ListTable';

export function MintContacts({ contacts }: { contacts: unknown }) {
  const rows = (Array.isArray(contacts) ? contacts : []).flatMap((contact) => {
    const value = Array.isArray(contact) ? contact[1] : contact?.info;
    const method = Array.isArray(contact) ? contact[0] : contact?.method;
    if (typeof value !== 'string' || !value.trim()) return [];
    const label = typeof method === 'string' && method.trim() ? method.trim() : 'Contact';
    return [{ label: label.charAt(0).toUpperCase() + label.slice(1), value: value.trim() }];
  });
  return (
    <YStack gap="$3">
      <Text color="$gray10" fontSize="$4" fontWeight="600">
        Contact & support
      </Text>
      <ListTable compact>
        {rows.length ? (
          rows.map((row, index) => <ListTableRow key={index} {...row} isCopyable />)
        ) : (
          <ListTableRow label="No contacts listed" />
        )}
      </ListTable>
    </YStack>
  );
}
