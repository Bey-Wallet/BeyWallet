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
    1000: "1000",
    bold: "bold",
  },
  letterSpacing: {
    4: 0,
    8: 1,
  },
  face: {
    400: { normal: "BaselGroteskBook" },
    500: { normal: "BaselGroteskMedium" },
    600: { normal: "BaselGroteskMedium" },
    1000: { normal: "BaselGroteskBold" },
    bold: { normal: "BaselGroteskBold" },
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

const beyblueColors = {
  // 1-12 scale
  beyblue1: "#eaf0ff",
  beyblue2: "#bdd1ff",
  beyblue3: "#9dbaff",
  beyblue4: "#709bff",
  beyblue5: "#5588ff",
  beyblue6: "#2a6aff",
  beyblue7: "#2660e8",
  beyblue8: "#1e4bb5",
  beyblue9: "#173a8c",
  beyblue10: "#122d6b",
  beyblue11: "#0f2354",
  beyblue12: "#0a183b",

  // 50-900 scale
  beyblue50: "#eaf0ff",
  beyblue100: "#bdd1ff",
  beyblue200: "#9dbaff",
  beyblue300: "#709bff",
  beyblue400: "#5588ff",
  beyblue500: "#2a6aff",
  beyblue600: "#2660e8",
  beyblue700: "#1e4bb5",
  beyblue800: "#173a8c",
  beyblue900: "#122d6b",
};

const surfaceColors = {
  // 1-12 scale
  surface1: "#ebebeb",
  surface2: "#c1c1c1",
  surface3: "#a3a3a3",
  surface4: "#7a7a7a",
  surface5: "#606060",
  surface6: "#383838",
  surface7: "#333333",
  surface8: "#282828",
  surface9: "#1f1f1f",
  surface10: "#181818",
  surface11: "#121212",
  surface12: "#0a0a0a",

  // 50-900 scale
  surface50: "#ebebeb",
  surface100: "#c1c1c1",
  surface200: "#a3a3a3",
  surface300: "#7a7a7a",
  surface400: "#606060",
  surface500: "#383838",
  surface600: "#333333",
  surface700: "#282828",
  surface800: "#1f1f1f",
  surface900: "#181818",
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
      ...beyblueColors,
      ...surfaceColors,
    },
  },
  themes: {
    ...defaultConfig.themes,
    light: {
      ...defaultConfig.themes.light,
      background: "#fff",
      ...superblueColors,
      ...beyblueColors,
      ...surfaceColors,
    },
    dark: {
      ...defaultConfig.themes.dark,
      background: "#000",
      ...superblueColors,
      ...beyblueColors,
      ...surfaceColors,
    },
  },
});

export default config;

export type Conf = typeof config;

declare module "tamagui" {
  interface TamaguiCustomConfig extends Conf { }
}
