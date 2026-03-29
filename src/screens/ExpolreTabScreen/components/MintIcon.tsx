import React from 'react';
import { View, Image } from 'tamagui';
import { ActivityIndicator } from 'react-native';
import { Sprout } from '@tamagui/lucide-icons';
import { useQuery } from '@tanstack/react-query';
import { fetchMintMeta, deriveFavicon, type MintMetadata } from './mintMeta';

interface MintIconProps {
    url: string;
    /** Override icon from Nostr rec (before /v1/info loads) */
    hintIcon?: string;
    size?: number;
}

export function MintIcon({ url, hintIcon, size = 44 }: MintIconProps) {
    const { data: meta, isLoading } = useQuery<MintMetadata>({
        queryKey: ['mint-meta', url],
        queryFn: () => fetchMintMeta(url),
        staleTime: 10 * 60 * 1000,
        retry: 1,
    });

    const [imgError, setImgError] = React.useState(false);
    const [faviconError, setFaviconError] = React.useState(false);

    const primaryIcon = meta?.icon || hintIcon || '';
    const favicon = deriveFavicon(url);

    // Reset error states when primaryIcon changes
    React.useEffect(() => {
        setImgError(false);
        setFaviconError(false);
    }, [primaryIcon]);

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
                <ActivityIndicator size="small" color="#888" />
            ) : showPrimary ? (
                <Image
                    source={{ uri: primaryIcon, width: size, height: size }}
                    style={{ width: size, height: size, borderRadius: radius }}
                    onError={() => setImgError(true)}
                />
            ) : showFavicon ? (
                <Image
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
