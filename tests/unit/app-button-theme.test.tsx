import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { StyleSheet } from 'react-native';
import { TamaguiProvider, Theme } from 'tamagui';
import { config } from '~/tamagui.config';
import { AppButton } from '~/shared/ui/AppButton';
import { appColors } from '~/shared/theme/appearance';

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
