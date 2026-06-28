import { createAnimations } from "@tamagui/animations-react-native";
import { createFont, createTamagui } from "tamagui";
import { defaultConfig } from "@tamagui/config/v5";

const animations = createAnimations({
  bouncy: {
    type: "spring",
    damping: 10,
    mass: 0.9,
    stiffness: 100,
  },
  lazy: {
    type: "timing",
    duration: 300,
  },
  quick: {
    type: "spring",
    damping: 20,
    mass: 1,
    stiffness: 250,
  },
});

const baselGroteskFont = createFont({
  family: "BaselGroteskBook",
  size: {
    1: 11,
    2: 12,
    3: 13,
    4: 14,
    5: 16,
    6: 18,
    7: 20,
    8: 23,
    9: 30,
    10: 46,
    11: 54,
    12: 63,
    13: 72,
    14: 82,
    15: 92,
    16: 124,
  },
  lineHeight: {
    1: 15,
    2: 17,
    3: 19,
    4: 21,
    5: 23,
    6: 25,
    7: 27,
    8: 30,
    9: 37,
    10: 53,
    11: 61,
    12: 70,
    13: 79,
    14: 89,
    15: 99,
    16: 131,
  },
  weight: {
    4: "400",
    5: "500",
    6: "600",
  },
  letterSpacing: {
    4: 0,
    8: 1,
  },
  face: {
    400: { normal: "BaselGroteskBook" },
    500: { normal: "BaselGroteskMedium" },
    600: { normal: "BaselGroteskMedium" },
    bold: { normal: "BaselGroteskMedium" },
  },
});

const monoFont = createFont({
  family: "Mono",
  size: baselGroteskFont.size,
  lineHeight: baselGroteskFont.lineHeight,
  weight: {
    4: "400",
    5: "500",
    6: "600",
  },
  letterSpacing: {
    4: 0,
    8: 1,
  },
  face: {
    400: { normal: "Mono" },
    500: { normal: "Mono" },
    600: { normal: "Mono" },
    bold: { normal: "Mono" },
  },
});

const oswaldFont = createFont({
  family: "Oswald",
  size: baselGroteskFont.size,
  lineHeight: baselGroteskFont.lineHeight,
  weight: {
    4: "400",
    5: "500",
    7: "700",
    bold: "700",
  },
  letterSpacing: {
    4: 0,
    8: 1,
  },
  face: {
    400: { normal: "Oswald" },
    500: { normal: "Oswald" },
    700: { normal: "Oswald" },
    bold: { normal: "Oswald" },
  },
});

const superblueColors = {
  superblue1: "hsl(206, 100%, 97.0%)",
  superblue2: "hsl(207, 98.0%, 90.0%)",
  superblue3: "hsl(207, 95.0%, 78.0%)",
  superblue4: "hsl(208, 98.0%, 62.0%)",
  superblue5: "hsl(208, 100%, 47.3%)",   // Matches blue10 exactly
  superblue6: "hsl(209, 100%, 43.0%)",
  superblue7: "hsl(210, 100%, 39.0%)",
  superblue8: "hsl(211, 100%, 35.0%)",
  superblue9: "hsl(212, 100%, 31.0%)",
  superblue10: "hsl(213, 100%, 27.0%)",  // Rich royal blue
  superblue11: "hsl(214, 100%, 22.0%)",
  superblue12: "hsl(215, 100%, 15.0%)",
};

export const config = createTamagui({
  ...defaultConfig,
  animations,
  fonts: {
    ...defaultConfig.fonts,
    heading: baselGroteskFont,
    body: baselGroteskFont,
    mono: monoFont,
    oswald: oswaldFont,
  },
  tokens: {
    ...defaultConfig.tokens,
    color: {
      ...defaultConfig.tokens.color,
      ...superblueColors,
    },
  },
  themes: {
    ...defaultConfig.themes,
    light: {
      ...defaultConfig.themes.light,
      background: "#fff",
      ...superblueColors,
    },
    dark: {
      ...defaultConfig.themes.dark,
      background: "#000",
      ...superblueColors,
    },
  },
});

export default config;

export type Conf = typeof config;

declare module "tamagui" {
  interface TamaguiCustomConfig extends Conf { }
}
