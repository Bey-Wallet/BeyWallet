import * as React from 'react';
import Svg, { Defs, G, Line, Mask, Rect } from 'react-native-svg';
import { useTheme } from 'tamagui';

export type BeyIconProps = {
  size?: number;
  color?: string;
  variant?: 'line' | 'fill';
};

const BeyIcon: React.FC<BeyIconProps> = ({ size = 24, color = '$color', variant = 'fill' }) => {
  const theme = useTheme();
  const maskId = `bey-${React.useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  let resolvedColor = color;
  if (color.startsWith('$')) {
    const tokenName = color.slice(1);
    resolvedColor = theme[tokenName]?.val || color;
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 512 512">
      <Defs>
        <Mask id={maskId}>
          {/* White = keep */}
          <Rect width={500} height={467} fill="white" rx={32} />

          {/* Black = remove */}
          <Rect x={135} y={135.5} width={230} height={196} rx={12} fill="black" />

          <Line
            x1={0}
            y1={0}
            x2={500}
            y2={467}
            stroke="black"
            strokeWidth={45}
            strokeLinecap="square"
          />
        </Mask>
      </Defs>

      {variant === 'fill' ? (
        <Rect width={500} height={467} rx={32} fill={resolvedColor} mask={`url(#${maskId})`} />
      ) : (
        <G mask={`url(#${maskId})`} fill="none" stroke={resolvedColor} strokeWidth={72}>
          {/* Clip strokes to the original silhouette so both states share the same geometry. */}
          <Rect width={500} height={467} rx={32} />
          <Rect x={135} y={135.5} width={230} height={196} rx={12} />
          <Line x1={0} y1={0} x2={500} y2={467} strokeWidth={117} strokeLinecap="square" />
        </G>
      )}
    </Svg>
  );
};

export default BeyIcon;
