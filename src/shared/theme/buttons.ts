import { appColors } from './appearance';

const blend = (background: string, foreground: string, amount: number) =>
  `#${[1, 3, 5]
    .map((offset) =>
      Math.round(
        parseInt(background.slice(offset, offset + 2), 16) * (1 - amount) +
          parseInt(foreground.slice(offset, offset + 2), 16) * amount,
      )
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;

function createButtonTheme(dark: boolean) {
  const c = appColors[dark ? 'dark' : 'light'];
  const primary = [c.accent, c.accentHover, c.accentPress];
  const semantic = (background: string, color: string) => [
    background,
    blend(background, color, 0.08),
    blend(background, color, 0.14),
  ];
  const criticalColor = dark ? '#FCA5A5' : '#991B1B';
  const warningColor = dark ? '#FCD34D' : '#92400E';
  const palette = (
    name: string,
    primary: string[],
    primaryText: string,
    secondary: string[],
    secondaryText: string,
    text: string,
  ) => ({
    [`button${name}Primary`]: primary[0],
    [`button${name}PrimaryHover`]: primary[1],
    [`button${name}PrimaryPress`]: primary[2],
    [`button${name}PrimaryText`]: primaryText,
    [`button${name}Secondary`]: secondary[0],
    [`button${name}SecondaryHover`]: secondary[1],
    [`button${name}SecondaryPress`]: secondary[2],
    [`button${name}SecondaryText`]: secondaryText,
    [`button${name}Text`]: text,
  });
  return {
    ...palette(
      'Default',
      primary,
      c.onAccent,
      [c.surface, c.raised, c.pressed],
      c.buttonForeground,
      c.accent,
    ),
    ...palette(
      'Critical',
      ['#B91C1C', '#991B1B', '#7F1D1D'],
      '#FFFFFF',
      semantic(dark ? '#450A0A' : '#FEE2E2', criticalColor),
      criticalColor,
      criticalColor,
    ),
    ...palette(
      'Warning',
      ['#FBBF24', '#F59E0B', '#D97706'],
      '#181818',
      semantic(dark ? '#451A03' : '#FEF3C7', warningColor),
      warningColor,
      warningColor,
    ),
    buttonDisabled: c.accentDisabled,
    buttonDisabledText: c.onAccent,
    buttonSecondaryDisabled: c.secondaryButtonDisabled,
    buttonSecondaryDisabledText: c.tertiaryText,
    buttonGhostHighlighted: c.ghostButtonHighlighted,
    buttonFocus: c.accent,
  };
}

export const buttonThemes = { light: createButtonTheme(false), dark: createButtonTheme(true) };
