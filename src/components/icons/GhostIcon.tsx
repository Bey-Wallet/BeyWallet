import { useThemeToggle } from "@/components/Providers/theme-provider";
import React from "react";
import { Image } from "tamagui";

interface GhostIconProps {
  size?: number;
  op?: number;
  black?: boolean;
  white?: boolean;
  color?: string; // Ignored for now, but kept for compatibility if passed
}

const GhostIcon = ({ size = 120, op = 1, black = false, white = false }: GhostIconProps) => {
  const { currentTheme } = useThemeToggle();

  let src;
  if (white) {
    src = require("../../../assets/images/bey-logo-white-transparent.png");
  } else if (black) {
    src = require("../../../assets/images/bey-logo-black-transparent.png");
  } else {
    src = currentTheme === "light"
      ? require("../../../assets/images/bey-logo-black-transparent.png")
      : require("../../../assets/images/bey-logo-white-transparent.png");
  }

  return (
    <Image
      source={src}
      opacity={op}
      width={size}
      height={size}
      resizeMode="contain"
    />
  );
};

export default GhostIcon;
