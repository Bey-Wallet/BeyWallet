import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { StyleSheet } from 'react-native';
import { TamaguiProvider, Theme, Text } from 'tamagui';
import { AppInput as Input, AppTextArea as TextArea } from '~/shared/ui/AppInput';
import { config } from '~/tamagui.config';
import { AppButton } from '~/shared/ui/AppButton';
import { appColors, appRadii } from '~/shared/theme/appearance';
import { ListTable } from '~/shared/ui/ListTable';

jest.mock('~/shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('~/shared/ui/Spinner', () => ({ Spinner: () => null }));

it.each(['light', 'dark'] as const)(
  'renders monochrome branding through the provider and nested %s theme',
  async (theme) => {
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(
        <TamaguiProvider config={config} defaultTheme={theme === 'light' ? 'dark' : 'light'}>
          <Theme name={theme}>
            <AppButton testID="branded">Branded</AppButton>
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
    expect(backgrounds('branded')).toContain(appColors[theme].accent);
    const foregrounds = tree.root
      .findAll((node) => node.props.children === 'Branded')
      .map((node) => StyleSheet.flatten(node.props.style)?.color);
    expect(foregrounds).toContain(appColors[theme].onAccent);
    expect(backgrounds('neutral')).toContain(appColors[theme].surface);
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
