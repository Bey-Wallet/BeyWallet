import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { StyleSheet } from 'react-native';
import { TamaguiProvider, Theme, Text, YStack } from 'tamagui';
import { AppInput as Input, AppTextArea as TextArea } from '~/shared/ui/AppInput';
import { config } from '~/tamagui.config';
import { AppButton } from '~/shared/ui/AppButton';
import { appColors, appRadii } from '~/shared/theme/appearance';
import { ListTable } from '~/shared/ui/ListTable';
import { getBUITheme } from '~/shared/ui/BUI/theme';
import { posColors } from '~/shared/theme/pos';

jest.mock('~/shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('~/shared/ui/Spinner', () => ({ Spinner: () => null }));

it.each(['light', 'dark'] as const)(
  'resolves the POS theme inside %s without changing surrounding wallet surfaces',
  async (theme) => {
    let tree!: ReactTestRenderer;
    try {
      await act(async () => {
        tree = create(
          <TamaguiProvider config={config} defaultTheme={theme}>
            <YStack testID="wallet-canvas" bg="$background">
              <Text testID="wallet-text" color="$color">
                Wallet
              </Text>
            </YStack>
            <Theme name="light_pos">
              <YStack testID="pos-canvas" bg="$background">
                <Text testID="pos-text" color="$color">
                  Point of sale
                </Text>
              </YStack>
              <Input testID="pos-field" color="$color" />
            </Theme>
          </TamaguiProvider>,
        );
      });
      const styles = (id: string, property: 'backgroundColor' | 'color') =>
        tree.root
          .findAll((node) => node.props.testID === id)
          .map((node) => StyleSheet.flatten(node.props.style)?.[property]);
      expect(styles('pos-canvas', 'backgroundColor')).toContain(posColors.canvas);
      expect(styles('pos-text', 'color')).toContain(posColors.ink);
      expect(styles('pos-field', 'color')).toContain(posColors.ink);
      expect(styles('wallet-canvas', 'backgroundColor')).toContain(appColors[theme].canvas);
      expect(styles('wallet-text', 'color')).toContain(appColors[theme].text);
    } finally {
      await act(async () => tree?.unmount());
    }
  },
);

it.each(['light', 'dark'] as const)(
  'renders BUI button colors through the provider and nested %s theme',
  async (theme) => {
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(
        <TamaguiProvider config={config} defaultTheme={theme === 'light' ? 'dark' : 'light'}>
          <Theme name={theme}>
            <AppButton testID="branded">Branded</AppButton>
            <AppButton testID="accent" variant="accent">
              Accent
            </AppButton>
            <AppButton testID="accent-disabled" variant="accent" disabled>
              Accent disabled
            </AppButton>
            <AppButton testID="neutral" variant="default" emphasis="secondary">
              Neutral
            </AppButton>
          </Theme>
        </TamaguiProvider>,
      );
    });
    const backgrounds = (id: string) =>
      tree.root
        .findAll((node) => node.props.testID === id)
        .map((node) => StyleSheet.flatten(node.props.style)?.backgroundColor);
    expect(backgrounds('branded')).toContain(getBUITheme(theme).primary);
    const foregrounds = tree.root
      .findAll((node) => node.props.children === 'Branded')
      .map((node) => StyleSheet.flatten(node.props.style)?.color);
    expect(foregrounds).toContain(getBUITheme(theme).primaryForeground);
    expect(backgrounds('neutral')).toContain(getBUITheme(theme).secondaryButton[0]);
    expect(backgrounds('accent')).toContain('#8A5CF5');
    expect(backgrounds('accent-disabled')).toContain(getBUITheme(theme).raised);
    expect(
      tree.root
        .findAll((node) => node.props.children === 'Accent disabled')
        .map((node) => StyleSheet.flatten(node.props.style)?.color),
    ).toContain(getBUITheme(theme).disabledForeground);
    expect(
      tree.root
        .findAll((node) => node.props.children === 'Accent')
        .map((node) => StyleSheet.flatten(node.props.style)?.color),
    ).toContain('#FFFFFF');
    await act(async () => tree.unmount());
  },
);

it.each(['light', 'dark'] as const)(
  'uses the shared control and group corner roles in %s',
  async (theme) => {
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(
        <TamaguiProvider config={config} defaultTheme={theme}>
          <Input testID="radius-input" />
          <TextArea testID="radius-textarea" />
          <Input testID="radius-explicit" borderRadius={0} />
          <ListTable testID="radius-group">
            <Text>Sample</Text>
          </ListTable>
        </TamaguiProvider>,
      );
    });
    const radii = (id: string) =>
      tree.root
        .findAll((node) => node.props.testID === id)
        .map((node) => {
          const style = StyleSheet.flatten(node.props.style);
          return style?.borderRadius ?? style?.borderTopLeftRadius;
        });
    expect(radii('radius-input')).toContain(appRadii.control);
    expect(radii('radius-textarea')).toContain(appRadii.control);
    expect(radii('radius-explicit')).toContain(0);
    expect(radii('radius-group')).toContain(appRadii.card);
    await act(async () => tree.unmount());
  },
);
