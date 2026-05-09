import React from 'react';
import { Image, ImageStyle } from 'react-native';
import { useThemeName } from 'tamagui';

const NOSTR_BLACK = require('~/assets/images/nostr-icon-black-transparent.png');
const NOSTR_WHITE = require('~/assets/images/nostr-icon-white-transparent.png');

interface NostrIconProps {
    size?: number;
    color?: string; // Kept for compatibility with other icons, though we use theme
    style?: ImageStyle;
}

export default function NostrIcon({ size = 24, style }: NostrIconProps) {
    const themeName = useThemeName();
    const source = themeName.startsWith('light') ? NOSTR_BLACK : NOSTR_WHITE;

    return (
        <Image 
            source={source} 
            style={[{ width: size, height: size, resizeMode: 'contain' }, style]} 
        />
    );
}
