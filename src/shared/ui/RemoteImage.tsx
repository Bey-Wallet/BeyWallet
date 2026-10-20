import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { View, type ImageProps } from 'tamagui';
import { Sprout } from '@tamagui/lucide-icons';
import { deriveFavicon } from '~/shared/utils/mintIcon';

type Props = Omit<ImageProps, 'source' | 'src' | 'onError'> & {
  source?: { uri?: string; width?: number; height?: number };
  src?: string;
  identity?: string;
  fallbackUri?: string;
  fallback?: React.ReactNode;
  onError?: () => void;
};

export function RemoteImage(props: Props) {
  // A different identity gets a fresh native view and fresh fallback state.
  return (
    <RemoteImageContent
      key={`${props.identity ?? ''}:${props.src ?? props.source?.uri}:${props.fallbackUri}`}
      {...props}
    />
  );
}

export function MintImage({ mintUrl, fallback, ...props }: Props & { mintUrl?: string }) {
  return (
    <RemoteImage
      {...props}
      identity={mintUrl}
      fallbackUri={mintUrl ? deriveFavicon(mintUrl) : undefined}
      fallback={
        <View flex={1} items="center" justify="center" bg="$gray3">
          {fallback ?? <Sprout size={18} color="$gray10" />}
        </View>
      }
    />
  );
}

function RemoteImageContent({
  source,
  src,
  fallbackUri,
  fallback,
  onError,
  identity,
  resizeMode = 'cover',
  alt,
  width,
  height,
  ...layout
}: Props) {
  const [failed, setFailed] = useState(false);
  const [fallbackFailed, setFallbackFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const primary = src ?? source?.uri;
  const uri = primary && !failed ? primary : !fallbackFailed ? fallbackUri : undefined;
  return (
    <View
      {...layout}
      width={width ?? source?.width}
      height={height ?? source?.height}
      overflow="hidden"
      accessibilityLabel={alt}
    >
      {!loaded && fallback}
      {uri && (
        <Image
          key={uri}
          source={{ uri }}
          cachePolicy="memory-disk"
          recyclingKey={`${identity ?? ''}:${uri}`}
          style={StyleSheet.absoluteFill}
          contentFit={
            resizeMode === 'repeat'
              ? 'cover'
              : resizeMode === 'stretch'
                ? 'fill'
                : resizeMode === 'center'
                  ? 'none'
                  : resizeMode
          }
          onLoad={() => setLoaded(true)}
          onError={() => {
            setLoaded(false);
            if (primary && !failed) {
              setFailed(true);
              if (!fallbackUri) onError?.();
            } else {
              setFallbackFailed(true);
              onError?.();
            }
          }}
        />
      )}
    </View>
  );
}
