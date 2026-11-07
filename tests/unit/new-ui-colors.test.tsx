import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { StyleSheet } from 'react-native';
import { TamaguiProvider } from 'tamagui';
import { config } from '~/tamagui.config';
import { NewUiColorsScreen } from '~/features/settings/NewUiColorsScreen';
import { BUIChoices } from '~/shared/ui/BUI/BUIPage';
import { BUIButton } from '~/shared/ui/BUI/BUIButton';
import { buiColors } from '~/shared/ui/BUI/theme';
import { useBUIStore } from '~/state/buiStore';

jest.mock('~/shared/ui/Spinner', () => ({ Spinner: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));

it('shares only white/light and black/dark themes across the color and button previews', async () => {
  let tree: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      tree = create(
        <TamaguiProvider config={config} defaultTheme="dark">
          <NewUiColorsScreen />
        </TamaguiProvider>,
      );
    });
    const choices = () =>
      tree!.root.findAllByType(BUIChoices).find((node) => node.props.values[0] === 'light')!;
    expect(choices().props.values).toEqual(['light', 'dark']);
    for (const appearance of ['light', 'dark'] as const) {
      await act(async () => choices().props.onChange(appearance));
      expect(buiColors[appearance].canvas).toBe(appearance === 'light' ? '#FFFFFF' : '#000000');
      expect(
        tree!.root
          .findAllByType(BUIButton)
          .every((button) => button.props.appearance === appearance),
      ).toBe(true);
      const backgrounds = tree!.root.findAll(
        (node) =>
          StyleSheet.flatten(node.props.style)?.backgroundColor === buiColors[appearance].canvas,
      );
      expect(backgrounds.length).toBeGreaterThan(0);
      expect(JSON.stringify(tree!.toJSON())).not.toMatch(/compose|android views/i);
    }
  } finally {
    if (tree) await act(async () => tree!.unmount());
    useBUIStore.setState({ appearance: 'dark' });
  }
});
