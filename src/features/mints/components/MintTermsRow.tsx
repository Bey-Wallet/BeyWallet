import { MintDetailRow } from './MintUI';
import { interactionCopy } from '~/services/feedback/interactionCopy';
import React from 'react';
import { Linking } from 'react-native';
import { ExternalLink } from '@tamagui/lucide-icons';
import { useAppToast } from '~/shared/hooks/useAppToast';

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
    <MintDetailRow
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
