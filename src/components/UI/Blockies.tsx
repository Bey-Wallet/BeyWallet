import React, { useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { styled } from 'tamagui';

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

// Create a styled View for the blockies container
const BlockiesContainer = styled(View, {
  name: 'BlockiesContainer',
});

// Create a styled View for individual pixels
const Pixel = styled(View, {
  name: 'Pixel',
});

// Simple hash function to generate deterministic values
const hashCode = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
};

// Generate HSL color based on hash
const hueFromHash = (hash: number) => {
  return hash % 360;
};

const satFromHash = (hash: number) => {
  return 70 + (hash % 30); // 70-100%
};

const lightFromHash = (hash: number) => {
  return 40 + (hash % 30); // 40-70%
};

// Generate deterministic colors from seed
const generateColors = (seed: string) => {
  const seedHash = hashCode(seed);
  const hue1 = hueFromHash(seedHash);
  const hue2 = hueFromHash(seedHash >> 16);
  const hue3 = hueFromHash(seedHash >> 8);

  return {
    color: `hsl(${hue1}, ${satFromHash(seedHash)}%, ${lightFromHash(seedHash)}%)`,
    bgColor: `hsl(${hue2}, 30%, 90%)`,
    spotColor: `hsl(${hue3}, ${satFromHash(seedHash >> 4)}%, ${lightFromHash(seedHash >> 4)}%)`,
  };
};

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
  // Generate colors if not provided
  const generatedColors = useMemo(() => {
    if (color && bgColor && spotColor) {
      return { color, bgColor, spotColor };
    }
    return generateColors(seed);
  }, [seed, color, bgColor, spotColor]);

  // Generate the blockies pattern
  const pattern = useMemo(() => {
    // Generate a pattern based on the seed
    const seedHash = hashCode(seed);
    const pattern: number[] = [];

    // Create a deterministic pattern
    for (let i = 0; i < size * size; i++) {
      // Use different bits of the hash for different pixels
      const bit = (seedHash >> (i % 32)) & 1;
      pattern.push(bit);
    }

    return pattern;
  }, [seed, size]);

  // Calculate dimensions
  const width = size * scale;
  const height = size * scale;

  // Render the blockies
  const blockiesContent = (
    <BlockiesContainer
      style={[
        {
          width,
          height,
          backgroundColor: generatedColors.bgColor,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {pattern.map((pixel, index) => {
        const row = Math.floor(index / size);
        const col = index % size;

        // Only render the left half + middle column for symmetry
        if (col > Math.floor(size / 2)) return null;

        const pixelColor = pixel ? generatedColors.color : generatedColors.spotColor;

        return (
          <Pixel
            key={index}
            style={[
              styles.pixel,
              {
                backgroundColor: pixelColor,
                width: scale,
                height: scale,
                position: 'absolute',
                top: row * scale,
                left: col * scale,
              },
            ]}
          />
        );
      })}
      {/* Mirror the left half to the right */}
      {pattern.map((pixel, index) => {
        const row = Math.floor(index / size);
        const col = index % size;

        // Only render the mirrored right half
        if (col >= Math.floor(size / 2)) return null;

        const mirroredCol = size - 1 - col;
        const pixelColor = pixel ? generatedColors.color : generatedColors.spotColor;

        return (
          <Pixel
            key={`mirror-${index}`}
            style={[
              styles.pixel,
              {
                backgroundColor: pixelColor,
                width: scale,
                height: scale,
                position: 'absolute',
                top: row * scale,
                left: mirroredCol * scale,
              },
            ]}
          />
        );
      })}
    </BlockiesContainer>
  );

  // If onPress is provided, wrap in TouchableOpacity
  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {blockiesContent}
      </TouchableOpacity>
    );
  }

  return blockiesContent;
};

const styles = StyleSheet.create({
  pixel: {
    position: 'absolute',
  },
});

export default Blockies;
