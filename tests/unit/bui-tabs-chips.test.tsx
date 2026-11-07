import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { AppState, Modal } from 'react-native';
import { TamaguiProvider } from 'tamagui';
import { config } from '~/tamagui.config';
import Screen from '~/app/(tabs)/settings/bui-tabs-chips';
import { BUIContentTabs } from '~/shared/ui/BUI/BUIContentTabs';
import { BUIActionSelector } from '~/shared/ui/BUI/BUIActionSelector';
import { BUIChip, BUIOutlineChip } from '~/shared/ui/BUI/BUIChip';
import { BUIChoices } from '~/shared/ui/BUI/BUIPage';
import { AppPressable } from '~/shared/ui/AppPressable';
import { buiChipScrollOffset, buiSelectorPosition } from '~/shared/ui/BUI/selectorGeometry';
import { getBUITheme } from '~/shared/ui/BUI/theme';
import { useBUIStore } from '~/state/buiStore';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => true,
}));
jest.mock('~/shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('~/shared/ui/Spinner', () => ({ Spinner: () => null }));
const mockMeasureInWindow = jest.fn();
jest.mock('~/shared/ui/AppPressable', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    AppPressable: React.forwardRef((props: Record<string, unknown>, ref: unknown) => {
      React.useImperativeHandle(ref, () => ({ measureInWindow: mockMeasureInWindow }));
      return React.createElement(View, props, props.children);
    }),
  };
});
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));

const items = [
  { id: 'one', title: 'Same title' },
  { id: 'two', title: 'Same title' },
];
const wrap = (children: React.ReactNode) => (
  <TamaguiProvider config={config} defaultTheme="dark">
    {children}
  </TamaguiProvider>
);
beforeEach(() => {
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
});
afterEach(() => {
  jest.restoreAllMocks();
  useBUIStore.setState({ appearance: 'dark' });
});

it('places menus below, above and within narrow windows, respecting alignment and RTL', () => {
  const window = { width: 360, height: 640 };
  const menu = { width: 240, height: 145 };
  expect(
    buiSelectorPosition({ x: 100, y: 100, width: 100, height: 36 }, window, menu),
  ).toMatchObject({ x: 30, y: 148, originX: 120, originY: 0 });
  expect(
    buiSelectorPosition({ x: 300, y: 600, width: 50, height: 36 }, window, menu),
  ).toMatchObject({ x: 104, y: 443, originY: 145 });
  expect(
    buiSelectorPosition({ x: 100, y: 100, width: 50, height: 32 }, window, menu, 'start', true),
  ).toMatchObject({ x: 0, y: 144 });
  const constrained = buiSelectorPosition(
    { x: 0, y: 30, width: 50, height: 36 },
    { width: 180, height: 120 },
    { width: 164, height: 120 },
  );
  expect(constrained).toMatchObject({ x: 0, y: 0 });
});

it('only scrolls clipped chips into view, preserving content padding', () => {
  expect(buiChipScrollOffset(0, 320, { x: 16, width: 80 })).toBe(0);
  expect(buiChipScrollOffset(0, 320, { x: 300, width: 80 })).toBe(76);
  expect(buiChipScrollOffset(200, 320, { x: 16, width: 80 })).toBe(0);
});

it('tabs select by id even with duplicate titles and expose the fallback selection', async () => {
  const select = jest.fn();
  let tree: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      tree = create(wrap(<BUIContentTabs items={items} selectedId="absent" onSelect={select} />));
    });
    const tabs = () => tree!.root.findAllByType(AppPressable);
    expect(tabs().map((node) => node.props.accessibilityState.selected)).toEqual([true, false]);
    await act(async () => tabs()[1].props.onPress());
    expect(select).toHaveBeenCalledWith(items[1]);
    await act(async () => tree!.update(wrap(<BUIContentTabs items={[]} onSelect={select} />)));
    expect(tabs()).toHaveLength(0);
  } finally {
    if (tree) await act(async () => tree!.unmount());
  }
});

