import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Modal, TextInput } from 'react-native';
import { TamaguiProvider, Theme } from 'tamagui';
import { InfoSheet } from '~/shared/components/info-sheets/InfoSheet';
import { getBUITheme } from '~/shared/ui/BUI/theme';
import { config } from '~/tamagui.config';
import Screen from '~/app/(tabs)/settings/bui-sheets';
import AppBottomSheet from '~/shared/ui/AppBottomSheet';
import { BUISheet, BUISheetInput, type BUISheetRef } from '~/shared/ui/BUI/BUISheet';
import { BUIDialog, BUIAlertContent } from '~/shared/ui/BUI/BUIDialog';
import { BUIHeader } from '~/shared/ui/BUI/BUIHeader';
import { BUIChoices } from '~/shared/ui/BUI/BUIPage';
import { BUIButton } from '~/shared/ui/BUI/BUIButton';
import { BUIListRow, BUIListCheckRow } from '~/shared/ui/BUI/BUIListRow';
import { BUIText } from '~/shared/ui/BUI/BUIText';
import { AppPressable } from '~/shared/ui/AppPressable';
import { useBUIStore } from '~/state/buiStore';

let mockFocused = true;
const mockPresent = jest.fn();
const mockDismiss = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => mockFocused,
}));
jest.mock('~/shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('~/shared/ui/Spinner', () => ({ Spinner: () => null }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, right: 0, bottom: 16, left: 0 }),
}));
jest.mock('@gorhom/bottom-sheet', () => {
  const React = require('react');
  const native = require('react-native');
  return {
    BottomSheetScrollView: native.ScrollView,
    BottomSheetTextInput: React.forwardRef((props: object, ref: unknown) =>
      React.createElement(native.TextInput, { ...props, ref }),
    ),
  };
});
jest.mock('~/shared/ui/AppBottomSheet', () => {
  const React = require('react');
  return {
    __esModule: true,
    AppBottomSheetThemeProvider: ({ children }: { children: React.ReactNode }) => children,
    default: React.forwardRef((props: any, ref: unknown) => {
      const [open, setOpen] = React.useState(false);
      React.useImperativeHandle(ref, () => ({
        present: () => {
          mockPresent();
          setOpen(true);
        },
        dismiss: () => {
          if (!open || props.canDismiss === false) return;
          mockDismiss();
          setOpen(false);
          props.onClose?.();
        },
      }));
      return React.createElement('SheetHost', { ...props, open }, open ? props.children : null);
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
});
afterEach(() => useBUIStore.setState({ appearance: 'dark' }));

it.each(['light', 'dark'] as const)(
  'keeps information sheets in the active %s theme despite the opposite catalog setting',
  async (appearance) => {
    useBUIStore.setState({ appearance: appearance === 'light' ? 'dark' : 'light' });
    const ref = React.createRef<BUISheetRef>();
    const render = (name: 'light' | 'dark') =>
      wrap(
        <Theme name={name}>
          <InfoSheet ref={ref} topic="ecash-send" />
        </Theme>,
      );
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(render(appearance));
    });
    try {
      await act(async () => ref.current!.present());
      const sheet = () => tree.root.findByType(BUISheet);
      expect(sheet().findByType(AppBottomSheet).props.backgroundColor).toBe(
        getBUITheme(appearance).canvas,
      );
      expect(sheet().findAllByType(Theme)[0].props.name).toBe(`${appearance}_bui`);
      expect(sheet().findByType(BUIHeader).props.title).toBe('Send ecash');
      const next = appearance === 'light' ? 'dark' : 'light';
      await act(async () => tree.update(render(next)));
      expect(sheet().findByType(AppBottomSheet).props.backgroundColor).toBe(
        getBUITheme(next).canvas,
      );
      expect(sheet().findAllByType(Theme)[0].props.name).toBe(`${next}_bui`);
    } finally {
      await act(async () => tree.unmount());
    }
  },
);

it('orders dialog action before dismissal, suppresses repeated taps, and resets on reopen', async () => {
  const events: string[] = [];
  let tree: ReactTestRenderer | undefined;
  const sample = (visible: boolean) =>
    wrap(
      <BUIDialog
        visible={visible}
        title="Confirm"
        message="Sample"
        positive={{ id: 'ok', label: 'OK' }}
        onAction={(id) => events.push(id)}
        onDismiss={() => events.push('dismiss')}
      />,
    );
  try {
    await act(async () => {
      tree = create(sample(true));
    });
    const choose = () => tree!.root.findByType(BUIAlertContent).props.onAction('ok');
    await act(async () => {
      choose();
      choose();
    });
    expect(events).toEqual(['ok', 'dismiss']);
    await act(async () => tree!.update(sample(false)));
    await act(async () => tree!.update(sample(true)));
    await act(async () => tree!.root.findByType(Modal).props.onRequestClose());
    expect(events).toEqual(['ok', 'dismiss', 'dismiss']);
    await act(async () => tree!.update(sample(false)));
    await act(async () => tree!.update(sample(true)));
    await act(async () =>
      tree!.root
        .findAllByType(AppPressable)
        .find((node) => node.props.accessibilityLabel === 'Dismiss dialog')!
        .props.onPress(),
    );
    expect(events).toEqual(['ok', 'dismiss', 'dismiss', 'dismiss']);
  } finally {
    if (tree) await act(async () => tree!.unmount());
  }
});

it('orders negative before positive actions and supports message-only alerts', async () => {
  const choose = jest.fn();
  let tree: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      tree = create(
        wrap(
          <BUIAlertContent
            message="Sample"
            negative={{ id: 'cancel', label: 'Cancel' }}
            positive={{ id: 'remove', label: 'Remove', destructive: true }}
            onAction={choose}
          />,
        ),
      );
    });
    expect(tree!.root.findAllByType(BUIText).some((node) => node.props.kind === 'h3')).toBe(false);
    const actions = tree!.root.findAllByType(AppPressable);
    expect(actions.map((node) => node.props.accessibilityLabel)).toEqual(['Cancel', 'Remove']);
    await act(async () => actions[1].props.onPress());
    expect(choose).toHaveBeenCalledWith('remove');
  } finally {
    if (tree) await act(async () => tree!.unmount());
  }
});

