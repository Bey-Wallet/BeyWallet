import type { TextStyle } from 'react-native';

/** Exact UIKitTypography.kt metrics. Missing line heights retain native font metrics. */
const headingFeatures: NonNullable<TextStyle['fontVariant']> = [
  'stylistic-nine',
  'stylistic-seventeen',
  'stylistic-eighteen',
];
const textFeatures: NonNullable<TextStyle['fontVariant']> = ['stylistic-seven', ...headingFeatures];

function style(
  size: number,
  weight: '400' | '500' | '700',
  text = false,
  lineHeight?: number,
  tracking?: number,
) {
  return {
    fontSize: size,
    fontWeight: weight,
    fontVariant: text ? textFeatures : headingFeatures,
    ...(lineHeight === undefined ? {} : { lineHeight }),
    ...(tracking === undefined ? {} : { letterSpacing: size * tracking }),
  } satisfies TextStyle;
}

export const beyTypography = {
  num1: style(32, '500'),
  num2: style(28, '500'),
  h1: style(32, '700'),
  h2: style(24, '700', false, 32),
  h3: style(20, '700'),
  label1: style(16, '500', true, undefined, 0.005),
  label2: style(14, '500', true, undefined, 0.005),
  label3: style(12, '500', true, undefined, 0.01),
  body1: style(16, '400', true, 24, 0.005),
  body2: style(14, '400', true, 20, 0.005),
  body3: style(12, '400', true, undefined, 0.01),
  body4CAPS: style(10, '500', true, undefined, 0.01),
  mono: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 24,
    letterSpacing: 0.5,
    fontVariant: [],
  } satisfies TextStyle,
} as const;
export type BeyTextVariant = keyof typeof beyTypography;

const stylisticSets = [
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
  'twenty',
];

/** RN Web joins fontVariant names verbatim; stylistic sets need CSS feature tags instead. */
type BeyTypographyProps = {
  fontSize: number;
  fontWeight: '400' | '500' | '700';
  lineHeight?: number;
  letterSpacing?: number;
  fontFamily: '$beyBody' | '$beyMono';
  fontVariant: NonNullable<TextStyle['fontVariant']>;
  style?: { fontFamily: string; fontFeatureSettings: string; fontSynthesis: 'none' };
};

export function getBeyTypographyProps(
  variant: BeyTextVariant,
  web: boolean,
  override?: TextStyle['fontVariant'] | 'unset',
): BeyTypographyProps {
  const { fontVariant: defaults, ...metrics } = beyTypography[variant];
  const variants = override === 'unset' ? [] : (override ?? defaults);
  if (!web)
    return {
      ...metrics,
      fontFamily: variant === 'mono' ? ('$beyMono' as const) : ('$beyBody' as const),
      fontVariant: variants,
      style: undefined,
    };
  const featureSettings = variants
    .filter((value) => value.startsWith('stylistic-'))
    .map((value) => {
      const index = stylisticSets.indexOf(value.slice('stylistic-'.length));
      return `'ss${String(index + 1).padStart(2, '0')}' 1`;
    });
  return {
    ...metrics,
    fontFamily: variant === 'mono' ? ('$beyMono' as const) : ('$beyBody' as const),
    fontVariant: variants.filter((value) => !value.startsWith('stylistic-')),
    style: {
      fontFamily:
        variant === 'mono'
          ? 'BeyRobotoMono'
          : metrics.fontWeight === '400'
            ? 'TTFirsNeueNormal'
            : metrics.fontWeight === '500'
              ? 'TTFirsNeueMedium'
              : 'TTFirsNeueDemiBold',
      fontFeatureSettings: featureSettings.join(', ') || 'normal',
      fontSynthesis: 'none' as const,
    },
  };
}
