import * as React from 'react';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from 'tamagui';

export type NfcIconProps = {
  size?: number;
  color?: string;
};

export default function NfcIcon({ size = 24, color = '$color' }: NfcIconProps) {
  const theme = useTheme();
  const resolvedColor = color.startsWith('$') ? theme[color.slice(1)]?.val || color : color;

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M0 0h24v24H0z" fill="none" />
      <Path
        fill={resolvedColor}
        d="M18 6h-5a2 2 0 0 0-2 2v2.28c-.59.34-1 .98-1 1.72a2 2 0 0 0 2 2a2 2 0 0 0 2-2c0-.74-.4-1.38-1-1.72V8h3v8H8V8h2V6H6v12h12m2 2H4V4h16m0-2H4a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V4c0-1.11-.89-2-2-2"
      />
    </Svg>
  );
}
