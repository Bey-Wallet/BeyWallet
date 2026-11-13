import React from 'react';
import Svg, { G, Path } from 'react-native-svg';

export interface FilledActionIconProps {
  size?: number;
  color?: string;
}

export function EcashActionIcon({ size = 22, color = '#000000' }: FilledActionIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill={color}
        fillRule="evenodd"
        d="M4 5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H4Zm8 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM5 9v6h2V9H5Zm12 0v6h2V9h-2Z"
      />
    </Svg>
  );
}

export function LightningActionIcon({ size = 22, color = '#000000' }: FilledActionIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill={color} d="M13.5 1 3 14h8l-1 9L21 9h-8l.5-8Z" />
    </Svg>
  );
}

export function BitcoinActionIcon({ size = 22, color = '#000000' }: FilledActionIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <G rotation={12} origin="12, 12" fill={color}>
        <Path d="M10 2h2v3h-2V2Zm4 0h2v3h-2V2ZM10 19h2v3h-2v-3Zm4 0h2v3h-2v-3Z" />
        <Path
          fillRule="evenodd"
          d="M6 4h8c3.4 0 5 1.8 5 4.3 0 1.5-.7 2.7-2 3.3 1.8.6 2.8 1.9 2.8 3.7 0 3-2.3 4.7-6.1 4.7H6v-3h2V7H6V4Zm5 3v4h2.6c1.7 0 2.4-.8 2.4-2s-.7-2-2.4-2H11Zm0 7v3h3c1.8 0 2.8-.5 2.8-1.5S15.8 14 14 14h-3Z"
        />
      </G>
    </Svg>
  );
}

export function StoreActionIcon({ size = 22, color = '#000000' }: FilledActionIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill={color}
        d="M5 3h14l3 5v1a3 3 0 0 1-5 2.2 3 3 0 0 1-5 0 3 3 0 0 1-5 0A3 3 0 0 1 2 9V8l3-5Z"
      />
      <Path fill={color} fillRule="evenodd" d="M4 13h16v8H4v-8Zm5 2v6h6v-6H9Z" />
    </Svg>
  );
}

export function AddressActionIcon({ size = 22, color = '#000000' }: FilledActionIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill={color}
        fillRule="evenodd"
        d="M12 2a10 10 0 1 0 0 20h5v-2h-5a8 8 0 1 1 8-8v1.5a1.5 1.5 0 0 1-3 0V7h-2v1a5 5 0 1 0 .4 7.5A3.5 3.5 0 0 0 22 13.5V12A10 10 0 0 0 12 2Zm0 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"
      />
    </Svg>
  );
}
