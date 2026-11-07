import { getBUITheme } from '~/shared/ui/BUI/theme';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ScrollView, StyleSheet } from 'react-native';
import { TamaguiProvider, Theme } from 'tamagui';
import { LinearGradient } from 'react-native-svg';
import { config } from '~/tamagui.config';
import Screen from '~/app/(tabs)/settings/bui-navigation';
import { BUIHeader, BUIHeaderAction, BUILargeHeader } from '~/shared/ui/BUI/BUIHeader';
import { BUITabBar, BUIBottomBar, type BUINavigationTab } from '~/shared/ui/BUI/BUINavigation';
import {
  buiHeaderTitleScale,
  buiHeaderTitleInset,
  buiLargeHeaderHeight,
} from '~/shared/ui/BUI/navigationGeometry';
import { BUIChoices } from '~/shared/ui/BUI/BUIPage';
import { BUIButton } from '~/shared/ui/BUI/BUIButton';
import { BUIText } from '~/shared/ui/BUI/BUIText';
import { AppPressable } from '~/shared/ui/AppPressable';
import { useBUIStore } from '~/state/buiStore';

jest.mock('~/shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('~/shared/ui/Spinner', () => ({ Spinner: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));
const wrap = (children: React.ReactNode) => (
  <TamaguiProvider config={config} defaultTheme="dark">
    {children}
  </TamaguiProvider>
);
afterEach(() => useBUIStore.setState({ appearance: 'dark' }));

it('fits in source .95 steps, clamps at .85, and reserves the wider control group symmetrically', () => {
  expect(buiHeaderTitleScale(100, 100)).toBe(1);
  expect(buiHeaderTitleScale(100, 96)).toBe(0.95);
  expect(buiHeaderTitleScale(100, 91)).toBeCloseTo(0.9025);
  expect(buiHeaderTitleScale(100, 10)).toBe(0.85);
  expect(buiHeaderTitleScale(0, 0)).toBe(1);
  expect(buiHeaderTitleInset(48, 72)).toBe(buiHeaderTitleInset(72, 48));
  expect(buiHeaderTitleInset(48, 32)).toBe(68);
  expect(buiLargeHeaderHeight(-20)).toBe(84);
  expect(buiLargeHeaderHeight(500)).toBe(0);
  expect(buiLargeHeaderHeight(20.2, 2)).toBe(64);
});

it('guards hidden title actions, removes faded actions under reduced motion and keeps navigation active', async () => {
  const title = jest.fn();
  const back = jest.fn();
  const action = jest.fn();
  let tree: ReactTestRenderer | undefined;
  const preview = (visible: boolean, actions = true) =>
    wrap(
      <BUIHeader
        title="Choose wallet"
        textVisible={visible}
        onTitlePress={title}
        onNavigate={back}
        actions={
          actions ? (
            <BUIHeaderAction label="Options" onPress={action}>
              <BUIText>Options</BUIText>
            </BUIHeaderAction>
          ) : undefined
        }
      />,
    );
  try {
    await act(async () => {
      tree = create(preview(true));
    });
    const target = (label: string) =>
      tree!.root
        .findAllByType(AppPressable)
        .find((node) => node.props.accessibilityLabel === label)!;
    await act(async () => target('Choose wallet').props.onPress());
    expect(title).toHaveBeenCalledTimes(1);
    await act(async () => tree!.update(preview(false, false)));
    expect(target('Choose wallet').props.disabled).toBe(true);
    await act(async () => target('Choose wallet').props.onPress());
    expect(title).toHaveBeenCalledTimes(1);
    expect(target('Options')).toBeUndefined();
    await act(async () => target('Back').props.onPress());
    expect(back).toHaveBeenCalledTimes(1);
    await act(async () => tree!.update(preview(true)));
    expect(target('Choose wallet').props.disabled).toBe(false);
    expect(target('Options')).toBeDefined();
  } finally {
    if (tree) await act(async () => tree!.unmount());
  }
});

it('selects tab ids with duplicate labels, excludes hidden items and separates long press', async () => {
  const select = jest.fn();
  const long = jest.fn();
  const items: BUINavigationTab[] = [
    { id: 'one', title: 'Same label', renderIcon: () => null },
    { id: 'two', title: 'Same label', renderIcon: () => null, onLongPress: long },
    { id: 'hidden', title: 'Hidden tab', hidden: true, renderIcon: () => null },
  ];
  let tree: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      tree = create(
        wrap(<BUITabBar items={items} selectedId="two" onSelect={select} bottomInset={24} />),
      );
    });
    const tabs = tree!.root.findAllByType(AppPressable);
    expect(tabs).toHaveLength(2);
    expect(tabs.map((node) => node.props.accessibilityState.selected)).toEqual([false, true]);
    await act(async () => tabs[0].props.onPress());
    expect(select).toHaveBeenLastCalledWith(items[0]);
    await act(async () => tabs[1].props.onLongPress());
    expect(long).toHaveBeenCalledTimes(1);
    expect(select).toHaveBeenCalledTimes(1);
  } finally {
    if (tree) await act(async () => tree!.unmount());
  }
});

