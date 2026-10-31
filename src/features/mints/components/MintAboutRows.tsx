import React from 'react';
import { Text, YStack } from 'tamagui';
import { ListTableRow } from '~/shared/ui/ListTable';
import { mintPreviewMethods } from './MintPreviewMethods';
import { MintTermsRow } from './MintTermsRow';
import { MintNutsRow } from './MintNutsRow';
import { MintContacts } from './MintContacts';

const text = (value: unknown) => (typeof value === 'string' ? value : undefined);

export function MintAboutRows({ url, info }: { url: string; info: Record<string, any> }) {
  const description = text(info.description) || text(info.description_long);
  const units = [
    ...new Set([
      ...(Array.isArray(info.units)
        ? info.units.filter((unit: unknown) => typeof unit === 'string')
        : []),
      ...mintPreviewMethods(info).flatMap((method) => (method.unit ? [method.unit] : [])),
    ]),
  ];
  return (
    <>
      {description && (
        <YStack px="$page" py="$rowGap">
          <Text color="$color" fontSize={14}>
            {description}
          </Text>
        </YStack>
      )}
      <ListTableRow label="URL" value={url} isCopyable copyValue={url} />
      <MintTermsRow url={info.tos_url} />
      <MintContacts contacts={info.contact} />
      <ListTableRow label="Technical details" labelColor="$color" />
      {text(info.version) && <ListTableRow label="Version" value={text(info.version)} />}
      <ListTableRow label="Units" value={units.join(', ') || 'Not provided'} />
      {text(info.pubkey) && (
        <ListTableRow label="Public key" value={text(info.pubkey)} isCopyable />
      )}
      <MintNutsRow key={url} nuts={info.nuts} />
    </>
  );
}
