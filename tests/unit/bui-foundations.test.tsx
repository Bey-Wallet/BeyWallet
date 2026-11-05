import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Stop } from 'react-native-svg';
import { TamaguiProvider } from 'tamagui';
import { config } from '~/tamagui.config';
import BUILayoutScreen from '~/app/(tabs)/settings/bui-layout';
import BUITypographyScreen from '~/app/(tabs)/settings/bui-typography';
import { BUIChoices, BUIText, buiContentInsets } from '~/shared/ui/BUI';

jest.mock('~/shared/ui/Spinner', () => ({ Spinner: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));

it('renders the layout route and all sections, including a docked action fade', async () => {
  let tree: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      tree = create(
        <TamaguiProvider config={config} defaultTheme="dark">
          <BUILayoutScreen />
        </TamaguiProvider>,
      );
    });
    for (const category of ['Corners & groups', 'Alignment', 'Screen frame']) {
      const choices = tree!.root
        .findAllByType(BUIChoices)
        .find((node) => node.props.values[0] === 'Spacing')!;
      await act(async () => choices.props.onChange(category));
      expect(tree!.toJSON()).not.toBeNull();
    }
    expect(tree!.root.findAllByType(Stop)).toHaveLength(2);
    const choices = tree!.root
      .findAllByType(BUIChoices)
      .find((node) => node.props.values[0] === 'Action bar')!;
    await act(async () => choices.props.onChange('No bar'));
    expect(tree!.root.findAllByType(Stop)).toHaveLength(0);
  } finally {
    if (tree) await act(async () => tree!.unmount());
  }
});

it('renders the typography route and scales samples across reading and number sections', async () => {
  let tree: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      tree = create(
        <TamaguiProvider config={config} defaultTheme="dark">
          <BUITypographyScreen />
        </TamaguiProvider>,
      );
    });
    const sample = () =>
      tree!.root.findAllByType(BUIText).find((node) => node.props.children === 'Ready to receive')!;
    expect(sample().props.fontSize).toBe(24);
    const scale = tree!.root
      .findAllByType(BUIChoices)
      .find((node) => node.props.values[0] === '100%')!;
    await act(async () => scale.props.onChange('200%'));
    expect(sample().props.fontSize).toBe(48);
    for (const category of ['Reading', 'Numbers']) {
      const choices = tree!.root
        .findAllByType(BUIChoices)
        .find((node) => node.props.values[0] === 'Type scale')!;
      await act(async () => choices.props.onChange(category));
      expect(tree!.toJSON()).not.toBeNull();
    }
  } finally {
    if (tree) await act(async () => tree!.unmount());
  }
});

it('replaces system insets with measured bars without reserving them twice', () => {
  expect(buiContentInsets({ topBar: 88, bottomBar: 108, top: 24, bottom: 24 })).toEqual({
    top: 88,
    bottom: 108,
  });
  expect(buiContentInsets({ topBar: 0, top: 24, bottom: 24 })).toEqual({ top: 0, bottom: 24 });
});

jest.mock('~/shared/utils/developmentClient', () => ({ isDevelopmentClient: () => true }));
