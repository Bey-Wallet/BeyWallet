import * as React from 'react';
import Svg, { G, Path } from 'react-native-svg';

export type ScanIconProps = {
  size?: number;
  color?: string;
};

const ScanIcon: React.FC<ScanIconProps> = ({ size = 24, color }) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <G fill={color}>
        <Path
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={44}
          d="M342 444h46a56 56 0 0 0 56-56v-46m0-172v-46a56 56 0 0 0-56-56h-46M170 444h-46a56 56 0 0 1-56-56v-46m0-172v-46a56 56 0 0 1 56-56h46"
        />
      </G>
    </Svg>
  );
};

export default ScanIcon;
