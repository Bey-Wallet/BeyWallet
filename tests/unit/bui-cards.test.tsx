import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { TamaguiProvider } from 'tamagui';
import { config } from '~/tamagui.config';
import Screen from '~/app/(tabs)/settings/bui-cards';
import { BUICard, BUICardRow } from '~/shared/ui/BUI/BUICard';
import { BUISetupCard } from '~/shared/ui/BUI/BUIWalletCards';
import { BUIShelfCard, BUICollectibleCard } from '~/shared/ui/BUI/BUIShelfCards';
import { BUIBannerCard } from '~/shared/ui/BUI/BUIBannerCard';
import { BUIChoices } from '~/shared/ui/BUI/BUIPage';
import { BUIListRow } from '~/shared/ui/BUI/BUIListRow';
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

it('keeps static card content read-only and guards disabled card presses', async () => {
  const press = jest.fn();
  let tree: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      tree = create(
        wrap(
          <BUICard>
            <BUIText>Static card</BUIText>
          </BUICard>,
        ),
      );
    });
    expect(tree!.root.findAllByType(AppPressable)).toHaveLength(0);
    await act(async () =>
      tree!.update(
        wrap(
          <BUICard label="Disabled" onPress={press} disabled>
            <BUIText>Disabled</BUIText>
          </BUICard>,
        ),
      ),
    );
    await act(async () => tree!.root.findByType(AppPressable).props.onPress());
    expect(press).not.toHaveBeenCalled();
    await act(async () =>
      tree!.update(
        wrap(
          <BUICard label="Enabled" onPress={press}>
            <BUIText>Enabled</BUIText>
          </BUICard>,
        ),
      ),
    );
    await act(async () => tree!.root.findByType(AppPressable).props.onPress());
    expect(press).toHaveBeenCalledTimes(1);
  } finally {
    if (tree) await act(async () => tree!.unmount());
  }
});

it('uses one setup switch target and makes completed steps read-only', async () => {
  const toggle = jest.fn();
  const complete = jest.fn();
  let tree: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      tree = create(
        wrap(
          <BUISetupCard
            items={[
              {
                id: 'backup',
                title: 'Backup',
                status: 'complete',
                tone: 'warning',
                icon: null,
                onPress: complete,
              },
              {
                id: 'switch',
                title: 'Notifications',
                checked: false,
                tone: 'success',
                icon: null,
                onPress: toggle,
              },
            ]}
          />,
        ),
      );
    });
    const targets = tree!.root.findAllByType(AppPressable);
    expect(targets).toHaveLength(1);
    expect(targets[0].props.accessibilityRole).toBe('switch');
    await act(async () => targets[0].props.onPress());
    expect(toggle).toHaveBeenCalledTimes(1);
    expect(complete).not.toHaveBeenCalled();
    const backup = tree!.root
      .findAllByType(BUIListRow)
      .find((node) => node.props.accessibilityLabel === 'Backup, complete')!;
    expect(backup.props.onPress).toBeUndefined();
  } finally {
    if (tree) await act(async () => tree!.unmount());
  }
});

it('separates banner navigation from its sibling dismissal target', async () => {
  const press = jest.fn();
  const dismiss = jest.fn();
  let tree: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      tree = create(
        wrap(
          <BUIBannerCard
            title="Sample banner"
            action="Explore"
            onPress={press}
            onDismiss={dismiss}
          />,
        ),
      );
    });
    const close = tree!.root
      .findAllByType(AppPressable)
      .find((node) => node.props.accessibilityLabel === 'Dismiss Sample banner')!;
    let parent = close.parent;
    while (parent) {
      expect(parent.type).not.toBe(AppPressable);
      parent = parent.parent;
    }
    await act(async () => close.props.onPress());
    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(press).not.toHaveBeenCalled();
    await act(async () =>
      tree!.root
        .findAllByType(AppPressable)
        .find((node) => node.props.accessibilityLabel === 'Sample banner, Explore')!
        .props.onPress(),
    );
    expect(press).toHaveBeenCalledTimes(1);
  } finally {
    if (tree) await act(async () => tree!.unmount());
  }
});

