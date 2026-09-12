import * as React from 'react';
import Svg, { G, Path } from 'react-native-svg';

export type ArrowDownIconProps = {
  size?: number;
  color?: string;
};

const ArrowDownIcon: React.FC<ArrowDownIconProps> = ({ size = 24, color }) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <G fill={color}>
        <Path
          fill={color}
          fillRule="evenodd"
          d="M12 21a9 9 0 1 0 0-18a9 9 0 0 0 0 18m.707-5.293l3-3a1 1 0 0 0-1.414-1.414L13 12.586V9a1 1 0 1 0-2 0v3.586l-1.293-1.293a1 1 0 0 0-1.414 1.414l3 3a1 1 0 0 0 1.414 0"
          clipRule="evenodd"
        />
      </G>
    </Svg>
  );
};

export default ArrowDownIcon;
