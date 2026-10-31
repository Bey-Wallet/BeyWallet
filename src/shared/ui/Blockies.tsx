import React, { useMemo } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { styled } from 'tamagui';
import { generateBlockies } from '~/shared/utils/blockies';

interface BlockiesProps {
  seed: string;
  size?: number;
  scale?: number;
  color?: string;
  bgColor?: string;
  spotColor?: string;
  style?: object;
  onPress?: () => void;
}

const BlockiesContainer = styled(View, { name: 'BlockiesContainer' });
const Pixel = styled(View, { name: 'Pixel' });

const Blockies: React.FC<BlockiesProps> = ({
  seed,
  size = 8,
  scale = 4,
  color,
  bgColor,
  spotColor,
  style = {},
  onPress,
}) => {
  const generated = useMemo(
    () => generateBlockies(seed, size, { color, bgColor, spotColor }),
    [seed, size, color, bgColor, spotColor],
  );
  const blockiesContent = (
    <BlockiesContainer
      style={[
        {
          width: size * scale,
          height: size * scale,
          backgroundColor: generated.bgColor,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {generated.pixels.map((pixel, index) =>
        pixel === 0 ? null : (
          <Pixel
            key={index}
            style={{
              backgroundColor: pixel === 1 ? generated.color : generated.spotColor,
              width: scale,
              height: scale,
              position: 'absolute',
              top: Math.floor(index / size) * scale,
              left: (index % size) * scale,
            }}
          />
        ),
      )}
    </BlockiesContainer>
  );

  return onPress ? (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      {blockiesContent}
    </TouchableOpacity>
  ) : (
    blockiesContent
  );
};

export default Blockies;
