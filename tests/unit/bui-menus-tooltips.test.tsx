import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Animated, AppState, Modal, Text as NativeText } from 'react-native';
import { TamaguiProvider } from 'tamagui';
import { config } from '~/tamagui.config';
import Screen from '~/app/(tabs)/settings/bui-menus';
import { BUIActionMenu } from '~/shared/ui/BUI/BUIActionMenu';
import { BUITooltip } from '~/shared/ui/BUI/BUITooltip';
import { buiTooltipLayout } from '~/shared/ui/BUI/popupGeometry';
import { BUIChoices } from '~/shared/ui/BUI/BUIPage';
import { BUIButton } from '~/shared/ui/BUI/BUIButton';
import { AppPressable } from '~/shared/ui/AppPressable';
import { useBUIStore } from '~/state/buiStore';

let mockFocused = true;
const mockMeasure = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => mockFocused,
}));
jest.mock('~/shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('~/shared/ui/Spinner', () => ({ Spinner: () => null }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock('~/shared/ui/AppPressable', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    AppPressable: React.forwardRef((props: Record<string, unknown>, ref: unknown) => {
      React.useImperativeHandle(ref, () => ({ measureInWindow: mockMeasure }));
      return React.createElement(View, props, props.children);
    }),
  };
});
const wrap = (children: React.ReactNode) => (
  <TamaguiProvider config={config} defaultTheme="dark">
    {children}
  </TamaguiProvider>
);
beforeEach(() => {
  mockFocused = true;
  jest.clearAllMocks();
  mockMeasure.mockImplementation((callback) => callback(100, 100, 64, 48));
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
});
afterEach(() => {
  jest.restoreAllMocks();
  useBUIStore.setState({ appearance: 'dark' });
});

it('fits tooltip width, flips above, keeps source tail geometry and clamps small viewports', () => {
  const window = { width: 360, height: 640 };
  expect(
    buiTooltipLayout({
      anchor: { x: 80, y: 100, width: 16, height: 16 },
      window,
      naturalWidth: 180,
      contentHeight: 60,
    }),
  ).toMatchObject({
    x: 63,
    y: 120,
    width: 180,
    height: 66,
    tailOnTop: true,
    tailLeft: 18,
    originX: 25,
    originY: 0,
  });
  const edge = buiTooltipLayout({
    anchor: { x: 300, y: 610, width: 16, height: 16 },
    window,
    contentHeight: 60,
  });
  expect(edge.tailOnTop).toBe(false);
  expect(edge.y).toBe(540);
  expect(edge.x + edge.width).toBeLessThanOrEqual(360);
  expect(edge.y + edge.height).toBeLessThanOrEqual(640);
  const center = buiTooltipLayout({
    anchor: { x: 150, y: 100, width: 16, height: 16 },
    window,
    contentHeight: 60,
    centerTail: true,
    preferAbove: true,
  });
  expect(center.tailLeft).toBe((center.width - 14) / 2);
  expect(center.originX).toBe(center.width / 2);
  expect(center.tailOnTop).toBe(false);
  const small = buiTooltipLayout({
    anchor: { x: 40, y: 20, width: 16, height: 16 },
    window: { width: 50, height: 80 },
    contentHeight: 300,
  });
  expect(small).toMatchObject({ x: 0, y: 0, width: 50, height: 80 });
});

it('supports selection ids, disabled actions and single dispatch while closing', async () => {
  const select = jest.fn();
  let tree: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      tree = create(
        wrap(
          <BUIActionMenu
            label="Open menu"
            selectedId="one"
            items={[
              { id: 'one', title: 'Same label' },
              { id: 'two', title: 'Same label' },
              { id: 'disabled', title: 'Disabled', disabled: true },
            ]}
            onAction={select}
          />,
        ),
      );
    });
    const target = (label: string) =>
      tree!.root
        .findAllByType(AppPressable)
        .find((node) => node.props.accessibilityLabel === label)!;
    await act(async () => target('Open menu').props.onLongPress());
    expect(tree!.root.findByType(Modal).props.visible).toBe(true);
    const options = tree!.root
      .findAllByType(AppPressable)
      .filter((node) => node.props.accessibilityRole === 'radio');
    expect(options.map((node) => node.props.accessibilityState.checked)).toEqual([
      true,
      false,
      false,
    ]);
    await act(async () => target('Disabled').props.onPress());
    expect(select).not.toHaveBeenCalled();
    expect(tree!.root.findByType(Modal).props.visible).toBe(true);
    await act(async () => {
      options[1].props.onPress();
      options[1].props.onPress();
    });
    expect(select).toHaveBeenCalledTimes(1);
    expect(select).toHaveBeenCalledWith('two');
    expect(tree!.root.findByType(Modal).props.visible).toBe(false);
    await act(async () => target('Open menu').props.onPress());
    await act(async () => tree!.root.findByType(Modal).props.onRequestClose());
    expect(tree!.root.findByType(Modal).props.visible).toBe(false);
  } finally {
    if (tree) await act(async () => tree!.unmount());
  }
});

