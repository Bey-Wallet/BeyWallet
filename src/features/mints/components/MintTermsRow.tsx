import React from 'react';
import { Linking } from 'react-native';
import { ExternalLink } from '@tamagui/lucide-icons';
import { useToastController } from '@tamagui/toast';
import { ListTableRow } from '~/shared/ui/ListTable';

export function MintTermsRow({ url }: { url: unknown }) {
  const toast = useToastController();
  let target: URL;
  try {
    if (typeof url !== 'string') return null;
    target = new URL(url.trim());
    if (!['https:', 'http:'].includes(target.protocol) || target.username || target.password)
      return null;
  } catch {
    return null;
  }
  return (
    <ListTableRow
      label="Terms of service"
      value={target.href}
      valueColor="$accentColor"
      rightContent={<ExternalLink size={18} color="$accentColor" />}
      onPress={async () => {
        try {
          await Linking.openURL(target.href);
        } catch {
          toast.show('Could not open terms of service', { kind: 'error' });
        }
      }}
    />
  );
}
