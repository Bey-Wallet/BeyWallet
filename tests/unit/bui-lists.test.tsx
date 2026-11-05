import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { TamaguiProvider } from 'tamagui';
import { config } from '~/tamagui.config';
import Screen from '~/app/(tabs)/settings/bui-lists';
import {
  BUIListRow,
  BUIListGroup,
  BUIListSeparator,
  BUIListCheckRow,
} from '~/shared/ui/BUI/BUIListRow';
import { BUICopyRow } from '~/shared/ui/BUI/BUIPropertyRow';
import { BUIChoices } from '~/shared/ui/BUI/BUIPage';
import { BUIText } from '~/shared/ui/BUI/BUIText';
import { BUISelectionRow } from '~/shared/ui/BUI/BUISelectionControl';
import { BUIButton } from '~/shared/ui/BUI/BUIButton';
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

it('keeps status read-only, omits blank subtitles and guards disabled press/long press', async () => {
  const press = jest.fn();
  const longPress = jest.fn();
  let tree: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      tree = create(wrap(<BUIListRow title="Status" subtitle="   " destination="internal" />));
    });
    expect(tree!.root.findAllByType(AppPressable)).toHaveLength(0);
    expect(tree!.root.findAllByType(BUIText).map((node) => node.props.children)).toEqual([
      'Status',
    ]);
    await act(async () =>
      tree!.update(
        wrap(<BUIListRow title="Action" disabled onPress={press} onLongPress={longPress} />),
      ),
    );
    const button = () => tree!.root.findByType(AppPressable);
    await act(async () => {
      button().props.onPress();
      button().props.onLongPress();
    });
    expect(press).not.toHaveBeenCalled();
    expect(longPress).not.toHaveBeenCalled();
    await act(async () =>
      tree!.update(wrap(<BUIListRow title="Action" onPress={press} onLongPress={longPress} />)),
    );
    await act(async () => {
      button().props.onPress();
      button().props.onLongPress();
    });
    expect(press).toHaveBeenCalledTimes(1);
    expect(longPress).toHaveBeenCalledTimes(1);
  } finally {
    if (tree) await act(async () => tree!.unmount());
  }
});

it('handles checkbox toggling, radio reselection and read-only checked rows', async () => {
  const change = jest.fn();
  let tree: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      tree = create(wrap(<BUIListCheckRow title="Checkbox" checked onCheckedChange={change} />));
    });
    await act(async () => tree!.root.findByType(AppPressable).props.onPress());
    expect(change).toHaveBeenLastCalledWith(false);
    await act(async () =>
      tree!.update(
        wrap(<BUIListCheckRow title="Radio" role="radio" checked onCheckedChange={change} />),
      ),
    );
    await act(async () => tree!.root.findByType(AppPressable).props.onPress());
    expect(change).toHaveBeenLastCalledWith(true);
    await act(async () => tree!.update(wrap(<BUIListCheckRow title="Read only" checked />)));
    expect(tree!.root.findAllByType(AppPressable)).toHaveLength(0);
    expect(tree!.root.findByType(BUIListRow).props.checked).toBe(true);
  } finally {
    if (tree) await act(async () => tree!.unmount());
  }
});

it('only makes the copy action interactive and delegates clipboard behavior to its caller', async () => {
  const copy = jest.fn();
  let tree: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      tree = create(
        wrap(<BUICopyRow title="Sample address" value="public-demo-address" onCopy={copy} />),
      );
    });
    const actions = tree!.root.findAllByType(AppPressable);
    expect(actions).toHaveLength(1);
    expect(actions[0].props.accessibilityLabel).toBe('Copy Sample address');
    expect(tree!.root.findByType(BUIListRow).props.onPress).toBeUndefined();
    await act(async () => actions[0].props.onPress());
    expect(copy).toHaveBeenCalledTimes(1);
  } finally {
    if (tree) await act(async () => tree!.unmount());
  }
});

it('updates group boundaries when rows are removed and omits empty groups', async () => {
  let tree: ReactTestRenderer | undefined;
  const sample = (count: number) =>
    wrap(
      <BUIListGroup>
        {Array.from({ length: count }, (_, index) => (
          <BUIListRow key={index} title={`Row ${index}`} />
        ))}
      </BUIListGroup>,
    );
  try {
    await act(async () => {
      tree = create(sample(3));
    });
    expect(tree!.root.findAllByType(BUIListSeparator)).toHaveLength(2);
    await act(async () => tree!.update(sample(1)));
    expect(tree!.root.findAllByType(BUIListSeparator)).toHaveLength(0);
    await act(async () => tree!.update(sample(0)));
    expect(tree!.toJSON()).toBeNull();
  } finally {
    if (tree) await act(async () => tree!.unmount());
  }
});

it.each(['light', 'dark'] as const)(
  'renders every list category and local interactions in %s',
  async (appearance) => {
    useBUIStore.setState({ appearance });
    let tree: ReactTestRenderer | undefined;
    try {
      await act(async () => {
        tree = create(wrap(<Screen />));
      });
      const category = () =>
        tree!.root.findAllByType(BUIChoices).find((node) => node.props.values[0] === 'Rows')!;
      const row = (title: string) =>
        tree!.root.findAllByType(BUIListRow).find((node) => node.props.title === title)!;
      await act(async () => row('Remove sample').props.onPress());
      expect(row('Remove sample')).toBeUndefined();
      expect(row('Restore sample row')).toBeDefined();
      await act(async () => row('Restore sample row').props.onPress());
      expect(row('Remove sample')).toBeDefined();
      await act(async () => category().props.onChange('Selection'));
      const travel = () =>
        tree!.root
          .findAllByType(BUIListCheckRow)
          .find((node) => node.props.title === 'Travel wallet')!;
      await act(async () => travel().props.onCheckedChange(true));
      expect(travel().props.checked).toBe(true);
      const checkbox = () =>
        tree!.root
          .findAllByType(BUISelectionRow)
          .find((node) => node.props.label === 'I understand')!;
      await act(async () => checkbox().props.onCheckedChange(true));
      expect(checkbox().props.checked).toBe(true);
      for (const value of ['Properties', 'Wallet rows', 'States', 'Groups']) {
        await act(async () => category().props.onChange(value));
        expect(JSON.stringify(tree!.toJSON())).not.toMatch(/compose|android views/i);
        expect(tree!.toJSON()).not.toBeNull();
        if (value === 'States') {
          await act(async () => tree!.root.findByType(BUIButton).props.onPress());
          expect(JSON.stringify(tree!.toJSON())).toContain(
            'Sample retry pressed. No network request.',
          );
        }
      }
    } finally {
      if (tree) await act(async () => tree!.unmount());
    }
  },
);

jest.mock('~/shared/utils/developmentClient', () => ({ isDevelopmentClient: () => true }));
