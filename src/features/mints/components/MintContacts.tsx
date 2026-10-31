import React from 'react';
import { MintInfoRow } from './MintInfoRow';

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
      {rows.map((row, index) => (
        <MintInfoRow key={index} {...row} copyValue={row.value} />
      ))}
    </>
  );
}
