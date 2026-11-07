import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { AppState, TextInput } from 'react-native';
import { TamaguiProvider } from 'tamagui';
import { config } from '~/tamagui.config';
import FormsScreen from '~/app/(tabs)/settings/bui-forms';
import SelectionsScreen from '~/app/(tabs)/settings/bui-selections';
import { BUIInput, BUIPasswordInput, type BUIInputProps } from '~/shared/ui/BUI/BUIInput';
import { BUISwitch, BUICheckbox, BUIRadio } from '~/shared/ui/BUI/BUISelectionControl';
import { BUIChoices } from '~/shared/ui/BUI/BUIPage';
import { BUIButton } from '~/shared/ui/BUI/BUIButton';
import { AppPressable } from '~/shared/ui/AppPressable';
import { useBUIStore } from '~/state/buiStore';
import { validateBUIFormPreview } from '~/features/settings/bui/formPreview';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => true,
}));
jest.mock('~/shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('~/shared/ui/Spinner', () => ({ Spinner: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));
const wrap = (children: React.ReactNode) => (
  <TamaguiProvider config={config} defaultTheme="dark">
    {children}
  </TamaguiProvider>
);

beforeEach(() => {
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
});
afterEach(() => jest.restoreAllMocks());

it('shows Clear only when eligible and blocks disabled/read-only changes', async () => {
  const change = jest.fn();
  const preview = (props: Partial<BUIInputProps> = {}) =>
    wrap(<BUIInput label="Sample" value="Value" onChangeText={change} {...props} />);
  let tree: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      tree = create(preview());
    });
    const clear = () =>
      tree!.root
        .findAllByType(AppPressable)
        .filter((node) => node.props.accessibilityLabel === 'Clear Sample');
    expect(clear()).toHaveLength(0);
    await act(async () => tree!.root.findByType(TextInput).props.onFocus({ nativeEvent: {} }));
    expect(clear()).toHaveLength(1);
    await act(async () => clear()[0].props.onPress());
    expect(change).toHaveBeenLastCalledWith('');
    for (const props of [
      { loading: true },
      { success: true },
      { disabled: true },
      { readOnly: true },
    ]) {
      await act(async () => tree!.update(preview(props)));
      expect(clear()).toHaveLength(0);
      const blocked = 'disabled' in props || 'readOnly' in props;
      expect(tree!.root.findByType(TextInput).props.editable).toBe(!blocked);
      change.mockClear();
      await act(async () => tree!.root.findByType(TextInput).props.onChangeText('Changed'));
      expect(change).toHaveBeenCalledTimes(blocked ? 0 : 1);
    }
  } finally {
    if (tree) await act(async () => tree!.unmount());
  }
});

it('hides password visibility on blur and app background', async () => {
  let stateChanged: ((state: string) => void) | undefined;
  const remove = jest.fn();
  const subscription = jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_event: any, callback: any) => {
      stateChanged = callback;
      return { remove };
    });
  let tree: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      tree = create(
        wrap(<BUIPasswordInput label="Password" value="invented-only" onChangeText={jest.fn()} />),
      );
    });
    const reveal = () =>
      tree!.root
        .findAllByType(AppPressable)
        .find((node) => node.props.accessibilityLabel === 'Show password')!;
    await act(async () => reveal().props.onPress());
    expect(tree!.root.findByType(TextInput).props.secureTextEntry).toBe(false);
    await act(async () => tree!.root.findByType(TextInput).props.onBlur({ nativeEvent: {} }));
    expect(tree!.root.findByType(TextInput).props.secureTextEntry).toBe(true);
    await act(async () => reveal().props.onPress());
    await act(async () => stateChanged!('background'));
    expect(tree!.root.findByType(TextInput).props.secureTextEntry).toBe(true);
  } finally {
    if (tree) await act(async () => tree!.unmount());
    subscription.mockRestore();
  }
  expect(remove).toHaveBeenCalled();
});

it.each([
  [BUISwitch, 'switch'],
  [BUICheckbox, 'checkbox'],
  [BUIRadio, 'radio'],
] as const)('handles selection and disabled/read-only states for %s', async (Control, role) => {
  const change = jest.fn();
  const preview = (checked: boolean, disabled = false, readOnly = false) =>
    wrap(
      <Control
        checked={checked}
        label="Sample control"
        disabled={disabled}
        onCheckedChange={readOnly ? undefined : change}
      />,
    );
  let tree: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      tree = create(preview(false));
    });
    const target = () => tree!.root.findByType(AppPressable);
    expect(target().props.accessibilityRole).toBe(role);
    await act(async () => target().props.onPress());
    expect(change).toHaveBeenLastCalledWith(true);
    await act(async () => tree!.update(preview(true)));
    await act(async () => target().props.onPress());
    expect(change).toHaveBeenLastCalledWith(role === 'radio');
    await act(async () => tree!.update(preview(true, true)));
    change.mockClear();
    await act(async () => target().props.onPress());
    expect(change).not.toHaveBeenCalled();
    await act(async () => tree!.update(preview(true, false, true)));
    expect(target().props.disabled).toBe(true);
  } finally {
    if (tree) await act(async () => tree!.unmount());
  }
});

it.each([
  [FormsScreen, ['Composition', 'Validation']],
  [SelectionsScreen, ['Checkboxes', 'Radio controls', 'Rows']],
] as const)('renders both appearances and every route section', async (Screen, categories) => {
  let tree: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      tree = create(wrap(<Screen />));
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
    }
    if (Screen === FormsScreen) {
      const submit = () =>
        tree!.root
          .findAllByType(BUIButton)
          .find((node) => node.props.children === 'Validate sample')!;
      await act(async () => submit().props.onPress());
      expect(tree!.root.findAllByType(BUIInput).some((node) => node.props.error)).toBe(true);
      const fill = tree!.root
        .findAllByType(BUIButton)
        .find((node) => node.props.children === 'Fill valid sample')!;
      await act(async () => fill.props.onPress());
      await act(async () => submit().props.onPress());
      expect(tree!.root.findAllByType(BUIInput).every((node) => !node.props.error)).toBe(true);
    }
    expect(JSON.stringify(tree!.toJSON())).not.toMatch(/MoonTextField/i);
  } finally {
    if (tree) await act(async () => tree!.unmount());
    useBUIStore.setState({ appearance: 'dark' });
  }
});

it('validates the local form boundaries without wallet rules', () => {
  expect(validateBUIFormPreview({ name: 'Demo', code: 'BUI-1234', note: 'x'.repeat(120) })).toEqual(
    {},
  );
  expect(
    Object.keys(validateBUIFormPreview({ name: ' a ', code: 'invalid', note: 'x'.repeat(121) })),
  ).toEqual(['name', 'code', 'note']);
  expect(
    validateBUIFormPreview({ name: 'x'.repeat(41), code: 'BUI-1234', note: '' }).name,
  ).toBeTruthy();
});

jest.mock('~/shared/utils/developmentClient', () => ({ isDevelopmentClient: () => true }));
