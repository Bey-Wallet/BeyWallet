// BUI study measurements. Inter keeps the app's six registered static faces.
// Heading requests at 700 map to the available 600 face.
export const buiTypography = {
  num1: { fontFamily: '$display', fontSize: 32, fontWeight: '500', letterSpacing: 0 },
  num2: { fontFamily: '$display', fontSize: 28, fontWeight: '500', letterSpacing: 0 },
  h1: { fontFamily: '$display', fontSize: 32, fontWeight: '600', letterSpacing: 0 },
  h2: { fontFamily: '$body', fontSize: 24, lineHeight: 32, fontWeight: '600', letterSpacing: 0 },
  h3: { fontFamily: '$body', fontSize: 20, fontWeight: '600', letterSpacing: 0 },
  label1: { fontFamily: '$body', fontSize: 16, fontWeight: '500', letterSpacing: 0.08 },
  label2: { fontFamily: '$body', fontSize: 14, fontWeight: '500', letterSpacing: 0.07 },
  label3: { fontFamily: '$body', fontSize: 12, fontWeight: '500', letterSpacing: 0.12 },
  body1: {
    fontFamily: '$body',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
    letterSpacing: 0.08,
  },
  body2: {
    fontFamily: '$body',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    letterSpacing: 0.07,
  },
  body3: { fontFamily: '$body', fontSize: 12, fontWeight: '400', letterSpacing: 0.12 },
  body4CAPS: { fontFamily: '$body', fontSize: 10, fontWeight: '500', letterSpacing: 0.1 },
  mono: {
    fontFamily: '$body',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
} as const;
export type BUITypeRole = keyof typeof buiTypography;
