import React from 'react';
import { Text, YStack } from 'tamagui';
import { MintPreviewMethods, mintPreviewMethods } from './MintPreviewMethods';
import { MintInfoRow } from './MintInfoRow';
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
      <MintInfoRow label="URL" value={url} copyValue={url} />
      {text(info.version) && <MintInfoRow label="Version" value={text(info.version)!} />}
      <MintInfoRow label="Units" value={units.join(', ') || 'Not provided'} />
      <MintPreviewMethods info={info} />
      <MintNutsRow key={url} nuts={info.nuts} />
      <MintContacts contacts={info.contact} />
      {text(info.pubkey) && (
        <MintInfoRow label="Public key" value={text(info.pubkey)!} copyValue={text(info.pubkey)} />
      )}
      <MintTermsRow url={info.tos_url} />
    </>
  );
}
