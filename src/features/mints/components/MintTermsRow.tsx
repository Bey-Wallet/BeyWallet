import { interactionCopy } from '~/services/feedback/interactionCopy';
import React from 'react';
import { Linking } from 'react-native';
import { ExternalLink } from '@tamagui/lucide-icons';
import { useAppToast } from '~/shared/hooks/useAppToast';
import { ListTableRow } from '~/shared/ui/ListTable';

export function MintTermsRow({ url }: { url: unknown }) {
  const toast = useAppToast();
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
      value="Read"
      valueColor="$accentColor"
      rightContent={<ExternalLink size={18} color="$accentColor" />}
      onPress={async () => {
        try {
          await Linking.openURL(target.href);
        } catch {
          toast.showFeedback(interactionCopy.couldNotOpenTermsOfService);
        }
      }}
    />
  );
}
