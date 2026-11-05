import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { TamaguiProvider } from 'tamagui';
import { config } from '~/tamagui.config';
import BUIButtonsScreen from '~/app/(tabs)/settings/new-ui-buttons';
import { BUIButton } from '~/shared/ui/BUI/BUIButton';
import { BUIChoices as ReferenceChoices } from '~/shared/ui/BUI/BUIPage';
import { BUISwitch } from '~/shared/ui/BUI/BUISelectionControl';
import { BUIButtonControl } from '~/shared/ui/BUI/BUIButtonControl';
import { useBUIStore } from '~/state/buiStore';
import { getBUITheme } from '~/shared/ui/BUI/theme';
import { StyleSheet } from 'react-native';

jest.mock('~/shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('~/shared/ui/Spinner', () => ({ Spinner: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));

it('switches width and blocked states without showing reference branding or family controls', async () => {
  let tree: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      tree = create(
        <TamaguiProvider config={config} defaultTheme="dark">
          <BUIButtonsScreen />
        </TamaguiProvider>,
      );
    });
    expect(
      tree!.root.findAllByType(BUIButton).every((button) => button.props.fullWidth === false),
    ).toBe(true);
    await act(async () => tree!.root.findByType(BUISwitch).props.onCheckedChange(true));
    expect(
      tree!.root.findAllByType(BUIButton).every((button) => button.props.fullWidth === true),
    ).toBe(true);
    const choices = () => tree!.root.findAllByType(ReferenceChoices);
    const variants = () => tree!.root.findAllByType(BUIButton);
    expect(JSON.stringify(tree!.toJSON())).not.toMatch(
      /compose|android views|Primary color|Purple|Mono|Indigo|Emerald|Cyan|Amber|Rose|Pink/i,
    );
    expect(choices().some((node) => node.props.values[0] === 'Blue')).toBe(false);
    const primary = variants().find((node) => node.props.children === 'Primary')!;
    const expected = getBUITheme(useBUIStore.getState().appearance).primary;
    expect(
      primary.findAll((node) => StyleSheet.flatten(node.props.style)?.backgroundColor === expected)
        .length,
    ).toBeGreaterThan(0);
    const states = choices().find((node) => node.props.values[0] === 'Default')!;
    for (const state of ['Disabled', 'Loading']) {
      await act(async () => states.props.onChange(state));
      const primary = variants().find((node) => node.props.children === 'Primary')!;
      expect(
        primary.findByType(BUIButtonControl).props[state === 'Loading' ? 'loading' : 'disabled'],
      ).toBe(true);
    }
    expect(variants().every((node) => !node.props.androidView)).toBe(true);
  } finally {
    if (tree) await act(async () => tree!.unmount());
    useBUIStore.setState({ appearance: 'dark' });
  }
});

jest.mock('~/shared/utils/developmentClient', () => ({ isDevelopmentClient: () => true }));
