import { Spinner } from '~/shared/ui/Spinner';
import { RemoteImage } from '~/shared/ui/RemoteImage';
import React from 'react';
import { View } from 'tamagui';

import { Sprout } from '@tamagui/lucide-icons';
import { useMintInfo } from '~/shared/hooks/useMintInfo';
import { mintMetadataFromInfo, deriveFavicon } from '~/features/explore/components/mintMeta';

interface MintIconProps {
  url: string;
  /** Override icon from Nostr rec (before /v1/info loads) */
  hintIcon?: string;
  size?: number;
}

export function MintIcon({ url, hintIcon, size = 44 }: MintIconProps) {
  const { data: info, isLoading } = useMintInfo(url);
  const meta = mintMetadataFromInfo(info, url);

  const [imgError, setImgError] = React.useState(false);
  const [faviconError, setFaviconError] = React.useState(false);

  const primaryIcon = (info ? meta.icon : undefined) || hintIcon || '';
  const favicon = deriveFavicon(url);

  // Reset error states when primaryIcon changes
  React.useEffect(() => {
    setImgError(false);
    setFaviconError(false);
  }, [url, primaryIcon]);

  const showLoading = isLoading && !primaryIcon && !hintIcon;
  const showPrimary = !!primaryIcon && !imgError;
  const showFavicon = !showPrimary && !!favicon && !faviconError;

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
        <Spinner size="small" color="#888" />
      ) : showPrimary ? (
        <RemoteImage
          source={{ uri: primaryIcon, width: size, height: size }}
          style={{ width: size, height: size, borderRadius: radius }}
          onError={() => setImgError(true)}
        />
      ) : showFavicon ? (
        <RemoteImage
          source={{ uri: favicon, width: size, height: size }}
          style={{ width: size, height: size, borderRadius: radius }}
          onError={() => setFaviconError(true)}
        />
      ) : (
        <Sprout size={size * 0.5} color="$gray10" />
      )}
    </View>
  );
}