it('preserves the shared sheet dismissal lock for ref and header actions', async () => {
  const ref = React.createRef<BUISheetRef>();
  let tree: ReactTestRenderer | undefined;
  const sample = (canDismiss: boolean) =>
    wrap(
      <BUISheet ref={ref} title="Locked" canDismiss={canDismiss}>
        <BUIText>Sample</BUIText>
      </BUISheet>,
    );
  try {
    await act(async () => {
      tree = create(sample(false));
    });
    await act(async () => ref.current!.present());
    expect(tree!.root.findByType(AppBottomSheet).props.canDismiss).toBe(false);
    expect(tree!.root.findByType(AppBottomSheet).props.snapPoints).toBeUndefined();
    const scroll = tree!.root.findByType(require('react-native').ScrollView);
    expect(scroll.props.showsVerticalScrollIndicator).toBe(false);
    expect(scroll.props.contentContainerStyle.paddingBottom).toBe(32);
    expect(tree!.root.findByType(BUIHeader).props.onNavigate).toBeUndefined();
    await act(async () => ref.current!.dismiss());
    expect(mockDismiss).not.toHaveBeenCalled();
    await act(async () => tree!.update(sample(true)));
    await act(async () => ref.current!.dismiss());
    expect(mockDismiss).toHaveBeenCalledTimes(1);
  } finally {
    if (tree) await act(async () => tree!.unmount());
  }
});

