import * as React from 'react';
import Svg, { G, Path } from 'react-native-svg';

export type HistoryIconProps = {
  size?: number;
  color?: string;
};

const HistoryIcon: React.FC<HistoryIconProps> = ({ size = 24, color }) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <G fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}>
        <Path d="M19 10.5V10c0-3.771 0-5.657-1.172-6.828S14.771 2 11 2S5.343 2 4.172 3.172S3 6.229 3 10v4.5c0 3.287 0 4.931.908 6.038q.25.304.554.554C5.57 22 7.212 22 10.5 22M7 7h8m-8 4h4" />
        <Path d="m18 18.5l-1.5-.55V15.5m-4.5 2a4.5 4.5 0 1 0 9 0a4.5 4.5 0 0 0-9 0" />
      </G>
    </Svg>
  );
};

export default HistoryIcon;