it('blocks shelf navigation while editing and removes immediately under reduced motion', async () => {
  const press = jest.fn();
  const remove = jest.fn();
  let tree: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      tree = create(
        wrap(
          <BUIShelfCard
            title="Bitcoin"
            subtitle="+4%"
            variant="favorite"
            avatar={null}
            editing
            onPress={press}
            onRemove={remove}
          />,
        ),
      );
    });
    const targets = () => tree!.root.findAllByType(AppPressable);
    await act(async () =>
      targets()
        .find((node) => node.props.accessibilityLabel === 'Bitcoin, +4%')!
        .props.onPress(),
    );
    expect(press).not.toHaveBeenCalled();
    await act(async () =>
      targets()
        .find((node) => node.props.accessibilityLabel === 'Remove Bitcoin')!
        .props.onPress(),
    );
    expect(remove).toHaveBeenCalledTimes(1);
    expect(targets().some((node) => node.props.accessibilityLabel === 'Remove Bitcoin')).toBe(
      false,
    );
  } finally {
    if (tree) await act(async () => tree!.unmount());
  }
});

it('hides collectible identity in visible text and accessibility labels', async () => {
  let tree: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      tree = create(
        wrap(
          <BUICollectibleCard
            title="Private sample title"
            collection="Private sample collection"
            width={100}
            hidden
            onPress={() => {}}
          />,
        ),
      );
    });
    expect(JSON.stringify(tree!.toJSON())).not.toMatch(/Private sample/);
    expect(tree!.root.findByType(AppPressable).props.accessibilityLabel).toBe('Hidden collectible');
  } finally {
    if (tree) await act(async () => tree!.unmount());
  }
});

it.each(['light', 'dark'] as const)(
  'renders all card categories and local state transitions in %s',
  async (appearance) => {
    useBUIStore.setState({ appearance });
    let tree: ReactTestRenderer | undefined;
    try {
      await act(async () => {
        tree = create(wrap(<Screen />));
      });
      const category = () =>
        tree!.root.findAllByType(BUIChoices).find((node) => node.props.values[0] === 'Foundation')!;
      const row = (title: string) =>
        tree!.root.findAllByType(BUICardRow).find((node) => node.props.title === title)!;
      await act(async () => category().props.onChange('Wallet'));
      await act(async () => row('Travel wallet').props.onPress());
      expect(row('Travel wallet').props.checked).toBe(true);
      await act(async () => category().props.onChange('Setup'));
      const setup = () => tree!.root.findByType(BUISetupCard);
      await act(async () =>
        setup()
          .props.items.find((item: { id: string }) => item.id === 'backup')
          .onPress(),
      );
      expect(setup().props.items.find((item: { id: string }) => item.id === 'backup').status).toBe(
        'complete',
      );
      await act(async () =>
        setup()
          .props.items.find((item: { id: string }) => item.id === 'notifications')
          .onPress(),
      );
      expect(
        setup().props.items.find((item: { id: string }) => item.id === 'notifications').checked,
      ).toBe(true);
      await act(async () => setup().props.onSkip());
      expect(tree!.root.findAllByType(BUISetupCard)).toHaveLength(0);
      await act(async () => row('Restore setup preview').props.onPress());
      expect(setup()).toBeDefined();
      await act(async () => category().props.onChange('Shelves'));
      const edit = () =>
        tree!.root.findAllByType(BUIChoices).find((node) => node.props.values[0] === 'Normal')!;
      await act(async () => edit().props.onChange('Editing'));
      const favorite = () =>
        tree!.root.findAllByType(BUIShelfCard).filter((node) => node.props.variant === 'favorite');
      expect(favorite()).toHaveLength(3);
      await act(async () =>
        favorite()[0]
          .findAllByType(AppPressable)
          .find((node) => node.props.accessibilityLabel === 'Remove Bitcoin')!
          .props.onPress(),
      );
      expect(favorite()).toHaveLength(2);
      await act(async () => edit().props.onChange('Reset'));
      expect(favorite()).toHaveLength(3);
      await act(async () => category().props.onChange('Banners'));
      await act(async () => tree!.root.findAllByType(BUIBannerCard)[0].props.onDismiss());
      expect(row('Restore banner')).toBeDefined();
      await act(async () => row('Restore banner').props.onPress());
      expect(tree!.root.findAllByType(BUIBannerCard)).toHaveLength(2);
      expect(JSON.stringify(tree!.toJSON())).not.toMatch(/moon|compose|android views/i);
    } finally {
      if (tree) await act(async () => tree!.unmount());
    }
  },
);

jest.mock('~/shared/utils/developmentClient', () => ({ isDevelopmentClient: () => true }));