it('discards canceled selection/form drafts and commits only explicit sample actions', async () => {
  let tree: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      tree = create(wrap(<Screen />));
    });
    const kind = () =>
      tree!.root.findAllByType(BUIChoices).find((node) => node.props.values[0] === 'Information')!;
    const button = (label: string) =>
      tree!.root.findAllByType(BUIButton).find((node) => node.props.children === label)!;
    const open = async () => {
      await act(async () => button('Open sheet preview').props.onPress());
    };
    const selection = (title: string) =>
      tree!.root.findAllByType(BUIListCheckRow).find((node) => node.props.title === title)!;
    await act(async () => kind().props.onChange('Selection'));
    await open();
    await act(async () => selection('Travel wallet').props.onCheckedChange(true));
    await act(async () => tree!.root.findByType(BUIHeader).props.onNavigate());
    await open();
    expect(selection('Travel wallet').props.checked).toBe(false);
    await act(async () => selection('Savings wallet').props.onCheckedChange(true));
    await act(async () => button('Use selection').props.onPress());
    await open();
    expect(selection('Savings wallet').props.checked).toBe(true);
    await act(async () => tree!.root.findByType(BUIHeader).props.onNavigate());
    await act(async () => kind().props.onChange('Form'));
    await open();
    await act(async () => tree!.root.findByType(TextInput).props.onChangeText('   '));
    expect(button('Save preview').props.state).toBe('Disabled');
    await act(async () => button('Save preview').props.onPress());
    expect(tree!.root.findByType(BUISheetInput).props.error).toBe('Enter a sample name.');
    await act(async () => tree!.root.findByType(TextInput).props.onChangeText('  New sample  '));
    await act(async () => button('Save preview').props.onPress());
    const saved = () =>
      tree!.root
        .findAllByType(BUIListRow)
        .find((node) => node.props.title === 'Saved sample name')!;
    expect(saved().props.subtitle).toBe('New sample');
    await open();
    await act(async () => tree!.root.findByType(TextInput).props.onChangeText('Unsaved name'));
    await act(async () => tree!.root.findByType(BUIHeader).props.onNavigate());
    await open();
    expect(tree!.root.findByType(TextInput).props.value).toBe('New sample');
  } finally {
    if (tree) await act(async () => tree!.unmount());
  }
});

it.each(['light', 'dark'] as const)(
  'renders live samples, steps and all dialog variants in %s',
  async (appearance) => {
    useBUIStore.setState({ appearance });
    let tree: ReactTestRenderer | undefined;
    try {
      await act(async () => {
        tree = create(wrap(<Screen />));
      });
      const choice = (first: string) =>
        tree!.root.findAllByType(BUIChoices).find((node) => node.props.values[0] === first)!;
      const button = (label: string) =>
        tree!.root.findAllByType(BUIButton).find((node) => node.props.children === label)!;
      const open = async () => {
        await act(async () => button('Open sheet preview').props.onPress());
      };
      await open();
      await act(async () => button('Got it').props.onPress());
      await act(async () => choice('Information').props.onChange('Scrollable'));
      await open();
      await act(async () =>
        tree!.root
          .findAllByType(BUIListRow)
          .find((node) => node.props.title === 'Sample option 20')!
          .props.onPress(),
      );
      expect(JSON.stringify(tree!.toJSON())).toContain('Sample option 20 pressed.');
      await act(async () => tree!.root.findByType(BUIHeader).props.onNavigate());
      await act(async () => choice('Information').props.onChange('Steps'));
      await open();
      const header = () => tree!.root.findByType(BUIHeader);
      expect(header().props.navigation).toBe('close');
      await act(async () => button('Next sample step').props.onPress());
      expect(header().props.navigation).toBe('back');
      await act(async () => header().props.onNavigate());
      expect(header().props.title).toBe('Sample step 1');
      await act(async () => button('Next sample step').props.onPress());
      await act(async () => button('Next sample step').props.onPress());
      expect(header().props.navigation).toBe('close');
      await act(async () => button('Finish preview').props.onPress());
      await act(async () => choice('Sheets').props.onChange('Dialogs'));
      for (const variant of [
        'One action',
        'Two actions',
        'Destructive',
        'Message only',
        'Long content',
        'Long actions',
      ]) {
        await act(async () => choice('One action').props.onChange(variant));
        await act(async () => button('Open dialog preview').props.onPress());
        expect(tree!.root.findByType(BUIDialog).props.visible).toBe(true);
        await act(async () => tree!.root.findByType(Modal).props.onRequestClose());
        expect(tree!.root.findByType(BUIDialog).props.visible).toBe(false);
      }
      expect(JSON.stringify(tree!.toJSON())).not.toMatch(/moon|compose|android views/i);
      await act(async () => button('Open dialog preview').props.onPress());
      mockFocused = false;
      await act(async () => tree!.update(wrap(<Screen />)));
      expect(tree!.root.findByType(BUIDialog).props.visible).toBe(false);
    } finally {
      if (tree) await act(async () => tree!.unmount());
    }
  },
);

jest.mock('~/shared/utils/developmentClient', () => ({ isDevelopmentClient: () => true }));
