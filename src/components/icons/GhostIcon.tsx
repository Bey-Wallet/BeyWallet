import { useThemeToggle } from "@/components/Providers/theme-provider";
import React from "react";
import { View } from "tamagui";
import BeyIcon from "./BeyIcon";

interface GhostIconProps {
  size?: number;
  op?: number;
  black?: boolean;
  white?: boolean;
  color?: string;
}

const GhostIcon = ({ size = 120, op = 1, black = false, white = false, color }: GhostIconProps) => {
  const { currentTheme } = useThemeToggle();

  let resolvedColor: string;
  if (color) {
    resolvedColor = color;
  } else if (white) {
    resolvedColor = "white";
  } else if (black) {
    resolvedColor = "black";
  } else {
    resolvedColor = "$color";
  }

  return (
    <View opacity={op} width={size} height={size} items="center" justify="center">
      <BeyIcon size={size} color={resolvedColor} />
    </View>
  );
};

export default GhostIcon;
