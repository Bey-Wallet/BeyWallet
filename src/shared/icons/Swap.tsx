import * as React from 'react';
import Svg, { G, Path } from 'react-native-svg';

export type SwapIconProps = {
  size?: number;
  color?: string;
};

const SwapIcon: React.FC<SwapIconProps> = ({ size = 24, color }) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <G fill={color}>
        <Path
          fill={color}
          d="M9 12.5L6.5 15L9 17.5l2.5-2.5zm6-10a6.5 6.5 0 0 0-6.482 6.018a6.5 6.5 0 1 0 6.964 6.964A6.5 6.5 0 0 0 15 2.5m.323 10.989a6.51 6.51 0 0 0-4.812-4.812a4.5 4.5 0 1 1 4.812 4.812M13.5 15a4.5 4.5 0 1 1-9 0a4.5 4.5 0 0 1 9 0M3 7a4 4 0 0 1 4-4h1.5v2H7a2 2 0 0 0-2 2v1.5H3zm16 10v-1.5h2V17a4 4 0 0 1-4 4h-1.5v-2H17a2 2 0 0 0 2-2"
        />
      </G>
    </Svg>
  );
};

export default SwapIcon;
