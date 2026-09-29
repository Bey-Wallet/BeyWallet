import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface Nip05VerifiedBadgeProps {
  size?: number;
  color?: string;
}

export default function Nip05VerifiedBadge({
  size = 18,
  color = '#0a99d6',
}: Nip05VerifiedBadgeProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" accessibilityLabel="Verified NIP-05">
      <Path d="M0 0h16v16H0z" fill="none" />
      <Path
        fill={color}
        fillRule="evenodd"
        d="M15 8c0 .982-.472 1.854-1.202 2.402a3 3 0 0 1-.848 2.547 3 3 0 0 1-2.548.849A3 3 0 0 1 8 15a3 3 0 0 1-2.402-1.202 3 3 0 0 1-2.547-.848 3 3 0 0 1-.849-2.548A3 3 0 0 1 1 8c0-.982.472-1.854 1.202-2.402a3 3 0 0 1 .848-2.547 3 3 0 0 1 2.548-.849A3 3 0 0 1 8 1c.982 0 1.854.472 2.402 1.202a3 3 0 0 1 2.547.848c.695.695.978 1.645.849 2.548A3 3 0 0 1 15 8m-3.291-2.843a.75.75 0 0 1 .135 1.052l-4.25 5.5a.75.75 0 0 1-1.151.043l-2.25-2.5a.75.75 0 1 1 1.114-1.004l1.65 1.832 3.7-4.789a.75.75 0 0 1 1.052-.134"
        clipRule="evenodd"
      />
    </Svg>
  );
}
