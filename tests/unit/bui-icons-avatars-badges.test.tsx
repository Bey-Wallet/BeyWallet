import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Image as NativeImage, Text as NativeText } from 'react-native';
import { Image as SvgImage, Text as SvgText, Mask } from 'react-native-svg';
import { TamaguiProvider } from 'tamagui';
import { config } from '~/tamagui.config';
import IconsScreen from '~/app/(tabs)/settings/bui-icons-avatars';
import BadgesScreen from '~/app/(tabs)/settings/bui-badges';
import { BUIChoices } from '~/shared/ui/BUI/BUIPage';
import { BUIAvatar } from '~/shared/ui/BUI/BUIAvatar';
import { BUICounter } from '~/shared/ui/BUI/BUIBadge';
import {
  buiBadgeOffset,
  type BUIBadgeDirection,
  type BUIBadgeStrategy,
} from '~/shared/ui/BUI/badgeGeometry';
import { useBUIStore } from '~/state/buiStore';

jest.mock('~/shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('~/shared/ui/Spinner', () => ({ Spinner: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));

it('matches every reference overlay strategy/direction and truncates at device density', () => {
  const parent = { width: 44, height: 44 };
  const badge = { width: 20, height: 20 };
  const expected = {
    Circle: [
      [27, -3],
      [-3, -3],
      [27, 27],
      [-3, 27],
    ],
    Square: [
      [34, -10],
      [-10, -10],
      [34, 34],
      [-10, 34],
    ],
    Corner: [
      [44, 0],
      [-20, 0],
      [44, 24],
      [-20, 24],
    ],
  };
  for (const strategy of ['Circle', 'Square', 'Corner'] as BUIBadgeStrategy[]) {
    for (const direction of [
      'EndTop',
      'StartTop',
      'EndBottom',
      'StartBottom',
    ] as BUIBadgeDirection[]) {
      expect(buiBadgeOffset(strategy, direction, parent, badge)).toEqual({
        x: expected[strategy][
          ['EndTop', 'StartTop', 'EndBottom', 'StartBottom'].indexOf(direction)
        ][0],
        y: expected[strategy][
          ['EndTop', 'StartTop', 'EndBottom', 'StartBottom'].indexOf(direction)
        ][1],
      });
    }
  }
  expect(buiBadgeOffset('Circle', 'EndTop', parent, badge, 2)).toEqual({ x: 27.5, y: -3.5 });
});

it.each([
  [IconsScreen, ['Avatars']],
  [BadgesScreen, ['Counts & buttons', 'Overlays']],
] as const)(
  'renders the route and its sections in both appearances',
  async (Screen, categories) => {
    let tree: ReactTestRenderer | undefined;
    try {
      await act(async () => {
        tree = create(
          <TamaguiProvider config={config} defaultTheme="dark">
            <Screen />
          </TamaguiProvider>,
        );
      });
      for (const appearance of ['light', 'dark'] as const) {
        await act(async () => useBUIStore.getState().setAppearance(appearance));
        for (const category of categories) {
          const choices = tree!.root
            .findAllByType(BUIChoices)
            .find((node) => node.props.values.includes(category))!;
          await act(async () => choices.props.onChange(category));
          expect(tree!.toJSON()).not.toBeNull();
        }
        const masks = tree!.root.findAllByType(Mask).map((mask) => mask.props.id);
        expect(new Set(masks).size).toBe(masks.length);
        expect(JSON.stringify(tree!.toJSON())).not.toMatch(/MoonBadge|MoonAvatar/i);
      }
    } finally {
      if (tree) await act(async () => tree!.unmount());
      useBUIStore.setState({ appearance: 'dark' });
    }
  },
);

it('ignores an old image response and shows initials after a current image failure', async () => {
  const callbacks: any[][] = [];
  const resolve = jest
    .spyOn(NativeImage, 'resolveAssetSource')
    .mockImplementation((source: any) => source);
  const size = jest.spyOn(NativeImage, 'getSize').mockImplementation((...args: any[]) => {
    callbacks.push(args);
    return Promise.resolve({ width: 44, height: 44 });
  });
  const preview = (uri: string) => (
    <TamaguiProvider config={config} defaultTheme="dark">
      <BUIAvatar source={{ uri }} initials="BW" label="Sample image" />
    </TamaguiProvider>
  );
  let tree: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      tree = create(preview('https://example.invalid/first'));
    });
    await act(async () => tree!.update(preview('https://example.invalid/second')));
    await act(async () => callbacks[0][1](44, 44));
    expect(tree!.root.findAllByType(SvgImage)).toHaveLength(0);
    await act(async () => callbacks[1][2](new Error('Sample failure')));
    expect(tree!.root.findByType(SvgText).props.children).toBe('BW');
    await act(async () => tree!.update(preview('https://example.invalid/third')));
    await act(async () => callbacks[2][1](44, 44));
    expect(tree!.root.findByType(SvgImage).props.href.uri).toBe('https://example.invalid/third');
    expect(tree!.root.findAllByType(SvgText)).toHaveLength(0);
  } finally {
    if (tree) await act(async () => tree!.unmount());
    size.mockRestore();
    resolve.mockRestore();
  }
});

it('omits an empty count while preserving zero', async () => {
  let tree: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      tree = create(
        <TamaguiProvider config={config} defaultTheme="dark">
          <BUICounter count={null} />
          <BUICounter count={0} />
        </TamaguiProvider>,
      );
    });
    const labels = tree!.root.findAllByType(NativeText).map((node) => node.props.children);
    expect(labels.filter((label) => label === '0')).toHaveLength(1);
  } finally {
    if (tree) await act(async () => tree!.unmount());
  }
});

jest.mock('~/shared/utils/developmentClient', () => ({ isDevelopmentClient: () => true }));
