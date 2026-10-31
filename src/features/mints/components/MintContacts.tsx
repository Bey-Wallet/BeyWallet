import React from 'react';
import { ListTableRow } from '~/shared/ui/ListTable';

export function MintContacts({ contacts }: { contacts: unknown }) {
  const rows = (Array.isArray(contacts) ? contacts : []).flatMap((contact) => {
    const value = Array.isArray(contact) ? contact[1] : contact?.info;
    const method = Array.isArray(contact) ? contact[0] : contact?.method;
    if (typeof value !== 'string' || !value.trim()) return [];
    const label = typeof method === 'string' && method.trim() ? method.trim() : 'Contact';
    return [{ label: label.charAt(0).toUpperCase() + label.slice(1), value: value.trim() }];
  });
  return (
    <>
      <ListTableRow label="Contact & support" labelColor="$color" />
      {rows.length ? (
        rows.map((row, index) => <ListTableRow key={index} {...row} isCopyable />)
      ) : (
        <ListTableRow label="No contacts listed" />
      )}
    </>
  );
}
