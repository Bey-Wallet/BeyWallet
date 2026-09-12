import * as React from 'react';
import Svg, { G, Path } from 'react-native-svg';

export type LockIconProps = {
  size?: number;
  color?: string;
};

const LockIcon: React.FC<LockIconProps> = ({ size = 24, color }) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <G fill={color}>
        <Path
          fill={color}
          fillRule="evenodd"
          d="M5.25 10.055V8a6.75 6.75 0 0 1 13.5 0v2.055c1.115.083 1.84.293 2.371.824C22 11.757 22 13.172 22 16s0 4.243-.879 5.121C20.243 22 18.828 22 16 22H8c-2.828 0-4.243 0-5.121-.879C2 20.243 2 18.828 2 16s0-4.243.879-5.121c.53-.531 1.256-.741 2.371-.824M6.75 8a5.25 5.25 0 0 1 10.5 0v2.004Q16.676 9.999 16 10H8q-.677-.001-1.25.004z"
          clipRule="evenodd"
        />
      </G>
    </Svg>
  );
};

export default LockIcon;