it.each(['light', 'dark'] as const)(
  'renders every preview category and updates chip states in %s',
  async (appearance) => {
    useBUIStore.setState({ appearance });
    let tree: ReactTestRenderer | undefined;
    try {
      await act(async () => {
        tree = create(wrap(<Screen />));
      });
      const category = () =>
        tree!.root.findAllByType(BUIChoices).find((node) => node.props.values[0] === 'Tabs')!;
      await act(async () => category().props.onChange('Chips'));
      const chip = () =>
        tree!.root.findAllByType(BUIChip).find((node) => node.props.children === 'Lightning')!;
      expect(chip().props.selected).toBe(false);
      await act(async () => chip().props.onPress());
      expect(chip().props.selected).toBe(true);
      const outline = () =>
        tree!.root.findAllByType(BUIOutlineChip).find((node) => node.props.children === '25%')!;
      await act(async () => outline().props.onPress());
      expect(outline().props.selected).toBe(true);
      const c = getBUITheme(appearance);
      expect(outline().findByType(AppPressable).props.bg).toBe(c.tertiaryFill);
      expect(c.tertiaryFill).not.toBe('transparent');
      await act(async () => category().props.onChange('Selectors'));
      expect(tree!.root.findAllByType(BUIActionSelector)).toHaveLength(4);
      expect(JSON.stringify(tree!.toJSON())).not.toMatch(/moon/i);
      expect(
        tree!.root.findAllByType(AppPressable).filter((node) => node.props.height === 36).length,
      ).toBeGreaterThan(0);
    } finally {
      if (tree) await act(async () => tree!.unmount());
    }
  },
);

it('opens an anchored menu, selects an id, dismisses and ignores stale measurements after backgrounding', async () => {
  const select = jest.fn();
  let measure: ((x: number, y: number, width: number, height: number) => void) | undefined;
  mockMeasureInWindow.mockImplementation((callback) => {
    measure = callback;
  });
  let tree: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      tree = create(wrap(<BUIActionSelector items={items} selectedId="one" onSelect={select} />), {
        createNodeMock: () => ({
          measureInWindow: (callback: typeof measure) => {
            measure = callback;
          },
        }),
      });
    });
    const trigger = () =>
      tree!.root
        .findAllByType(AppPressable)
        .find((node) => node.props.accessibilityState?.expanded !== undefined)!;
    const visible = () => tree!.root.findByType(Modal).props.visible;
    const open = async () => {
      await act(async () => trigger().props.onPress());
      await act(async () => measure!(100, 120, 100, 36));
    };
    await open();
    expect(visible()).toBe(true);
    const rows = tree!.root
      .findAllByType(AppPressable)
      .filter((node) => node.props.accessibilityRole === 'radio');
    expect(rows.map((node) => node.props.accessibilityState.checked)).toEqual([true, false]);
    await act(async () => rows[1].props.onPress());
    expect(select).toHaveBeenCalledWith(items[1]);
    expect(visible()).toBe(false);
    await open();
    await act(async () => tree!.root.findByType(Modal).props.onRequestClose());
    expect(visible()).toBe(false);
    await open();
    await act(async () =>
      tree!.root
        .findAllByType(AppPressable)
        .find((node) => node.props.accessibilityLabel === 'Dismiss selector')!
        .props.onPress(),
    );
    expect(visible()).toBe(false);
    await act(async () => trigger().props.onPress());
    const listeners = jest
      .mocked(AppState.addEventListener)
      .mock.calls.filter(([event]) => event === 'change');
    await act(async () => {
      for (const [, change] of listeners) change('background');
    });
    await act(async () => measure!(100, 120, 100, 36));
    expect(visible()).toBe(false);
  } finally {
    if (tree) await act(async () => tree!.unmount());
  }
});

jest.mock('~/shared/utils/developmentClient', () => ({ isDevelopmentClient: () => true }));
