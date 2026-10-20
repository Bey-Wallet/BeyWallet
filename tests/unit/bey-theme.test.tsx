import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { StyleSheet } from 'react-native';
import { TamaguiProvider, Theme, Text, useTheme, useThemeName } from 'tamagui';
import { config } from '~/tamagui.config';
import { BeyText } from '~/shared/ui/BeyText';
import { beyColors, beyThemeNames, beyTypography } from '~/shared/theme/bey';

function Probe({ id }: { id: string }) {
  const theme = useTheme();
  return (
    <Text
      testID={id}
      accessibilityLabel={`${useThemeName()}:${theme.background.val}:${theme.color.val}`}
    />
  );
}

it.each(['dark', 'light'] as const)(
  'scopes the new %s theme without recoloring siblings',
  async (mode) => {
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(
        <TamaguiProvider config={config} defaultTheme={mode}>
          <Probe id="before" />
          <Theme name={beyThemeNames[mode]}>
            <Probe id="inside" />
          </Theme>
          <Probe id="after" />
        </TamaguiProvider>,
      );
    });
    const label = (id: string) =>
      tree.root.findAll((node) => node.props.testID === id)[0].props.accessibilityLabel;
    expect(label('inside')).toBe(
      `${beyThemeNames[mode]}:${beyColors[mode].backgroundPage}:${beyColors[mode].textPrimary}`,
    );
    expect(label('before')).toBe(label('after'));
    expect(label('before').split(':')[0]).toBe(mode);
    await act(async () => tree.unmount());
  },
);

it('renders source type metrics, feature sets and explicit overrides through Tamagui', async () => {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <TamaguiProvider config={config} defaultTheme="dark">
        <Theme name="dark_bey">
          <BeyText variant="body1" tone="textSecondary" testID="body">
            Example body
          </BeyText>
          <BeyText variant="h1" testID="heading">
            Example heading
          </BeyText>
          <BeyText variant="mono" testID="mono">
            Example mono
          </BeyText>
          <BeyText variant="body1" color="#123456" fontSize={22} testID="override">
            Override
          </BeyText>
        </Theme>
      </TamaguiProvider>,
    );
  });
  const styles = (id: string) =>
    tree.root
      .findAll((node) => node.props.testID === id)
      .map((node) => StyleSheet.flatten(node.props.style));
  expect(styles('body')).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        fontSize: 16,
        lineHeight: 24,
        color: beyColors.dark.textSecondary,
        fontVariant: beyTypography.body1.fontVariant,
      }),
    ]),
  );
  expect(styles('heading')).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ fontSize: 32, fontVariant: beyTypography.h1.fontVariant }),
    ]),
  );
  expect(
    styles('heading').some(
      (style) => style?.fontFamily === 'TTFirsNeueDemiBold' && style.lineHeight == null,
    ),
  ).toBe(true);
  expect(styles('mono')).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ fontFamily: 'BeyRobotoMono', fontSize: 16, lineHeight: 24 }),
    ]),
  );
  expect(styles('override')).toEqual(
    expect.arrayContaining([expect.objectContaining({ fontSize: 22, color: '#123456' })]),
  );
  await act(async () => tree.unmount());
});
