import { Spinner } from '~/shared/ui/Spinner';
import { MintImage } from '~/shared/ui/RemoteImage';
import React from 'react';
import { View } from 'tamagui';

import { Landmark } from '@tamagui/lucide-icons';
import { useMintInfo } from '~/shared/hooks/useMintInfo';
import { mintMetadataFromInfo } from '~/features/explore/components/mintMeta';

interface MintIconProps {
  url: string;
  /** Override icon from Nostr rec (before /v1/info loads) */
  hintIcon?: string;
  size?: number;
}

export function MintIcon({ url, hintIcon, size = 44 }: MintIconProps) {
  const { data: info, isLoading } = useMintInfo(url);
  return (
    <MintIconImage url={url} hintIcon={hintIcon} size={size} info={info} loading={isLoading} />
  );
}

/** A row can reuse its metadata query rather than mounting a second observer for its icon. */
export function MintIconImage({
  url,
  hintIcon,
  size = 44,
  info,
  loading = false,
}: MintIconProps & {
  info?: Record<string, any>;
  loading?: boolean;
}) {
  const meta = mintMetadataFromInfo(info, url);

  const primaryIcon = (info ? meta.icon : undefined) || hintIcon || '';
  const showLoading = loading && !primaryIcon && !hintIcon;

  const radius = size * 0.2; // proportional border radius

  return (
    <View
      width={size}
      height={size}
      rounded="$4"
      bg="$gray3"
      items="center"
      justify="center"
      overflow="hidden"
      shrink={0}
    >
      {showLoading ? (
        <Spinner size="small" color="$gray10" />
      ) : (
        <MintImage
          mintUrl={url}
          src={primaryIcon || undefined}
          width={size}
          height={size}
          style={{ borderRadius: radius }}
          fallback={<Landmark size={size * 0.5} color="$gray10" />}
        />
      )}
    </View>
  );
}