it('does not reopen after a stale measurement completes in the background or after unmount', async () => {
  let measure: ((x: number, y: number, width: number, height: number) => void) | undefined;
  mockMeasure.mockImplementation((callback) => {
    measure = callback;
  });
  let tree: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      tree = create(wrap(<BUITooltip label="Explain" text="Sample explanation" />));
    });
    await act(async () =>
      tree!.root
        .findAllByType(AppPressable)
        .find((node) => node.props.accessibilityLabel === 'Explain')!
        .props.onPress(),
    );
    await act(async () => {
      for (const [, callback] of jest.mocked(AppState.addEventListener).mock.calls)
        callback('background');
    });
    await act(async () => measure!(100, 100, 48, 48));
    expect(tree!.root.findByType(Modal).props.visible).toBe(false);
    await act(async () =>
      tree!.root
        .findAllByType(AppPressable)
        .find((node) => node.props.accessibilityLabel === 'Explain')!
        .props.onPress(),
    );
    await act(async () => tree!.unmount());
    tree = undefined;
    await act(async () => measure!(100, 100, 48, 48));
  } finally {
    if (tree) await act(async () => tree!.unmount());
  }
});

it('sizes short tooltips from native text measurements and separates read-only from clickable content', async () => {
  const click = jest.fn();
  let tree: ReactTestRenderer | undefined;
  const sample = (interactive: boolean) =>
    wrap(
      <BUITooltip
        label="Explain"
        text="Short tip"
        onContentPress={interactive ? click : undefined}
      />,
    );
  try {
    await act(async () => {
      tree = create(sample(false));
    });
    const measure = tree!.root
      .findAllByType(NativeText)
      .find((node) => node.props.style?.width === 100000 && node.props.children === 'Short tip')!;
    await act(async () => measure.props.onTextLayout({ nativeEvent: { lines: [{ width: 55 }] } }));
    const open = async () => {
      await act(async () =>
        tree!.root
          .findAllByType(AppPressable)
          .find((node) => node.props.accessibilityLabel === 'Explain')!
          .props.onPress(),
      );
    };
    await open();
    const bubble = tree!.root
      .findAllByType(Animated.View)
      .find((node) => node.props.accessibilityViewIsModal)!;
    expect(bubble.props.style.width).toBe(79);
    expect(
      tree!.root.findAllByType(AppPressable).map((node) => node.props.accessibilityLabel),
    ).toEqual(['Explain', 'Dismiss tooltip']);
    await act(async () => tree!.root.findByType(Modal).props.onRequestClose());
    await act(async () => tree!.update(sample(true)));
    await open();
    const content = tree!.root
      .findAllByType(AppPressable)
      .find((node) => node.props.accessibilityLabel === 'Short tip')!;
    await act(async () => {
      content.props.onPress();
      content.props.onPress();
    });
    expect(click).toHaveBeenCalledTimes(1);
    expect(tree!.root.findByType(Modal).props.visible).toBe(false);
  } finally {
    if (tree) await act(async () => tree!.unmount());
  }
});

it.each(['light', 'dark'] as const)(
  'renders the menu and tooltip route with local actions in %s',
  async (appearance) => {
    useBUIStore.setState({ appearance });
    let tree: ReactTestRenderer | undefined;
    try {
      await act(async () => {
        tree = create(wrap(<Screen />));
      });
      const trigger = (label: string) =>
        tree!.root
          .findAllByType(AppPressable)
          .find((node) => node.props.accessibilityLabel === label)!;
      await act(async () => trigger('Choose sample order').props.onPress());
      await act(async () => trigger('Oldest first').props.onPress());
      expect(
        tree!.root
          .findAllByType(BUIActionMenu)
          .find((node) => node.props.label === 'Choose sample order')!.props.selectedId,
      ).toBe('oldest');
      await act(async () => trigger('Show custom content').props.onPress());
      await act(async () => tree!.root.findByType(BUIButton).props.onPress());
      expect(JSON.stringify(tree!.toJSON())).toContain('Sample action: custom.');
      const choices = (first: string) =>
        tree!.root.findAllByType(BUIChoices).find((node) => node.props.values[0] === first)!;
      await act(async () => choices('Menus').props.onChange('Tooltips'));
      await act(async () => {
        choices('Below').props.onChange('Above');
        choices('Start tail').props.onChange('Centered tail');
        choices('Left').props.onChange('Right');
      });
      await act(async () => trigger('Explain sample fee').props.onPress());
      const openModal = () => tree!.root.findAllByType(Modal).find((node) => node.props.visible)!;
      expect(openModal()).toBeDefined();
      await act(async () => trigger('Dismiss tooltip').props.onPress());
      expect(openModal()).toBeUndefined();
      await act(async () => trigger('Explain badge').props.onPress());
      expect(
        tree!.root.findAllByType(BUITooltip).find((node) => node.props.label === 'Explain badge')!
          .props.badge,
      ).toBe('New');
      mockFocused = false;
      await act(async () => tree!.update(wrap(<Screen />)));
      expect(openModal()).toBeUndefined();
      expect(JSON.stringify(tree!.toJSON())).not.toMatch(/moon|compose|android views/i);
    } finally {
      if (tree) await act(async () => tree!.unmount());
    }
  },
);

jest.mock('~/shared/utils/developmentClient', () => ({ isDevelopmentClient: () => true }));