it('gives simultaneous bottom-bar gradients unique ids', async () => {
  let tree: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      tree = create(
        wrap(
          <>
            <BUIBottomBar bottomInset={24}>
              <BUIText>One</BUIText>
            </BUIBottomBar>
            <BUIBottomBar>
              <BUIText>Two</BUIText>
            </BUIBottomBar>
          </>,
        ),
      );
    });
    const ids = tree!.root.findAllByType(LinearGradient).map((node) => node.props.id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  } finally {
    if (tree) await act(async () => tree!.unmount());
  }
});

it.each(['light', 'dark'] as const)(
  'renders all categories and local back/close/tab/inset transitions in %s',
  async (appearance) => {
    useBUIStore.setState({ appearance });
    let tree: ReactTestRenderer | undefined;
    try {
      await act(async () => {
        tree = create(wrap(<Screen />));
      });
      const choice = (first: string) =>
        tree!.root.findAllByType(BUIChoices).find((node) => node.props.values[0] === first)!;
      await act(async () => choice('Short').props.onChange('Hidden'));
      expect(
        tree!.root.findAllByType(BUIHeader).every((node) => node.props.textVisible === false),
      ).toBe(true);
      await act(async () => {
        choice('Short').props.onChange('Long');
        choice('Ellipsis').props.onChange('Shrink');
        choice('None').props.onChange('Updating');
      });
      await act(async () => choice('No insets').props.onChange('24-point insets'));
      expect(tree!.root.findAllByType(BUIHeader).every((node) => node.props.topInset === 24)).toBe(
        true,
      );
      await act(async () => choice('Headers').props.onChange('Scrolling'));
      const scroll = tree!.root
        .findAllByType(ScrollView)
        .find((node) => node.props.nestedScrollEnabled)!;
      await act(async () => scroll.props.onScroll({ nativeEvent: { contentOffset: { y: 100 } } }));
      expect(tree!.root.findByType(BUILargeHeader).props.offset).toBe(100);
      await act(async () => choice('Headers').props.onChange('Navigation'));
      const tabs = () => tree!.root.findByType(BUITabBar);
      await act(async () =>
        tabs().props.onSelect(
          tabs().props.items.find((item: BUINavigationTab) => item.id === 'explore'),
        ),
      );
      expect(tabs().props.selectedId).toBe('explore');
      await act(async () => choice('All tabs').props.onChange('Hide Explore'));
      expect(tabs().props.selectedId).toBe('wallet');
      expect(tabs().props.bottomInset).toBe(24);
      expect(tree!.root.findByType(BUIBottomBar).props.bottomInset).toBe(24);
      const header = () => tree!.root.findByType(BUIHeader);
      const button = (label: string) =>
        tree!.root.findAllByType(BUIButton).find((node) => node.props.children === label)!;
      expect(header().props.navigation).toBe('close');
      await act(async () => button('Next sample step').props.onPress());
      expect(header().props.navigation).toBe('back');
      await act(async () => header().props.onNavigate());
      expect(header().props.navigation).toBe('close');
      await act(async () => header().props.onNavigate());
      expect(tree!.root.findAllByType(BUIHeader)).toHaveLength(0);
      await act(async () => button('Reopen sample').props.onPress());
      expect(header().props.title).toBe('Sample root');
      expect(JSON.stringify(tree!.toJSON())).not.toMatch(/moon|compose|android views/i);
    } finally {
      if (tree) await act(async () => tree!.unmount());
    }
  },
);

jest.mock('~/shared/utils/developmentClient', () => ({ isDevelopmentClient: () => true }));

it.each(['light', 'dark'] as const)(
  'uses the active %s header theme independently of the catalog preference and blocks locked navigation',
  async (appearance) => {
    useBUIStore.setState({ appearance: appearance === 'light' ? 'dark' : 'light' });
    const navigate = jest.fn();
    let tree!: ReactTestRenderer;
    const render = (locked: boolean) =>
      wrap(
        <Theme name={appearance}>
          <BUIHeader
            title="Payment"
            navigation="close"
            navigationDisabled={locked}
            onNavigate={navigate}
          />
        </Theme>,
      );
    try {
      await act(async () => {
        tree = create(render(true));
      });
      const control = () => tree.root.findByType(AppPressable);
      expect(control().props.disabled).toBe(true);
      await act(async () => control().props.onPress({} as never));
      expect(navigate).not.toHaveBeenCalled();
      const backgrounds = control().findAll(
        (node) =>
          StyleSheet.flatten(node.props.style)?.backgroundColor ===
          getBUITheme(appearance).secondaryButton[0],
      );
      expect(backgrounds.length).toBeGreaterThan(0);
      await act(async () => tree.update(render(false)));
      await act(async () => control().props.onPress({} as never));
      expect(navigate).toHaveBeenCalledTimes(1);
    } finally {
      if (tree) await act(async () => tree.unmount());
    }
  },
);
