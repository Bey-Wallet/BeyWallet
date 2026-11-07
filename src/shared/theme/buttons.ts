import { getBUITheme } from '~/shared/ui/BUI/theme';

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
  const c = getBUITheme(dark ? 'dark' : 'light');
  const primary = c.buttons.Primary;
  const accent = c.buttons.Accent;
  const secondary = c.secondaryButton;
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
      [primary[0], primary[2], primary[2]],
      primary[3],
      [secondary[0], secondary[2], secondary[2]],
      secondary[3],
      primary[0],
    ),
    ...palette(
      'Accent',
      [accent[0], accent[2], accent[2]],
      accent[3],
      [secondary[0], secondary[2], secondary[2]],
      accent[0],
      accent[0],
    ),
    ...palette(
      'Critical',
      [c.buttons.Red[0], c.buttons.Red[2], c.buttons.Red[2]],
      '#FFFFFF',
      semantic(dark ? '#450A0A' : '#FEE2E2', criticalColor),
      criticalColor,
      criticalColor,
    ),
    ...palette(
      'Warning',
      [c.buttons.Orange[0], c.buttons.Orange[2], c.buttons.Orange[2]],
      '#181818',
      semantic(dark ? '#451A03' : '#FEF3C7', warningColor),
      warningColor,
      warningColor,
    ),
    buttonDisabled: primary[1],
    buttonAccentDisabled: accent[1],
    buttonAccentDisabledText: c.disabledForeground,
    buttonDisabledText: c.disabledForeground,
    buttonSecondaryDisabled: secondary[1],
    buttonSecondaryDisabledText: c.disabledForeground,
    buttonGhostHighlighted: c.buttons.Tertiary[2],
    buttonFocus: primary[0],
  };
}

export const buttonThemes = { light: createButtonTheme(false), dark: createButtonTheme(true) };
