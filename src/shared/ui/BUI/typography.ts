// BUI study measurements. TikTok Sans uses the app's three registered static faces.
// Heading requests at 700 map to the available 600 face.
import { appTypography } from '~/shared/theme/appearance';
export const buiTypography = {
  num1: {
    fontFamily: '$display',
    fontSize: 32,
    fontWeight: '500',
    letterSpacing: appTypography.amount.letterSpacing,
  },
  num2: {
    fontFamily: '$display',
    fontSize: 28,
    fontWeight: '500',
    letterSpacing: appTypography.amountSmall.letterSpacing,
  },
  h1: {
    fontFamily: '$display',
    fontSize: 32,
    fontWeight: '600',
    letterSpacing: appTypography.title1.letterSpacing,
  },
  h2: {
    fontFamily: '$body',
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '600',
    letterSpacing: appTypography.title2.letterSpacing,
  },
  h3: {
    fontFamily: '$body',
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: appTypography.title3.letterSpacing,
  },
  label1: {
    fontFamily: '$body',
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: appTypography.label1.letterSpacing,
  },
  label2: {
    fontFamily: '$body',
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: appTypography.label2.letterSpacing,
  },
  label3: {
    fontFamily: '$body',
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: appTypography.label3.letterSpacing,
  },
  body1: {
    fontFamily: '$body',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
    letterSpacing: appTypography.body1.letterSpacing,
  },
  body2: {
    fontFamily: '$body',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    letterSpacing: appTypography.body2.letterSpacing,
  },
  body3: {
    fontFamily: '$body',
    fontSize: 12,
    fontWeight: '400',
    letterSpacing: appTypography.body3.letterSpacing,
  },
  body4CAPS: {
    fontFamily: '$body',
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: appTypography.caption.letterSpacing,
  },
  mono: {
    fontFamily: '$body',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
} as const;
export type BUITypeRole = keyof typeof buiTypography;
