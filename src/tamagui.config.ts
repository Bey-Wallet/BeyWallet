import { createAnimations } from '@tamagui/animations-react-native'
import { createFont, createTamagui } from 'tamagui'
import { defaultConfig } from '@tamagui/config/v5'

const animations = createAnimations({
  bouncy: {
    type: 'spring',
    damping: 10,
    mass: 0.9,
    stiffness: 100,
  },
  lazy: {
    type: 'timing',
    duration: 300,
  },
  quick: {
    type: 'spring',
    damping: 20,
    mass: 1,
    stiffness: 250,
  },
})

const baselGroteskFont = createFont({
  family: 'BaselGroteskBook',
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
    4: '400',
    5: '500',
    6: '600',
  },
  letterSpacing: {
    4: 0,
    8: 1,
  },
  face: {
    400: { normal: 'BaselGroteskBook' },
    500: { normal: 'BaselGroteskMedium' },
    600: { normal: 'BaselGroteskMedium' },
    bold: { normal: 'BaselGroteskMedium' },
  },
})

export const config = createTamagui({
  ...defaultConfig,
  animations,
  fonts: {
    ...defaultConfig.fonts,
    heading: baselGroteskFont,
    body: baselGroteskFont,
  },
  themes: {
    ...defaultConfig.themes,
    light: {
      ...defaultConfig.themes.light,
      background: '#fff',
    },
    dark: {
      ...defaultConfig.themes.dark,
      background: '#000',
    },
  },
})

export default config

export type Conf = typeof config

declare module 'tamagui' {
  interface TamaguiCustomConfig extends Conf { }
}
